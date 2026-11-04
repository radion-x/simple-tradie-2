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
function entry(search, saved = storage()) {
  return createFunnel({
    location: {
      pathname: "/",
      hostname: "tradie.simplepage.com.au",
      search,
    },
    storage: saved,
    emit: () => {},
  });
}
test("Gumtree HTML-escaped separators retain complete attribution across navigation", () => {
  const saved = storage();
  const funnel = entry(
    "?utm_source=gumtree&amp;utm_medium=classified&amp;utm_campaign=tradie_997&amp;utm_content=jack_free",
    saved,
  );
  const expected = {
    landing_path: "/",
    utm_source: "gumtree",
    utm_medium: "classified",
    utm_campaign: "tradie_997",
    utm_content: "jack_free",
  };
  assert.deepEqual(funnel.attribution(), expected);
  assert.deepEqual(entry("", saved).attribution(), expected);
});
test("normal campaign values stay intact and unknown escaped keys are discarded", () => {
  assert.deepEqual(
    entry(
      "?utm_source=gumtree&utm_medium=classified&utm_campaign=repairs%26amp%3Bmaintenance&amp;email=private%40example.invalid",
    ).attribution(),
    {
      landing_path: "/",
      utm_source: "gumtree",
      utm_medium: "classified",
      utm_campaign: "repairs&amp;maintenance",
    },
  );
});
test("proper campaign keys win over escaped aliases regardless of order, including empty values", () => {
  for (const search of [
    "?amp;utm_source=wrong&utm_source=gumtree&utm_medium=&amp;utm_medium=wrong",
    "?utm_source=gumtree&amp;utm_source=wrong&amp;utm_medium=wrong&utm_medium=",
  ]) {
    assert.deepEqual(entry(search).attribution(), {
      landing_path: "/",
      utm_source: "gumtree",
      utm_medium: "",
    });
  }
});
test("latest campaign updates on a tagged return while first entry stays intact", () => {
  const saved = storage();
  const first = entry("?utm_source=referral&utm_campaign=first", saved);
  assert.deepEqual(first.latestAttribution(), first.attribution());

  const returned = entry(
    "?utm_source=gumtree&amp;utm_medium=classified&amp;utm_campaign=tradie_997",
    saved,
  );
  assert.deepEqual(returned.attribution(), first.attribution());
  assert.deepEqual(returned.latestAttribution(), {
    landing_path: "/",
    utm_source: "gumtree",
    utm_medium: "classified",
    utm_campaign: "tradie_997",
  });
  const untagged = entry("", saved);
  assert.deepEqual(untagged.attribution(), first.attribution());
  assert.deepEqual(untagged.latestAttribution(), returned.latestAttribution());
});
test("direct visits do not invent a latest campaign", () => {
  assert.deepEqual(entry("").latestAttribution(), {});
  assert.deepEqual(entry("?amp;email=private%40example.invalid").latestAttribution(), {});
});
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
