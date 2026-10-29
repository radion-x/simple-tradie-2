require("dotenv").config();
const express = require("express");
const path = require("node:path");
const pool = require("./db/pool");
const { createHtmlInjectionMiddleware } = require("./middleware/htmlInjection");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});
const buckets = new Map();
app.use("/api", (req, res, next) => {
  if (req.method !== "POST") return next();
  const now = Date.now(),
    key = req.ip;
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > 60000) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  if (++bucket.count > 40)
    return res
      .status(429)
      .json({ error: "Please wait a minute before trying again." });
  next();
});
const cleanup = setInterval(() => {
  for (const [key, value] of buckets)
    if (Date.now() - value.start > 60000) buckets.delete(key);
}, 60000);
cleanup.unref();
app.get("/health", async (req, res) => {
  try {
    await pool.query(
      "SELECT event_id,quote_details,notification_status FROM callback_requests LIMIT 0",
    );
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use("/api", require("./routes/email"));
app.use("/api", require("./routes/ai"));
app.use("/api", require("./routes/callbacks"));
const root = path.join(__dirname, "public");
app.use((req, res, next) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).end();
  }
  if (/\.(?:backup|bak|old)|backup-|old-dental/i.test(decodedPath))
    return res.status(404).end();
  if (
    /^\/(?:offers|industries|service|about|case-studies|blog)(?:\/|$)/.test(
      req.path,
    )
  )
    return res.redirect(301, "/");
  if (req.path === "/contact" || req.path === "/contact/")
    return res.redirect(301, "/#contact");
  next();
});
app.use(
  createHtmlInjectionMiddleware({
    rootDirectory: root,
    headSnippet: process.env.HTML_HEAD_INJECT || "",
    bodySnippet: process.env.HTML_BODY_INJECT || "",
  }),
);
app.use(express.static(root));
app.get("/contact/", (req, res) => res.redirect(301, "/#contact"));
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((error, req, res, next) => {
  console.error("Request failed", error.type || "internal error");
  res
    .status(error.status >= 400 && error.status < 500 ? error.status : 500)
    .json({ error: "The request could not be processed." });
});
if (require.main === module) {
  pool
    .query(
      "SELECT event_id,quote_details,notification_status FROM callback_requests LIMIT 0",
    )
    .then(() =>
      app.listen(process.env.PORT || 3000, "0.0.0.0", () =>
        console.log("Simple Page tradie app ready"),
      ),
    )
    .catch(() => {
      console.error(
        "Database is not ready. Run the reviewed migrations before starting.",
      );
      process.exitCode = 1;
      pool.end();
    });
}
module.exports = app;
