const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createAnalytics, CHOICE_KEY } = require("../public/js/analytics");

function setup({ saved = "", hostname = "tradie.simplepage.com.au", pathname = "/", attribution = {} } = {}) {
  const loaded = [], sent = [], flags = [], values = new Map([[CHOICE_KEY, saved]]);
  const api = createAnalytics({
    location: { hostname, pathname, search: "?email=private@example.invalid", hash: "#private" },
    storage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) },
    referrer: "https://www.gumtree.com.au/private/customer?email=private@example.invalid#token",
    attribution: () => attribution,
    load: (value) => loaded.push(value),
    send: (event, data) => sent.push({ event, ...data }),
    disable: (value) => flags.push(value),
  });
  return { api, loaded, sent, flags, values };
}

test("default-off and declined analytics never load or send, including queued funnel activity", () => {
  const x = setup();
  x.api.track({ event: "form_started", form_kind: "main" });
  assert.equal(x.loaded.length, 0);
  assert.equal(x.sent.length, 0);
  x.api.setChoice("declined");
  x.api.track({ event: "enquiry_saved", form_kind: "main" });
  assert.equal(x.loaded.length, 0);
  assert.equal(x.sent.length, 0);
  assert.equal(x.values.get(CHOICE_KEY), "declined");
});

test("accept sends a single safe pageview and only allowlisted event fields", () => {
  const x = setup({ attribution: { utm_source: "gumtree", utm_medium: "classified", utm_campaign: "tradie_997", utm_content: "jack_free", utm_term: "private", gclid: "private" } });
  x.api.setChoice("accepted");
  x.api.setChoice("accepted");
  x.api.track({ event: "enquiry_saved", form_kind: "main", reference: 123, email: "private@example.invalid", conversation: "private", message: "private", amount: 997 });
  x.api.track({ event: "paid_job", amount: 997 });
  assert.equal(x.loaded.length, 1);
  assert.equal(x.sent.length, 2);
  assert.equal(x.loaded[0].campaign_source, "gumtree");
  assert.equal(x.loaded[0].campaign_content, "jack_free");
  assert.equal(x.loaded[0].allow_google_signals, false);
  assert.equal(x.loaded[0].allow_ad_personalization_signals, false);
  assert.equal(x.loaded[0].page_location, "https://tradie.simplepage.com.au/");
  assert.equal(x.loaded[0].page_referrer, "https://www.gumtree.com.au/");
  assert.equal(x.loaded[0].send_page_view, false);
  assert.deepEqual(x.sent[1], { event: "enquiry_saved", funnel: "tradie_website", form_kind: "main" });
  assert.ok(!JSON.stringify([x.loaded, x.sent]).includes("private"));
});

test("arbitrary campaign and event values cannot leave the adapter", () => {
  const x = setup({ saved: "accepted", attribution: { utm_source: "gumtree", utm_campaign: "private", utm_content: "private", utm_medium: "private" } });
  x.api.track({ event: "form_error", field: "private", form_kind: "private", placement: "private" });
  assert.ok(!JSON.stringify([x.loaded, x.sent]).includes("private"));
  assert.deepEqual(x.sent[1], { event: "form_error", funnel: "tradie_website" });
});

test("saved acceptance works only on the public production homepage", () => {
  for (const location of [{ hostname: "localhost" }, { pathname: "/admin/callbacks.html" }, { pathname: "/privacy-policy-2/" }, { hostname: "another.example" }]) {
    const x = setup({ saved: "accepted", ...location });
    x.api.track({ event: "cta_clicked", placement: "hero" });
    assert.equal(x.loaded.length, 0);
    assert.equal(x.sent.length, 0);
  }
});

test("withdrawal stops subsequent events and repeated acceptance does not duplicate pageview", () => {
  const x = setup({ saved: "accepted" });
  x.api.setChoice("declined");
  x.api.track({ event: "cta_clicked", placement: "hero" });
  assert.equal(x.flags.at(-1), true);
  assert.equal(x.sent.length, 1);
  x.api.setChoice("accepted");
  x.api.track({ event: "cta_clicked", placement: "hero" });
  assert.equal(x.sent.length, 2);
  assert.equal(x.loaded.length, 1);
});

test("browser bootstrap creates no Google script before acceptance and drops earlier events", () => {
  const scripts = [], handlers = {}, store = new Map();
  const accept = { dataset: { analyticsChoice: "accepted" }, addEventListener: (_, fn) => { handlers.accept = fn; } };
  const decline = { dataset: { analyticsChoice: "declined" }, addEventListener: (_, fn) => { handlers.decline = fn; } };
  const panel = { hidden: false }, status = { textContent: "" };
  const document = {
    cookie: "", referrer: "",
    head: { appendChild: (script) => scripts.push(script) },
    createElement: () => ({}),
    getElementById: (id) => id === "analyticsChoice" ? panel : status,
    querySelectorAll: (selector) => selector === "[data-analytics-choice]" ? [accept, decline] : [],
  };
  const window = { document, location: { hostname: "tradie.simplepage.com.au", pathname: "/" },
    localStorage: { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) },
    addEventListener: (event, fn) => { handlers[event] = fn; },
    sessionStorage: { getItem: () => null }, dataLayer: [] };
  vm.runInNewContext(fs.readFileSync(require.resolve("../public/js/analytics"), "utf8"), { window, URL });
  window.dataLayer.push({ event: "form_started", form_kind: "main" });
  assert.equal(scripts.length, 0);
  assert.equal(window.tradieAnalyticsLayer.length, 0);
  handlers.accept();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].referrerPolicy, "no-referrer");
  assert.ok(scripts[0].src.includes("G-3P2DEQYRGE"));
  assert.ok(!JSON.stringify(window.tradieAnalyticsLayer).includes("form_started"));
  window.dataLayer.push({ event: "cta_clicked", placement: "hero", email: "private@example.invalid" });
  assert.ok(!JSON.stringify(window.tradieAnalyticsLayer).includes("private"));
  handlers.decline();
  const count = window.tradieAnalyticsLayer.length;
  window.dataLayer.push({ event: "enquiry_saved", form_kind: "main" });
  assert.equal(window.tradieAnalyticsLayer.length, count);
  assert.equal(window["ga-disable-G-3P2DEQYRGE"], true);
  handlers.accept();
  handlers.storage({ key: CHOICE_KEY, newValue: "declined", storageArea: window.localStorage });
  const afterWithdrawal = window.tradieAnalyticsLayer.length;
  window.dataLayer.push({ event: "cta_clicked", placement: "hero" });
  assert.equal(window.tradieAnalyticsLayer.length, afterWithdrawal);
  assert.equal(window["ga-disable-G-3P2DEQYRGE"], true);
  assert.equal(status.textContent, "Optional analytics is off.");
});
