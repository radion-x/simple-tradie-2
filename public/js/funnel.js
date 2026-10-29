(function (root) {
  const campaignKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "msclkid",
  ];
  const limits = {
    landing_path: 2048,
    referrer_host: 255,
    utm_source: 255,
    utm_medium: 255,
    utm_campaign: 255,
    utm_content: 255,
    utm_term: 255,
    gclid: 500,
    fbclid: 500,
    msclkid: 500,
  };
  function createFunnel({ location, storage, referrer = "", emit }) {
    let first = {};
    try {
      first = JSON.parse(storage.getItem("tradie_entry") || "{}");
    } catch {}
    if (!first || typeof first !== "object" || Array.isArray(first)) first = {};
    if (!first.landing_path) {
      first = { landing_path: location.pathname };
      const params = new URLSearchParams(location.search);
      for (const key of campaignKeys)
        if (params.has(key)) first[key] = params.get(key);
      try {
        const host = new URL(referrer).hostname;
        if (host !== location.hostname) first.referrer_host = host;
      } catch {}
    }
    const attribution = {};
    for (const [key, max] of Object.entries(limits))
      if (typeof first[key] === "string")
        attribution[key] = first[key]
          .replace(/[\u0000-\u001F\u007F]/g, "")
          .slice(0, max);
    if (!attribution.landing_path?.startsWith("/"))
      attribution.landing_path = location.pathname;
    try {
      storage.setItem("tradie_entry", JSON.stringify(attribution));
    } catch {}
    const saved = new Set();
    function track(event, data = {}) {
      if (
        ![
          "cta_clicked",
          "phone_clicked",
          "form_viewed",
          "form_started",
          "form_error",
          "form_submitted",
          "enquiry_saved",
        ].includes(event)
      )
        return;
      if (event === "enquiry_saved") {
        if (data.duplicate) return;
        const key = String(data.reference || "");
        if (key && saved.has(key)) return;
        if (key) saved.add(key);
      }
      const payload = { event, funnel: "tradie_website" };
      if (
        ["main", "callback", "transcript", "chatbot"].includes(data.form_kind)
      )
        payload.form_kind = data.form_kind;
      if (
        ["hero", "pricing", "contact", "header", "footer", "other"].includes(
          data.placement,
        )
      )
        payload.placement = data.placement;
      if (["name", "email", "phone", "consent", "form"].includes(data.field))
        payload.field = data.field;
      emit(payload);
    }
    return { attribution: () => ({ ...attribution }), track };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { createFunnel };
  if (!root?.document) return;
  let storage;
  try {
    storage = root.sessionStorage;
  } catch {
    storage = { getItem: () => null, setItem: () => {} };
  }
  root.tradieFunnel = createFunnel({
    location: root.location,
    storage,
    referrer: root.document.referrer,
    emit: (event) => {
      root.dataLayer = root.dataLayer || [];
      root.dataLayer.push(event);
    },
  });
  const started = new WeakSet();
  for (const form of root.document.querySelectorAll(
    "#enquiryForm,#transcriptForm",
  )) {
    const form_kind = form.id === "enquiryForm" ? "main" : "transcript";
    form.addEventListener("focusin", () => {
      if (!started.has(form)) {
        started.add(form);
        root.tradieFunnel.track("form_started", { form_kind });
      }
    });
    form.addEventListener(
      "invalid",
      (event) =>
        root.tradieFunnel.track("form_error", {
          form_kind,
          field: event.target.name || "form",
        }),
      true,
    );
    if ("IntersectionObserver" in root) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          root.tradieFunnel.track("form_viewed", { form_kind });
          observer.disconnect();
        }
      });
      observer.observe(form);
    }
  }
  root.document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const placement = link.closest("header")
      ? "header"
      : link.closest("footer")
        ? "footer"
        : link.closest("#pricing")
          ? "pricing"
          : link.closest("#contact")
            ? "contact"
            : link.closest(".hero")
              ? "hero"
              : "other";
    if (link.getAttribute("href") === "#contact")
      root.tradieFunnel.track("cta_clicked", { placement });
    if (link.getAttribute("href")?.startsWith("tel:"))
      root.tradieFunnel.track("phone_clicked", { placement });
  });
})(typeof window === "undefined" ? null : window);
