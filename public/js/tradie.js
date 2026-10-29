(() => {
  const $ = (selector) => document.querySelector(selector);

  const eventIds = new WeakMap();
  const signatures = new WeakMap();
  async function request(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false)
        throw new Error(
          data.error ||
            "The request did not complete. Please try again or email hello@simplepage.com.au.",
        );
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "The request timed out. Please retry with the same details.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function submitLead(form, url, transcript) {
    const button = form.querySelector("button[type=submit]");
    const status = form.querySelector(".form-status");
    const data = Object.fromEntries(new FormData(form));
    data.consent = form.elements.consent.checked;
    if (!data.phone.trim() && !data.email.trim()) {
      status.textContent = "Add a phone number or email so we can contact you.";
      form.elements.phone.focus();
      return;
    }
    data.transcript = transcript || [];
    data.landing_path = location.pathname;
    const params = new URLSearchParams(location.search);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gclid",
      "fbclid",
      "msclkid",
    ])
      if (params.has(key)) data[key] = params.get(key);
    const signature = JSON.stringify(data);
    if (signatures.get(form) !== signature) {
      eventIds.set(form, crypto.randomUUID());
      signatures.set(form, signature);
    }
    data.event_id = eventIds.get(form);
    button.disabled = true;
    status.textContent = "Sending your request…";
    try {
      const result = await request(url, data);
      const saved = `Your request is saved as SP-${result.id}.`;
      status.textContent = result.notification_sent
        ? `${saved} We’ll contact you to discuss your website.${data.email && !result.confirmation_sent ? " Your email receipt could not be sent." : ""}`
        : `${saved} The notification email could not be sent. Your enquiry is in our dashboard. You can also call (02) 8958 8545.`;
      status.dataset.saved = "true";
      button.textContent = "Request saved";
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  }
  $("#enquiryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitLead(event.currentTarget, "/api/send-email");
  });
  $("#enquiryForm").addEventListener("input", () => {
    const form = $("#enquiryForm"),
      status = form.querySelector(".form-status");
    if (status.dataset.saved === "true") {
      const button = form.querySelector("button[type=submit]");
      button.disabled = false;
      button.textContent = "Send my enquiry";
      status.textContent = "";
      status.dataset.saved = "false";
    }
  });
})();
