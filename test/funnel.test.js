const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createFunnel } = require("../public/js/funnel");
function storage() {
  const data = {};
  return {
    getItem: (key) => data[key] || null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}
test("first entry attribution survives privacy navigation and preserves the original campaign", () => {
  const saved = storage(),
    events = [];
  const first = createFunnel({
    location: {
      pathname: "/",
      hostname: "tradie.simplepage.com.au",
      search:
        "?utm_source=gumtree&utm_campaign=tradie_997&utm_content=jack_free",
    },
    storage: saved,
    referrer: "https://www.gumtree.com.au/ad/123?private=discarded",
    emit: (event) => events.push(event),
  });
  assert.equal(first.attribution().utm_source, "gumtree");
  assert.equal(first.attribution().referrer_host, "www.gumtree.com.au");
  assert.equal(first.attribution().landing_path, "/");
  const later = createFunnel({
    location: {
      pathname: "/privacy-policy-2/",
      hostname: "tradie.simplepage.com.au",
      search: "",
    },
    storage: saved,
    emit: () => {},
  });
  assert.equal(later.attribution().utm_content, "jack_free");
  assert.equal(later.attribution().landing_path, "/");
});
test("saved enquiry events deduplicate and never contain contact details or count as paid sales", () => {
  const events = [];
  const funnel = createFunnel({
    location: { pathname: "/", hostname: "localhost", search: "" },
    storage: storage(),
    emit: (event) => events.push(event),
  });
  funnel.track("enquiry_saved", {
    form_kind: "main",
    reference: 12,
    email: "private@example.invalid",
    message: "private text",
  });
  funnel.track("enquiry_saved", { form_kind: "main", reference: 12 });
  funnel.track("enquiry_saved", {
    form_kind: "main",
    reference: 13,
    duplicate: true,
  });
  funnel.track("phone_clicked", { placement: "header" });
  funnel.track("paid_job", { amount: 997 });
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], {
    event: "enquiry_saved",
    funnel: "tradie_website",
    form_kind: "main",
  });
  assert.ok(!JSON.stringify(events).includes("private"));
  assert.equal(events[1].event, "phone_clicked");
});
test("restricted storage still allows attribution and safe event recording", () => {
  const events = [];
  const funnel = createFunnel({
    location: {
      pathname: "/",
      hostname: "localhost",
      search: "?utm_source=gumtree",
    },
    storage: {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("disabled");
      },
    },
    emit: (event) => events.push(event),
  });
  assert.equal(funnel.attribution().utm_source, "gumtree");
  funnel.track("form_error", {
    form_kind: "main",
    field: "email",
    error: "private string",
  });
  assert.deepEqual(events[0], {
    event: "form_error",
    funnel: "tradie_website",
    form_kind: "main",
    field: "email",
  });
});
