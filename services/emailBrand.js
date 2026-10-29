const BRAND = {
  cobalt: "#1747D1",
  cobaltDark: "#0D2D87",
  cobaltSoft: "#DCE6FF",
  ink: "#111827",
  muted: "#556276",
  line: "#C8D1DD",
  paper: "#FFFFFF",
  canvas: "#F3F5F7",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteUrl() {
  return String(process.env.SITE_URL || "").replace(/\/$/, "");
}

function fieldTable(fields) {
  const rows = fields
    .filter(
      (field) =>
        field.value !== undefined && field.value !== null && field.value !== "",
    )
    .map(
      (field) =>
        `<tr><td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.muted};font-size:13px;vertical-align:top;width:38%;">${escapeHtml(field.label)}</td><td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.ink};font-size:14px;font-weight:700;vertical-align:top;">${escapeHtml(field.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 18px;color:${BRAND.ink};font-size:16px;line-height:1.65;">${escapeHtml(text)}</p>`;
}

function note(text) {
  return `<div style="margin:24px 0;padding:16px 18px;border-left:3px solid ${BRAND.cobalt};background:${BRAND.cobaltSoft};color:${BRAND.ink};font-size:14px;line-height:1.6;">${escapeHtml(text)}</div>`;
}

function messageBlock(label, value) {
  if (!value) return "";
  return `<div style="margin-top:24px;"><p style="margin:0 0 8px;color:${BRAND.muted};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(label)}</p><div style="padding:16px 18px;border:1px solid ${BRAND.line};background:#F8FAFC;color:${BRAND.ink};font-size:14px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(value)}</div></div>`;
}

function button(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${BRAND.cobalt};border-radius:8px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

function brandedEmail({ eyebrow, title, intro, body = "", footer = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background:${BRAND.canvas};font-family:Arial,'Helvetica Neue',sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro || title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};border-collapse:collapse;"><tr><td align="center" style="padding:32px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-collapse:collapse;"><tr><td style="height:6px;background:${BRAND.cobalt};font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:28px 34px 22px;border-bottom:1px solid ${BRAND.line};"><span style="color:${BRAND.ink};font-size:23px;font-weight:800;letter-spacing:-.04em;">Simple Page</span></td></tr><tr><td style="padding:34px;"><p style="margin:0 0 10px;color:${BRAND.cobalt};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p><h1 style="margin:0 0 18px;color:${BRAND.ink};font-size:30px;line-height:1.18;letter-spacing:-.025em;">${escapeHtml(title)}</h1>${intro ? paragraph(intro) : ""}${body}</td></tr><tr><td style="padding:22px 34px;background:#F8FAFC;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6;"><strong style="color:${BRAND.ink};">Simple Page Pty Ltd</strong><br>Sydney, Australia<br><a href="mailto:hello@simplepage.com.au" style="color:${BRAND.cobaltDark};">hello@simplepage.com.au</a>${footer ? `<div style="margin-top:10px;">${escapeHtml(footer)}</div>` : ""}</td></tr></table></td></tr></table></body></html>`;
}

module.exports = {
  brandedEmail,
  button,
  escapeHtml,
  fieldTable,
  messageBlock,
  note,
  paragraph,
  siteUrl,
};
