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
test("a minimal phone enquiry needs no written brief and uses phone follow-up", async () => {
  const before = sent.length;
  const result = await post("/api/send-email", {
    name: "Minimal controlled enquiry",
    phone: "0400000000",
    email: "",
    consent: true,
    event_id: crypto.randomUUID(),
  });
  assert.equal(result.status, 200);
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.id,
    ])
  ).rows[0];
  assert.equal(row.message, "");
  assert.equal(row.preferred_contact_method, "phone");
  assert.equal(sent.length, before + 1);
});
test("saved campaign and referrer context reaches the lead and staff notification", async () => {
  const result = await post("/api/send-email", {
    ...valid(),
    utm_source: "gumtree",
    utm_medium: "classified",
    utm_campaign: "tradie_997",
    utm_content: "jack_free",
    landing_path: "/",
    referrer_host: "www.gumtree.com.au",
  });
  assert.equal(result.status, 200);
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.id,
    ])
  ).rows[0];
  assert.equal(row.utm_source, "gumtree");
  assert.equal(row.utm_content, "jack_free");
  assert.equal(row.referrer_host, "www.gumtree.com.au");
  assert.ok(sent.at(-2).text.includes("tradie_997"));
});
test("chatbot-created callbacks retain acquisition context", async () => {
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
                    name: "Attributed tool enquiry",
                    consent: true,
                    email: "tool@example.invalid",
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
    message: "Yes, save the callback.",
    history: [],
    attribution: { utm_source: "gumtree", utm_campaign: "tradie_997" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.tool_call.result.success, true);
  const row = (
    await pool.query("SELECT * FROM callback_requests WHERE id=$1", [
      result.data.tool_call.result.id,
    ])
  ).rows[0];
  assert.equal(row.utm_source, "gumtree");
});


