// One provider-backed, synthetic callback through the reused app. Email stays simulated.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const axios = require("axios");
const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  !new URL(databaseUrl).pathname.endsWith("_preview_test") ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Use isolated preview database only");
const key = execFileSync(
  "security",
  [
    "find-generic-password",
    "-a",
    "rad",
    "-s",
    "openrouter-inference-api-key",
    "-w",
  ],
  { encoding: "utf8" },
).trim();
process.env.OPENROUTER_API_KEY = key;
process.env.OPENROUTER_MODEL = "openai/gpt-5.4-mini";
process.env.OPENROUTER_MAX_TOKENS = "500";
process.env.OPENROUTER_USE_STREAMING = "true";
process.env.ENABLE_CALLBACKS = "true";
process.env.ENABLE_WEB_SEARCH = "false";
process.env.MAILGUN_API_KEY = "test-only";
process.env.MAILGUN_DOMAIN = "example.invalid";
process.env.RECIPIENT_EMAIL = "owner@example.invalid";
require("../services/mailgun").createMailgunClient = () => ({
  messages: () => ({ send: async () => ({ id: "simulated" }) }),
});
const calls = [];
const original = axios.post.bind(axios);
let budgetReservation = 0;
axios.post = async (url, body, options) => {
  if (++budgetReservation > 2) throw new Error("Maximum two provider calls");
  body.stream_options = { include_usage: true };
  const start = Date.now(),
    result = await original(url, body, options);
  const decode = require("../services/sse").createLineDecoder();
  result.data.on("data", (chunk) => {
    for (const line of decode(chunk)) {
      if (!line.startsWith("data: ") || line.slice(6) === "[DONE]") continue;
      try {
        const item = JSON.parse(line.slice(6));
        if (item.usage)
          calls.push({ elapsed_ms: Date.now() - start, usage: item.usage });
      } catch {}
    }
  });
  return result;
};
(async () => {
  const allowance = (
    await axios.get("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 15000,
    })
  ).data.data;
  if ((allowance.limit_remaining ?? 0) < 0.03)
    throw new Error("Insufficient test allowance");
  const app = require("../server");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: crypto.randomUUID(),
          message:
            "Yes, I explicitly consent to saving a callback request. My name is Synthetic Tradie App Test, my email is synthetic-app@example.invalid and I want to discuss a roofing website after 4pm on weekdays. Please save the request.",
          history: [],
        }),
      },
    );
    const stream = await response.text();
    const events = stream
      .split("\n")
      .filter((line) => line.startsWith("data: ") && line.slice(6) !== "[DONE]")
      .flatMap((line) => {
        try {
          return [JSON.parse(line.slice(6))];
        } catch {
          return [];
        }
      });
    const tool = events.find(
      (item) => item.tool_name === "request_callback" && item.tool_result,
    );
    const text = events
      .map((item) => item.choices?.[0]?.delta?.content || "")
      .join("");
    const report = {
      model: process.env.OPENROUTER_MODEL,
      provider_backed: true,
      email_delivery: "simulated",
      streaming: response.headers
        .get("content-type")
        .includes("text/event-stream"),
      callback_saved: tool?.tool_result?.success === true,
      reference: tool?.tool_result?.referenceId,
      reply: text,
      calls,
    };
    fs.writeFileSync(
      require("node:path").join(
        __dirname,
        "../outputs/provider-app-verification.json",
      ),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    if (!report.callback_saved)
      throw new Error("Provider did not produce a saved callback");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await require("../db/pool").end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
