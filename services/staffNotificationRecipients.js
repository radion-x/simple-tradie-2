// Mailgun's native bcc field is an envelope recipient, never a custom header.
function staffNotificationRecipients(env = process.env) {
  const bcc = (env.EMAIL_BCC || env.BCC_EMAIL || "").trim();
  return { to: env.EMAIL_TO || env.RECIPIENT_EMAIL, ...(bcc ? { bcc } : {}) };
}
module.exports = { staffNotificationRecipients };
