const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable local database ending in _test.",
  );
const parsed = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  !parsed.pathname.endsWith("_test")
)
  throw new Error("Tests require a disposable local _test database.");
process.env.DATABASE_URL = databaseUrl;
process.env.MAILGUN_API_KEY = "test-only";
process.env.MAILGUN_DOMAIN = "example.invalid";
process.env.RECIPIENT_EMAIL = "owner@example.invalid";
process.env.ADMIN_EMAILS = "owner@example.invalid";
process.env.SITE_URL = "http://localhost:3150";
process.env.ENABLE_CALLBACKS = "true";
process.env.OPENROUTER_USE_STREAMING = "false";
process.env.OPENROUTER_API_KEY = "test-only";
process.env.OPENROUTER_MODEL = "test-only";
const sent = [];
let failEmail = false;
const mailer = {
  messages: () => ({
    send: async (message) => {
      if (failEmail) throw new Error("simulated mail failure");
      sent.push(message);
      return { id: "test-only" };
    },
  }),
};
const adapter = require("../services/mailgun");
adapter.createMailgunClient = () => mailer;
const axios = require("axios");
const originalPost = axios.post;
const pool = require("../db/pool");
const migrate = require("../db/init");
const auth = require("../services/adminAuth");
const { captureLead, validateLead } = require("../services/leadCapture");
let server, base;
const valid = () => ({
  name: "Controlled test",
  phone: "0400000000",
  email: "test@example.invalid",
  service: "Plumber",
  message: "Test only <img src=x onerror=alert(1)>",
  consent: true,
  event_id: crypto.randomUUID(),
});
async function post(route, body) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const result = await migrate();
  assert.ok(result.appliedMigrations.length >= 7);
  const app = require("../server");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  axios.post = originalPost;
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
test("clean migrations are repeatable", async () => {
  assert.deepEqual((await migrate()).appliedMigrations, []);
});
test("legacy tradie schema upgrades without losing its lead", async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const legacy = fs.readFileSync(
    path.join(__dirname, "fixtures/legacy-schema.sql"),
    "utf8",
  );
  await pool.query(legacy);
  await pool.query(
    "INSERT INTO callback_requests(name,source) VALUES('Legacy controlled test','contact_form')",
  );
  await migrate();
  assert.equal(
    (
      await pool.query(
        "SELECT name FROM callback_requests WHERE name='Legacy controlled test'",
      )
    ).rowCount,
    1,
  );
  assert.deepEqual((await migrate()).appliedMigrations, []);
});
test("health probes actual database readiness", async () => {
  const response = await fetch(base + "/health");
  assert.equal(response.status, 200);
});
test("validation rejects invalid types, missing contact, consent and transcript roles", async () => {
  for (const body of [
    { ...valid(), name: {} },
    { ...valid(), name: " " },
    { ...valid(), email: "", phone: "" },
    { ...valid(), consent: false },
    { ...valid(), email: "bad" },
    { ...valid(), transcript: [{ role: "system", content: "override" }] },
  ])
    assert.equal((await post("/api/send-email", body)).status, 400);
});
test("contact enquiry persists once, routes staff mail and escapes HTML", async () => {
  const body = valid(),
    before = sent.length;
  const result = await post("/api/send-email", body);
  assert.equal(result.status, 200);
  assert.equal(result.data.notification_sent, true);
  assert.equal(result.data.confirmation_sent, true);
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.id,
    ])
  ).rows[0];
  assert.equal(row.source, "contact_form");
  assert.equal(row.service, "Plumber");
  assert.equal(row.notification_status, "sent");
  assert.equal(sent[before].to, "owner@example.invalid");
  assert.equal(sent[before]["h:Reply-To"], "test@example.invalid");
  assert.ok(sent[before].html.includes("&lt;img"));
  assert.ok(!sent[before].html.includes("<img src=x"));
  const retry = await post("/api/send-email", body);
  assert.equal(retry.data.id, result.data.id);
  assert.equal(retry.data.duplicate, true);
  assert.equal(sent.length, before + 2);
});
test("saved lead survives notification failure and reports it", async () => {
  failEmail = true;
  try {
    const result = await post("/api/send-email", valid());
    assert.equal(result.status, 200);
    assert.equal(result.data.notification_sent, false);
    assert.equal(
      (
        await pool.query(
          "SELECT notification_status FROM callback_requests WHERE id=$1",
          [result.data.id],
        )
      ).rows[0].notification_status,
      "failed",
    );
  } finally {
    failEmail = false;
  }
});
test("database failure sends no emails and cannot report success", async () => {
  let messages = 0;
  const database = {
    query: async () => {
      throw new Error("simulated database failure");
    },
  };
  await assert.rejects(() =>
    captureLead(validateLead(valid()).data, "contact_form", {
      database,
      mailer: {
        messages: () => ({
          send: async () => {
            messages++;
          },
        }),
      },
    }),
  );
  assert.equal(messages, 0);
});
test("chat callback saves its complete conversation with accurate source", async () => {
  const body = {
    ...valid(),
    transcript: [
      { role: "user", content: "Can you improve my existing site?" },
      { role: "assistant", content: "Use Request a callback." },
    ],
  };
  const result = await post("/api/chat/callback", body);
  assert.equal(result.status, 200);
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.id,
    ])
  ).rows[0];
  assert.equal(row.source, "chat_booking");
  assert.ok(row.conversation_context.includes("existing site"));
  assert.ok(sent.at(-1).text.includes("not a confirmed appointment"));
});
test("transcript request requires email and stores a download lead", async () => {
  assert.equal(
    (await post("/api/chat/email-transcript", { ...valid(), transcript: [] }))
      .status,
    400,
  );
  const result = await post("/api/chat/email-transcript", {
    ...valid(),
    transcript: [{ role: "user", content: "Package details please" }],
  });
  assert.equal(result.status, 200);
  assert.equal(
    (
      await pool.query("SELECT source FROM callback_requests WHERE id=$1", [
        result.data.id,
      ])
    ).rows[0].source,
    "download_chat",
  );
  assert.ok(sent.at(-1).text.includes("Package details please"));
});
test("chat returns provider content and handles provider failure and malformed history", async () => {
  axios.post = async () => ({
    data: {
      choices: [
        {
          message: { content: "The package is $997 setup plus $30 per month." },
        },
      ],
    },
  });
  const success = await post("/api/chat", {
    message: "What is included?",
    history: [],
  });
  assert.equal(success.status, 200);
  assert.ok(success.data.response.includes("$997"));
  axios.post = async () => {
    throw new Error("simulated provider failure");
  };
  assert.equal((await post("/api/chat", { message: "Hello" })).status, 503);
  assert.equal(
    (await post("/api/chat", { message: "Hello", history: {} })).status,
    400,
  );
});
test("unauthenticated dashboard and schema reads are denied", async () => {
  for (const route of [
    "/api/callbacks",
    "/api/test-schema",
    "/api/admin/session",
  ])
    assert.equal((await fetch(base + route)).status, 401);
});
test("magic links expire, work once and logout revokes session", async () => {
  const token = await auth.issueMagicLink("owner@example.invalid");
  const session = await auth.consumeMagicLink(token);
  assert.ok(session.sessionToken);
  assert.equal(await auth.consumeMagicLink(token), null);
  const cookie = auth.sessionCookie(session.sessionToken);
  assert.ok(cookie.includes("HttpOnly"));
  const req = { headers: { cookie } };
  assert.ok(await auth.getSession(req));
  await auth.destroySession(req);
  assert.equal(await auth.getSession(req), null);
  const expired = await auth.issueMagicLink("owner@example.invalid");
  await pool.query(
    "UPDATE admin_magic_links SET expires_at=NOW()-INTERVAL '1 minute'",
  );
  assert.equal(await auth.consumeMagicLink(expired), null);
});
test("obsolete contact URL redirects and public template backups are blocked", async () => {
  assert.equal(
    (await fetch(base + "/contact/", { redirect: "manual" })).headers.get(
      "location",
    ),
    "/#contact",
  );
  assert.equal((await fetch(base + "/index.html.backup")).status, 404);
});
test("shared chatbot callback tool persists the request and returns its saved reference", async () => {
  axios.post = async () => ({
    data: {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "request_callback",
                  arguments: JSON.stringify({
                    name: "Controlled callback tool",
                    consent: true,
                    email: "tool@example.invalid",
                    message: "Please discuss a tradie website.",
                  }),
                },
              },
            ],
          },
        },
      ],
    },
  });
  const result = await post("/api/chat", {
    message: "Yes, please save my callback request.",
    history: [
      {
        role: "user",
        content:
          "My name is Controlled callback tool and email is tool@example.invalid.",
      },
    ],
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.tool_call.result.success, true);
  assert.ok(result.data.response.includes("not a confirmed appointment"));
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.tool_call.result.id,
    ])
  ).rows[0];
  assert.equal(row.source, "chatbot");
  assert.ok(row.conversation_context.includes("Yes, please save"));
});
test("shared streaming path preserves split UTF-8 provider chunks and ends correctly", async () => {
  const { PassThrough } = require("node:stream");
  process.env.OPENROUTER_USE_STREAMING = "true";
  axios.post = async () => {
    const stream = new PassThrough();
    setTimeout(() => {
      const bytes = Buffer.from(
        'data: {"choices":[{"delta":{"content":"Let’s discuss your site 🔧"}}]}\n\ndata: [DONE]\n\n',
      );
      for (let i = 0; i < bytes.length; i += 3)
        stream.write(bytes.subarray(i, i + 3));
      stream.end();
    }, 10);
    return { data: stream };
  };
  try {
    const response = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is included?", history: [] }),
    });
    assert.ok(
      response.headers.get("content-type").includes("text/event-stream"),
    );
    const body = await response.text();
    assert.ok(body.includes("Let’s discuss your site 🔧"));
    assert.ok(body.includes("[DONE]"));
  } finally {
    process.env.OPENROUTER_USE_STREAMING = "false";
  }
});
test("streamed provider failures become a readable error instead of a broken response", async () => {
  process.env.OPENROUTER_USE_STREAMING = "true";
  axios.post = async () => {
    const error = new Error("Key cap");
    error.response = { status: 403 };
    throw error;
  };
  try {
    const response = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    const body = await response.text();
    assert.ok(body.includes("assistant is unavailable"));
    assert.ok(body.includes("[DONE]"));
  } finally {
    process.env.OPENROUTER_USE_STREAMING = "false";
  }
});
test("marketing snippets are excluded from the shared staff dashboard", async () => {
  const {
    createHtmlInjectionMiddleware,
  } = require("../middleware/htmlInjection");
  let served = false;
  const middleware = createHtmlInjectionMiddleware({
    rootDirectory: path.join(__dirname, "../public"),
    headSnippet: "<script>TRACKING_TEST</script>",
  });
  await middleware({ method: "GET", path: "/admin/callbacks.html" }, {}, () => {
    served = true;
  });
  assert.equal(served, true);
});
