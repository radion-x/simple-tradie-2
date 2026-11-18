const {
  staffNotificationRecipients,
} = require("./staffNotificationRecipients");
const crypto = require("node:crypto");
const {
  brandedEmail,
  fieldTable,
  messageBlock,
  button,
  siteUrl,
} = require("./emailBrand");
const { extractAttribution } = require("./attribution");
function validateLead(body, source) {
  const data = {};
  // The main form accepts a single reply address. Keep the separate fields for
  // chat, older clients and any open form from before the page update.
  const combinedReply = source === "contact_form" && body.reply_to != null;
  if (combinedReply) {
    if (typeof body.reply_to !== "string" || !body.reply_to.trim())
      return { error: "Enter a phone number or email address.", field: "reply_to" };
    const reply = body.reply_to.trim();
    body = { ...body, phone: "", email: "", [reply.includes("@") ? "email" : "phone"]: reply };
  }
  for (const [field, max] of Object.entries({
    name: 120,
    email: 254,
    phone: 40,
    message: 3000,
    preferred_time: 120,
    service: 160,
  })) {
    if (body[field] != null && typeof body[field] !== "string")
      return { error: "Please check your contact details." };
    data[field] = (body[field] || "").trim();
    if (data[field].length > max || /\x00/.test(data[field]))
      return { error: `Please shorten the ${field.replace("_", " ")} field.`, field: combinedReply && ["phone", "email"].includes(field) ? "reply_to" : field };
  }
  if (!data.name) return { error: "Please enter your name.", field: "name" };
  if (
    data.email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      /[\r\n]/.test(data.email))
  )
    return { error: "Please enter a valid email address.", field: combinedReply ? "reply_to" : "email" };
  if (
    data.phone &&
    (!/^[+\d\s().-]{8,30}$/.test(data.phone) ||
      data.phone.replace(/\D/g, "").length < 8)
  )
    return combinedReply
      ? { error: "Enter a valid phone number or email address.", field: "reply_to" }
      : { error: "Please enter a valid phone number.", field: "phone" };
  if (source === "chat_booking" && !data.phone && !data.email)
    return {
      error: "Please provide a phone number or email for your callback.",
    };
  if (!data.email && !data.phone)
    return { error: "Please provide a phone number or email address." };
  if (body.consent !== true && body.consent !== "true")
    return { error: "Please agree to being contacted about your enquiry." };
  const transcript = body.transcript || [];
  if (
    !Array.isArray(transcript) ||
    transcript.length > 100 ||
    transcript.some(
      (item) =>
        !item ||
        !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" ||
        item.content.length > 6000,
    ) ||
    transcript.reduce((n, item) => n + item.content.length, 0) > 60000
  )
    return { error: "Please send a shorter conversation." };
  data.preferred_contact_method = ["phone", "email", "sms", "any"].includes(
    body.preferred_contact_method,
  )
    ? body.preferred_contact_method
    : data.email
      ? "email"
      : "phone";
  data.conversation = transcript
    .map(
      (item) =>
        `${item.role === "user" ? "Customer" : "Simple Page assistant"}: ${item.content}`,
    )
    .join("\n\n");
  data.event_id =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      body.event_id || "",
    )
      ? body.event_id
      : crypto.randomUUID();
  data.pagePlan = combinedReply;
  data.attribution = extractAttribution(body);
  return { data };
}
async function captureLead(data, source, { database, mailer }) {
  if (
    !["contact_form", "chat_booking", "chatbot", "download_chat"].includes(
      source,
    )
  )
    throw new Error("Invalid lead source");
  const attribution = data.attribution || {};
  const result = await database.query(
    `INSERT INTO callback_requests(name,phone,email,message,preferred_time,preferred_contact_method,conversation_context,source,service,event_id,funnel,landing_path,utm_source,utm_medium,utm_campaign,utm_content,utm_term,gclid,fbclid,msclkid,quote_details,referrer_host,visit_id,latest_utm_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$20,$9,'tradie_website',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$21,(SELECT id FROM campaign_visits WHERE id=$22),$23) ON CONFLICT(event_id) WHERE event_id IS NOT NULL DO NOTHING RETURNING id`,
    [
      data.name,
      data.phone || null,
      data.email || null,
      data.message,
      data.preferred_time || "As soon as possible",
      data.preferred_contact_method,
      data.conversation,
      source,
      data.event_id,
      attribution.landing_path,
      attribution.utm_source,
      attribution.utm_medium,
      attribution.utm_campaign,
      attribution.utm_content,
      attribution.utm_term,
      attribution.gclid,
      attribution.fbclid,
      attribution.msclkid,
      JSON.stringify({
        consent: true,
        consent_at: new Date().toISOString(),
        ...(data.pagePlan ? { request: "three_page_plan" } : {}),
      }),
      data.service || (data.pagePlan ? "Three-page website plan" : "Tradie website enquiry"),
      attribution.referrer_host,
      attribution.visit_id,
      attribution.latest_utm_source,
    ],
  );
  if (!result.rows.length) {
    const existing = (
      await database.query(
        "SELECT id,notification_status FROM callback_requests WHERE event_id=$1 AND source=$2",
        [data.event_id, source],
      )
    ).rows[0];
    if (!existing) throw new Error("Enquiry reference already used");
    return {
      success: true,
      id: existing.id,
      reference: existing.id,
      referenceId: `SP-${existing.id}`,
      notification_sent: existing.notification_status === "sent",
      duplicate: true,
    };
  }
  const id = result.rows[0].id,
    reference = `SP-${id}`,
    callback = source === "chat_booking" || source === "chatbot";
  const fields = [
    ...(data.pagePlan ? [{ label: "Requested", value: "Three-page website plan and relevant work example" }] : []),
    { label: "Name", value: data.name },
    { label: "Phone", value: data.phone || "Not supplied" },
    { label: "Email", value: data.email || "Not supplied" },
    { label: "Preferred contact", value: data.preferred_contact_method },
    {
      label: "Preferred time",
      value: data.preferred_time || "As soon as possible",
    },
    { label: "Reference", value: reference },
    { label: "Trade / business", value: data.service || "To discuss" },
  ];
  const from =
    process.env.EMAIL_FROM ||
    `Simple Page <noreply@${process.env.MAILGUN_DOMAIN}>`;
  let notificationSent = false,
    confirmationSent = false;
  try {
    await mailer.messages().send({
      from,
      ...staffNotificationRecipients(),
      ...(data.email ? { "h:Reply-To": data.email } : {}),
      subject: `Simple Page ${callback ? "callback request" : "contact enquiry"} | ${data.name} | ${reference}`,
      html: brandedEmail({
        eyebrow: callback ? "Callback request" : "Contact enquiry",
        title: `A new enquiry from ${data.name}`,
        intro: "Saved in the Simple Page lead dashboard.",
        body:
          fieldTable([
            ...fields,
            { label: "Campaign source", value: attribution.utm_source },
            { label: "Campaign", value: attribution.utm_campaign },
            { label: "Ad / creative", value: attribution.utm_content },
            { label: "Entry page", value: attribution.landing_path },
          ]) +
          messageBlock("Customer message", data.message) +
          messageBlock("Full chat conversation", data.conversation) +
          button(
            "View this enquiry",
            `${siteUrl()}/admin/callbacks.html?id=${id}`,
          ),
      }),
      text: `${reference}\nCampaign source: ${attribution.utm_source || "Not supplied"}\nCampaign: ${attribution.utm_campaign || "Not supplied"}\nAd: ${attribution.utm_content || "Not supplied"}\n${fields.map((item) => `${item.label}: ${item.value}`).join("\n")}\n\nCustomer message:\n${data.message}\n\nFull chat conversation:\n${data.conversation}`,
    });
    notificationSent = true;
  } catch (error) {
    console.error(
      `Simple Page lead #${id} notification failed:`,
      error.status || "delivery error",
    );
  }
  await database.query(
    "UPDATE callback_requests SET notification_status=$1 WHERE id=$2",
    [notificationSent ? "sent" : "failed", id],
  );
  if (data.email) {
    const receiptIntro = data.pagePlan
      ? "We’ll reply with a relevant website example and a suggested plan for your three pages."
      : callback
        ? "We’ve received your callback request. The team will contact you to arrange the next step."
        : "We’ve received your message. The team will contact you about your enquiry.";
    const receiptFooter = callback
      ? "A callback request is not a confirmed appointment. Call (02) 8958 8545 if you would prefer to speak with us."
      : "Prefer to speak with us? Call (02) 8958 8545.";
    try {
      await mailer.messages().send({
        from,
        to: data.email,
        "h:Reply-To": "hello@simplepage.com.au",
        subject: `Your ${callback ? "callback request" : "enquiry"} | Simple Page | ${reference}`,
        html: brandedEmail({
          eyebrow: "Enquiry received",
          title: `Thank you, ${data.name}`,
          intro: receiptIntro,
          body:
            fieldTable(fields) +
            messageBlock("Your message", data.message) +
            messageBlock("Your chat conversation", data.conversation),
          footer: receiptFooter,
        }),
        text: `Thank you, ${data.name}. ${receiptIntro}\nReference: ${reference}\nPreferred time: ${data.preferred_time || "As soon as possible"}\n\n${data.message}\n\n${data.conversation}\n\n${receiptFooter}`,
      });
      confirmationSent = true;
    } catch (error) {
      console.error(
        `Simple Page lead #${id} receipt failed:`,
        error.status || "delivery error",
      );
    }
  }
  return {
    success: true,
    id,
    reference: id,
    referenceId: reference,
    notification_sent: notificationSent,
    confirmation_sent: confirmationSent,
  };
}
module.exports = { validateLead, captureLead };
