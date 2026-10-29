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
        throw Object.assign(
          new Error(
            data.error ||
              "The request did not complete. Your details are still here. Please retry or email hello@simplepage.com.au.",
          ),
          { field: data.field },
        );
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "The request timed out. Please retry with the same details.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "We could not connect. Your details are still here. Please retry or call (02) 8958 8545.",
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
      status.classList.add("error");
      window.tradieFunnel?.track("form_error", {
        form_kind: "main",
        field: "phone",
      });
      form.elements.phone.setAttribute("aria-invalid", "true");
      form.elements.phone.focus();
      return;
    }
    data.transcript = transcript || [];
    Object.assign(data, window.tradieFunnel?.attribution());
    const signature = JSON.stringify(data);
    if (signatures.get(form) !== signature) {
      eventIds.set(form, crypto.randomUUID());
      signatures.set(form, signature);
    }
    data.event_id = eventIds.get(form);
    button.disabled = true;
    status.classList.remove("error");
    for (const field of form.elements) field.removeAttribute("aria-invalid");
    window.tradieFunnel?.track("form_submitted", { form_kind: "main" });
    status.textContent = "Sending your request…";
    try {
      const result = await request(url, data);
      const saved = `Your request is saved as SP-${result.id}.`;
      status.textContent = result.duplicate
        ? `${saved} The team already has your enquiry.`
        : result.notification_sent
          ? `${saved} We’ll contact you to discuss your website.${data.email && !result.confirmation_sent ? " Your email receipt could not be sent." : ""}`
          : `${saved} The notification email could not be sent. Your enquiry is in our dashboard. You can also call (02) 8958 8545.`;
      status.dataset.saved = "true";
      button.textContent = "Enquiry saved";
      status.setAttribute("tabindex", "-1");
      status.focus();
      window.tradieFunnel?.track("enquiry_saved", {
        form_kind: "main",
        reference: result.id,
        duplicate: result.duplicate,
      });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
      window.tradieFunnel?.track("form_error", {
        form_kind: "main",
        field: error.field || "form",
      });
      const field = form.elements[error.field];
      if (field) {
        field.setAttribute("aria-invalid", "true");
        field.focus();
      } else {
        status.setAttribute("tabindex", "-1");
        status.focus();
      }
      button.disabled = false;
    }
  }
  if ("IntersectionObserver" in window)
    new IntersectionObserver((entries) => {
      document.body.classList.toggle(
        "contact-visible",
        entries.some((entry) => entry.isIntersecting),
      );
    }).observe($("#contact"));
  $("#enquiryForm").addEventListener("input", (event) =>
    event.target.removeAttribute("aria-invalid"),
  );
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
      button.textContent = "Send my website enquiry";
      status.textContent = "";
      status.dataset.saved = "false";
    }
  });
})();
