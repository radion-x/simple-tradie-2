(() => {
  const $ = (selector) => document.querySelector(selector);
  const chat = $("#chatWindow"),
    messages = $("#chatMessages"),
    input = $("#chatInput");
  let history = [],
    transcript = [],
    chatting = false;
  const sessionId = crypto.randomUUID();
  let transcriptEventId = crypto.randomUUID();
  function chatMessage(role, text) {
    const el = document.createElement("div");
    el.className = `chat-message ${role}`;
    el.textContent = text;
    messages.append(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }
  chatMessage(
    "assistant",
    "Hi, I’m the Simple Page website assistant. I can help with website packages, your existing site or requesting a callback. How can I help?",
  );
  $("#chatToggle").addEventListener("click", () => {
    chat.hidden = !chat.hidden;
    $("#chatToggle").setAttribute("aria-expanded", !chat.hidden);
    if (!chat.hidden) input.focus();
  });
  $("#chatClose").addEventListener("click", () => {
    chat.hidden = true;
    $("#chatToggle").setAttribute("aria-expanded", "false");
    $("#chatToggle").focus();
  });
  chat.addEventListener("keydown", (event) => {
    if (event.key === "Escape") $("#chatClose").click();
  });
  fetch("/api/chat/config")
    .then((res) => res.json())
    .then((config) => {
      if (!config.callbacksEnabled) $(".chat-callback").hidden = true;
      if (!config.available) {
        input.disabled = true;
        input.placeholder = "Request a callback below";
        $("#chatForm button").disabled = true;
        return;
      }
      (config.suggestedQuestions || []).forEach((question) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = question;
        button.addEventListener("click", () => {
          input.value = question;
          $("#chatForm").requestSubmit();
        });
        $("#chatSuggestions").append(button);
      });
    })
    .catch(() => {});
  $("#chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || chatting) return;
    chatting = true;
    input.value = "";
    input.disabled = true;
    $("#chatForm button").disabled = true;
    $("#chatSuggestions").hidden = true;
    chatMessage("user", message);
    const reply = chatMessage("assistant", "Thinking…");
    let answer = "";
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, transcript, sessionId }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "The assistant is unavailable. Please call (02) 8958 8545 or use our enquiry form.",
        );
      if (
        !(response.headers.get("content-type") || "").includes(
          "text/event-stream",
        )
      ) {
        const result = await response.json();
        answer = result.response || result.message || result.content || "";
      } else {
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), {
            stream: !done,
          });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ") || line.slice(6).trim() === "[DONE]")
              continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error || data.tool_error)
                throw new Error(data.error || data.tool_error);
              if (
                data.tool_name === "request_callback" &&
                data.tool_result?.success
              )
                chatMessage(
                  "assistant",
                  `Your callback request is saved. Reference ${data.tool_result.referenceId}. The team will contact you to discuss your website.`,
                );
              const content =
                data.choices?.[0]?.delta?.content || data.content || "";
              if (content) {
                answer += content;
                reply.textContent = answer;
                messages.scrollTop = messages.scrollHeight;
              }
              if (data.tool_status && !answer)
                reply.textContent = data.tool_status;
            } catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
            }
          }
          if (done) break;
        }
      }
      reply.textContent =
        answer ||
        "Please contact Simple Page on (02) 8958 8545 so we can help with your enquiry.";
      history.push(
        { role: "user", content: message },
        { role: "assistant", content: reply.textContent },
      );
      transcript.push(
        { role: "user", content: message },
        { role: "assistant", content: reply.textContent },
      );
      history = history.slice(-10);
    } catch (error) {
      reply.textContent =
        error.name === "AbortError"
          ? "That took longer than expected. Please try again or call (02) 8958 8545."
          : error.message;
    } finally {
      clearTimeout(timeout);
      chatting = false;
      input.disabled = false;
      $("#chatForm button").disabled = false;
      input.focus();
    }
  });

  $("#transcriptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("#transcriptStatus");
    if (chatting || !history.length) {
      status.textContent = "Start a conversation first, then email it here.";
      return;
    }
    const button = $("#transcriptForm button");
    button.disabled = true;
    status.textContent = "Sending…";
    try {
      const response = await fetch("/api/chat/email-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Chat transcript request",
          email: $("#transcriptEmail").value,
          phone: "",
          message: "Requested conversation transcript",
          consent: $("#transcriptForm input[name=consent]").checked,
          transcript,
          sessionId,
          event_id: transcriptEventId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to send. Please try again.");
      status.textContent = result.confirmation_sent
        ? "Your conversation has been submitted for email delivery."
        : "Your conversation is saved, but the email could not be sent. Contact hello@simplepage.com.au.";
      transcriptEventId = crypto.randomUUID();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  // Keep enquiry details in the form after failures; only clear after a saved lead.
  function leadEvent(type, kind) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "tradie_form_" + type, form_kind: kind });
  }
  document
    .querySelectorAll('[data-lead-form="callback"]')
    .forEach((leadForm) => {
      const kind = leadForm.dataset.leadForm,
        status = leadForm.querySelector(".lead-status");
      let leadEventId = crypto.randomUUID(),
        started = false,
        sending = false,
        completed = false;
      const viewObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          leadEvent("view", kind);
          viewObserver.disconnect();
        }
      });
      viewObserver.observe(leadForm);
      leadForm.addEventListener("input", () => {
        if (!started) {
          leadEvent("start", kind);
          started = true;
        }
      });
      leadForm.addEventListener(
        "invalid",
        () => leadEvent("error", kind),
        true,
      );
      leadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (sending || completed) return;
        if (kind === "callback" && chatting) {
          status.textContent =
            "Please wait for the assistant to finish, then request your callback.";
          return;
        }
        const submit = leadForm.querySelector("button[type=submit]"),
          original = submit.innerHTML;
        const data = Object.fromEntries(new FormData(leadForm));
        data.event_id = leadEventId;
        data.landing_path = location.pathname;
        const params = new URLSearchParams(location.search);
        [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "utm_term",
          "gclid",
          "fbclid",
          "msclkid",
        ].forEach((key) => {
          if (params.has(key)) data[key] = params.get(key);
        });
        if (kind === "callback") data.transcript = transcript;
        sending = true;
        submit.disabled = true;
        submit.textContent = "Sending…";
        status.textContent = "";
        status.classList.remove("error");
        leadEvent("submit", kind);
        try {
          const response = await fetch(
            kind === "callback" ? "/api/chat/callback" : "/api/contact",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "Please try again or call (02) 8958 8545.",
            );
          completed = true;
          leadForm.reset();
          status.textContent =
            (kind === "callback"
              ? "Your callback request is saved. The team will contact you to arrange the next step."
              : "Your message is saved. The team will be in touch.") +
            ` Reference: ${result.referenceId}.`;
          if (result.notification_sent === false)
            status.textContent +=
              " For an urgent enquiry, please call (02) 8958 8545.";
          submit.innerHTML =
            'Request received <span aria-hidden="true">✓</span>';
          status.setAttribute("tabindex", "-1");
          status.focus();
          leadEvent("success", kind);
          if (kind === "callback") chatMessage("assistant", status.textContent);
        } catch (error) {
          status.textContent = error.message;
          status.classList.add("error");
          leadEvent("error", kind);
        } finally {
          sending = false;
          if (!completed) {
            submit.disabled = false;
            submit.innerHTML = original;
          }
        }
      });
    });
})();
