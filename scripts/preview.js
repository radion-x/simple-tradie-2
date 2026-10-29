// Local review only. No messages leave this process.
if (process.env.PREVIEW_MODE !== "isolated")
  throw new Error("Set PREVIEW_MODE=isolated for this local preview.");
const url = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
)
  throw new Error("Preview requires an isolated local _test database.");
process.env.MAILGUN_API_KEY = "preview-only";
process.env.MAILGUN_DOMAIN = "example.invalid";
process.env.RECIPIENT_EMAIL = "owner@example.invalid";
process.env.ADMIN_EMAILS = "owner@example.invalid";
process.env.ENABLE_CALLBACKS = "true";
process.env.OPENROUTER_USE_STREAMING = "false";
process.env.OPENROUTER_API_KEY = "preview-only";
process.env.OPENROUTER_MODEL = "preview-only";
process.env.HTML_HEAD_INJECT =
  '<style>body:before{content:"LOCAL REVIEW: AI replies and email delivery are simulated. Form requests save to a test database.";display:block;padding:8px 20px;background:#fff2cc;color:#513e00;text-align:center;font:12px Arial,sans-serif}</style>';
require("../services/mailgun").createMailgunClient = () => ({
  messages: () => ({
    send: async (data) => {
      if ((data.text || "").includes("simulate email failure"))
        throw new Error("Controlled preview email failure");
      return { id: "simulated-preview-message" };
    },
  }),
});
require("axios").post = async (url, body) => {
  if (body.messages.at(-1).content.toLowerCase().includes("simulate failure"))
    throw new Error("Controlled preview failure");
  return {
    data: {
      choices: [
        {
          message: {
            content:
              "The published tradie package is $997 setup plus $30 per month for hosting and AI. It includes three custom pages, an enquiry form, click to call, an information assistant and a lead dashboard. We confirm scope, ongoing inclusions and timing in writing. Use Request a callback to discuss your website. (Simulated preview reply.)",
          },
        },
      ],
    },
  };
};
const database = require("../db/pool");
const originalQuery = database.query.bind(database);
database.query = (sql, params) => {
  if (
    sql.startsWith("INSERT INTO callback_requests") &&
    params?.some(
      (value) =>
        typeof value === "string" && value.includes("simulate save failure"),
    )
  )
    return Promise.reject(new Error("Controlled preview database failure"));
  return originalQuery(sql, params);
};
const app = require("../server"),
  preview = require("express")();
preview.get("/__preview/staff", async (req, res, next) => {
  try {
    const auth = require("../services/adminAuth");
    const token = await auth.issueMagicLink("owner@example.invalid");
    const session = await auth.consumeMagicLink(token);
    res.setHeader("Set-Cookie", auth.sessionCookie(session.sessionToken));
    res.redirect("/admin/callbacks.html");
  } catch (error) {
    next(error);
  }
});
preview.get("/admin/callbacks.html", (req, res) => {
  const html = require("node:fs")
    .readFileSync(
      require("node:path").join(__dirname, "../public/admin/callbacks.html"),
      "utf8",
    )
    .replace(
      "<h1>Simple Page Website Enquiries</h1>",
      "<h1>LOCAL REVIEW: Synthetic Enquiries</h1>",
    );
  res.type("html").send(html);
});
preview.use(app);
preview.listen(process.env.PORT || 3150, "127.0.0.1", () =>
  console.log(
    "Isolated review at http://localhost:3150. No external email or AI requests.",
  ),
);