test("visit measurement respects consent, origin, staff exclusion and retry deduplication", async () => {
  const beforeCount=Number((await pool.query('SELECT COUNT(*) FROM campaign_visits')).rows[0].count);
  const body={visit_id:crypto.randomUUID(),source:'google',consent:true};
  const send=async(payload,headers={})=>fetch(base+'/api/measurement/visit',{method:'POST',headers:{'Content-Type':'application/json',Origin:process.env.SITE_URL,...headers},body:JSON.stringify(payload)});
  assert.equal((await send({...body,consent:false})).status,400);
  assert.equal((await send(body,{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await send({...body,source:'private@example.invalid'})).status,400);
  const token=await auth.issueMagicLink('owner@example.invalid');
  const session=await auth.consumeMagicLink(token), Cookie=auth.sessionCookie(session.sessionToken).split(';')[0];
  assert.equal((await (await send(body,{Cookie})).json()).excluded,true);
  assert.equal(Number((await pool.query('SELECT COUNT(*) FROM campaign_visits')).rows[0].count),beforeCount);
  assert.equal((await send(body)).status,200);
  assert.equal((await send(body)).status,200);
  assert.equal(Number((await pool.query('SELECT COUNT(*) FROM campaign_visits')).rows[0].count),beforeCount+1);
  assert.equal((await fetch(base+'/api/performance')).status,401);
  assert.equal((await fetch(base+'/api/sales/1',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
});

test("report links visits to prospects and verified customers without counting retries, tests or transcript requests", async () => {
  const sales=require('../services/salesReporting'), date=sales.today();
  const visit=crypto.randomUUID();
  await pool.query('INSERT INTO campaign_visits(id,source) VALUES($1,$2)',[visit,'google']);
  const v={...valid(),email:'measurement@example.invalid',visit_id:visit,utm_source:'other',latest_utm_source:'google'};
  const saved=await post('/api/send-email',v), duplicate=await post('/api/send-email',{...v,event_id:crypto.randomUUID()});
  assert.equal(saved.status,200);
  const savedRow=(await pool.query('SELECT * FROM callback_requests WHERE id=$1',[saved.data.id])).rows[0];
  assert.equal(savedRow.visit_id,visit);assert.equal(savedRow.latest_utm_source,'google');
  const query={startDate:date,endDate:date,source:'google'};
  let report=await sales.report(query);
  assert.equal(report.metrics.enquiries,1);assert.equal(report.metrics.visits_with_enquiry,1);assert.equal(report.metrics.paid_customers,0);
  const payment={sales_stage:'paid',customer_key:'Controlled unique business',paid_on:date,paid_amount:'199.40',payment_reference:'TEST-INV-1',payment_confirmed:true};
  await assert.rejects(sales.updateSale(saved.data.id,{...payment,payment_confirmed:false},'owner@example.invalid'),{status:400});
  await assert.rejects(sales.updateSale(saved.data.id,{...payment,paid_amount:'0'},'owner@example.invalid'),{status:400});
  await sales.updateSale(saved.data.id,payment,'owner@example.invalid');
  await sales.updateSale(saved.data.id,payment,'owner@example.invalid');
  await assert.rejects(sales.updateSale(duplicate.data.id,{...payment,customer_key:' CONTROLLED UNIQUE BUSINESS '},'owner@example.invalid'),{status:409});
  await sales.updateSale(duplicate.data.id,{sales_stage:'excluded',sales_notes:'Duplicate of SP-'+saved.data.id},'owner@example.invalid');
  report=await sales.report(query);
  assert.equal(report.metrics.enquiries,1);assert.equal(report.metrics.paid_customers,1);assert.equal(report.metrics.visits_with_customer,1);assert.equal(Number(report.metrics.first_payments_cents),19940);
  assert.equal(report.metrics.excluded,1);
  assert.equal((await pool.query('SELECT sales_stage FROM callback_requests WHERE id=$1',[duplicate.data.id])).rows[0].sales_stage,'excluded');
  assert.ok(Number((await pool.query('SELECT COUNT(*) FROM sales_changes WHERE callback_id=$1',[saved.data.id])).rows[0].count)>=1);
  await assert.rejects(sales.updateSale(saved.data.id,{...payment,source_override:'gumtree'},'owner@example.invalid'),{status:400});
  const transcript=await post('/api/chat/email-transcript',{...valid(),email:'transcript-measurement@example.invalid',utm_source:'google',transcript:[{role:'user',content:'Controlled transcript only'}]});
  assert.equal(transcript.status,200);
  report=await sales.report(query);assert.equal(report.metrics.enquiries,1);assert.equal(report.metrics.transcript_only,1);
  const prior='2026-01-01';
  await pool.query("UPDATE callback_requests SET created_at=$1::timestamp WHERE id=$2",[prior+' 12:00:00',saved.data.id]);
  // Returning in a later period must not create another new prospect or paid cohort.
  await post('/api/send-email',{...v,event_id:crypto.randomUUID()});
  report=await sales.report(query);assert.equal(report.metrics.enquiries,0);assert.equal(report.metrics.paid_customers,0);assert.equal(report.metrics.payments_in_period,1);
  assert.equal(report.metrics.visits_with_customer,1);
  assert.equal((await sales.report({startDate:prior,endDate:prior,source:'google'})).metrics.paid_customers,1);
  await assert.rejects(sales.report({startDate:'2026-02-31',endDate:date,source:'google'}),{status:400});
});

test("manual Gumtree and phone enquiries are private, idempotent and do not send emails",async()=>{
  const sales=require('../services/salesReporting'), beforeMail=sent.length;
  const token=await auth.issueMagicLink('owner@example.invalid'), session=await auth.consumeMagicLink(token), Cookie=auth.sessionCookie(session.sessionToken).split(';')[0];
  const body={name:'Controlled phone enquiry',source:'gumtree',capture_method:'phone',message:'Test conversation reference',enquired_on:sales.today(),event_id:crypto.randomUUID()};
  const send=async(headers={})=>fetch(base+'/api/sales/manual',{method:'POST',headers:{'Content-Type':'application/json',Origin:process.env.SITE_URL,Cookie,...headers},body:JSON.stringify(body)});
  assert.equal((await send({Origin:'https://untrusted.example'})).status,403);
  const one=await (await send()).json(), two=await (await send()).json();
  assert.equal(one.id,two.id);assert.equal(sent.length,beforeMail);
  const row=(await pool.query('SELECT * FROM callback_requests WHERE id=$1',[one.id])).rows[0];assert.equal(row.capture_method,'phone');assert.equal(row.utm_source,'gumtree');
});
