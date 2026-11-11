(function (root) {
  const ID = "G-3P2DEQYRGE";
  const CHOICE_KEY = "tradie_analytics_choice_v1";
  const HOST = "tradie.simplepage.com.au";
  const EVENTS = new Set([
    "cta_clicked", "phone_clicked", "form_viewed", "form_started",
    "form_error", "form_submitted", "enquiry_saved",
  ]);

  function safeEvent(input) {
    if (!input || !EVENTS.has(input.event)) return null;
    const result = { event: input.event, funnel: "tradie_website" };
    const allowed = {
      form_kind: ["main", "callback", "transcript", "chatbot"],
      placement: ["hero", "pricing", "contact", "header", "footer", "other"],
      field: ["name", "email", "phone", "consent", "form"],
    };
    for (const [key, values] of Object.entries(allowed))
      if (values.includes(input[key])) result[key] = input[key];
    return result;
  }

  function safeCampaign(attribution = {}) {
    // Google campaigns are approved as complete routes, never mixed field by field.
    if (attribution.utm_source === "google" && attribution.utm_campaign === "sydney_tradie_websites" && (
      (attribution.utm_medium === "organic" && attribution.utm_content === "gbp_update") ||
      (attribution.utm_medium === "cpc" && attribution.utm_content === "rsa_trade")
    )) return {
      campaign_source: "google",
      campaign_medium: attribution.utm_medium,
      campaign_name: "sydney_tradie_websites",
      campaign_content: attribution.utm_content,
    };
    if (attribution.utm_source !== "gumtree") return {};
    const result = { campaign_source: "gumtree" };
    if (!attribution.utm_medium || attribution.utm_medium === "classified") result.campaign_medium = "classified";
    if (attribution.utm_campaign === "tradie_997") result.campaign_name = "tradie_997";
    if (attribution.utm_content === "jack_free") result.campaign_content = "jack_free";
    return result;
  }

  function safeReferrer(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.origin + "/" : "";
    } catch { return ""; }
  }

  // Injected dependencies keep consent behaviour testable without Google requests.
  function createAnalytics({ location, storage, referrer = "", attribution = () => ({}), load, send, disable, recordVisit = () => {}, stopVisit = () => {} }) {
    const eligible = location.hostname === HOST && location.pathname === "/";
    let choice = "", loaded = false, pageViewSent = false;
    try { choice = storage.getItem(CHOICE_KEY) || ""; } catch {}
    if (!["accepted", "declined"].includes(choice)) choice = "";
    function start() {
      if (!eligible || choice !== "accepted") return;
      disable(false);
      recordVisit();
      if (!loaded) {
        loaded = true;
        load({
          send_page_view: false,
          page_location: `https://${HOST}/`,
          page_referrer: safeReferrer(referrer),
          page_title: "Websites for Sydney tradies | Simple Page",
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          cookie_domain: "none",
          cookie_prefix: "tradie_analytics",
          ...safeCampaign(attribution()),
        });
      }
      if (!pageViewSent) {
        pageViewSent = true;
        send("page_view", { page_location: `https://${HOST}/`, page_referrer: safeReferrer(referrer), page_title: "Websites for Sydney tradies | Simple Page" });
      }
    }
    const api = {
      choice: () => choice,
      setChoice(value) {
        if (!["accepted", "declined"].includes(value)) return;
        choice = value;
        try { storage.setItem(CHOICE_KEY, value); } catch {}
        if (choice === "accepted") start();
        else { disable(true); stopVisit(); }
      },
      track(input) {
        if (!eligible || choice !== "accepted") return;
        recordVisit();
        const clean = safeEvent(input);
        if (!clean) return;
        const { event, ...params } = clean;
        send(event, params);
      },
    };
    disable(choice !== "accepted");
    start();
    return api;
  }

  if (typeof module !== "undefined" && module.exports)
    module.exports = { createAnalytics, safeEvent, safeCampaign, safeReferrer, CHOICE_KEY };
  if (!root?.document || root.tradieAnalytics) return;
  const doc = root.document;
  let storage;
  try { storage = root.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
  const layer = root.tradieAnalyticsLayer = root.tradieAnalyticsLayer || [];
  function gtag() { layer.push(arguments); }
  const api = createAnalytics({
    location: root.location, storage, referrer: doc.referrer,
    attribution: () => {
      try { return root.tradieFunnel?.latestAttribution()?.utm_source ? root.tradieFunnel.latestAttribution() : root.tradieFunnel?.attribution() || JSON.parse(root.sessionStorage.getItem("tradie_entry") || "{}"); }
      catch { return {}; }
    },
    recordVisit: () => root.tradieVisit?.start(),
    stopVisit: () => root.tradieVisit?.stop(),
    disable: (disabled) => {
      root[`ga-disable-${ID}`] = disabled;
      if (disabled) {
        // Only this adapter's host-only analytics cookies, never staff sessions.
        doc.cookie.split(";").forEach((cookie) => {
          const name = cookie.trim().split("=")[0];
          if (name.startsWith("tradie_analytics")) doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        });
      }
    },
    load: (config) => {
      gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("set", "ads_data_redaction", true);
      gtag("js", new Date());
      gtag("config", ID, config);
      const script = doc.createElement("script");
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}&l=tradieAnalyticsLayer`;
      doc.head.appendChild(script);
    },
    send: (event, params) => gtag("event", event, { ...params, send_to: ID }),
  });
  root.tradieAnalytics = api;
  // Subscribe to future safe funnel events. Never replay pre-consent activity.
  const funnelLayer = root.dataLayer = root.dataLayer || [];
  const previousPush = funnelLayer.push;
  funnelLayer.push = function (...items) {
    const result = previousPush.apply(this, items);
    items.forEach((item) => api.track(item));
    return result;
  };
  const panel = doc.getElementById("analyticsChoice");
  const status = doc.getElementById("analyticsChoiceStatus");
  function render() {
    if (panel) panel.hidden = Boolean(api.choice());
    if (status) status.textContent = api.choice() === "accepted" ? "Optional analytics is on." : "Optional analytics is off.";
  }
  root.addEventListener("storage", (event) => {
    if (event.storageArea !== storage || (event.key !== CHOICE_KEY && event.key !== null)) return;
    api.setChoice(event.newValue === "accepted" ? "accepted" : "declined");
    render();
  });
  doc.querySelectorAll("[data-analytics-choice]").forEach((button) => {
    button.addEventListener("click", () => { api.setChoice(button.dataset.analyticsChoice); render(); });
  });
  doc.querySelectorAll("[data-analytics-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!panel) return;
      panel.hidden = false;
      panel.querySelector("button")?.focus();
    });
  });
  render();
})(typeof window === "undefined" ? null : window);
