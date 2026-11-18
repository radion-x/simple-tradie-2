const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLead, captureLead } = require("../services/leadCapture");

const request = {
  name: "Sample",
  service: "Plumber, Penrith",
  consent: true,
  utm_source: "gumtree",
};

test("a page plan accepts either reply channel and keeps the campaign", () => {
  const email = validateLead({ ...request, reply_to: " sample@example.invalid " }, "contact_form");
  assert.equal(email.data.email, "sample@example.invalid");
  assert.equal(email.data.phone, "");
  assert.equal(email.data.attribution.utm_source, "gumtree");
  assert.equal(email.data.pagePlan, true);
  const phone = validateLead({ ...request, reply_to: "0412 345 678" }, "contact_form");
  assert.equal(phone.data.phone, "0412 345 678");
  assert.equal(phone.data.email, "");
  for (const reply of ["  ", "abc", "abc@", {}, "x".repeat(300)]) {
    assert.equal(validateLead({ ...request, reply_to: reply }, "contact_form").field, "reply_to");
  }
});

test("existing contact forms and callbacks still accept separate fields", () => {
  for (const source of ["contact_form", "chat_booking"]) {
    const lead = validateLead({ ...request, phone: "0412 345 678", email: "sample@example.invalid" }, source);
    assert.equal(lead.data.phone, "0412 345 678");
    assert.equal(lead.data.email, "sample@example.invalid");
    assert.equal(lead.data.pagePlan, false);
  }
});

test("the saved plan request and staff and customer emails carry the same offer", async () => {
  const { data } = validateLead({ ...request, reply_to: "sample@example.invalid" }, "contact_form");
  const statements = [];
  const messages = [];
  const database = { query: async (sql, params) => {
    statements.push(params);
    return { rows: [{ id: 100 }] };
  } };
  const mailer = { messages: () => ({ send: async message => messages.push(message) }) };
  const result = await captureLead(data, "contact_form", { database, mailer });
  assert.equal(result.id, 100);
  assert.equal(result.notification_sent, true);
  assert.equal(result.confirmation_sent, true);
  assert.equal(JSON.parse(statements[0][18]).request, "three_page_plan");
  assert.equal(statements[0][10], "gumtree");
  assert.match(messages[0].text, /Three-page website plan and relevant work example/);
  assert.match(messages[1].text, /suggested plan for your three pages/);
});
