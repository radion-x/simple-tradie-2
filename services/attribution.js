const ATTRIBUTION_LIMITS = {
  event_id: 64,
  funnel: 64,
  landing_path: 2048,
  referrer_host: 255,
  utm_source: 255,
  utm_medium: 255,
  utm_campaign: 255,
  utm_content: 255,
  utm_term: 255,
  fbclid: 500,
  gclid: 500,
  msclkid: 500,
};

function cleanValue(value, maxLength) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);
  return cleaned || null;
}

function extractAttribution(payload = {}) {
  const attribution = {};
  for (const [key, maxLength] of Object.entries(ATTRIBUTION_LIMITS)) {
    attribution[key] = cleanValue(payload[key], maxLength);
  }

  if (
    attribution.event_id &&
    !/^[A-Za-z0-9_-]{8,64}$/.test(attribution.event_id)
  ) {
    attribution.event_id = null;
  }
  if (attribution.landing_path && !attribution.landing_path.startsWith("/")) {
    attribution.landing_path = null;
  }
  if (
    attribution.referrer_host &&
    !/^[A-Za-z0-9.-]+$/.test(attribution.referrer_host)
  ) {
    attribution.referrer_host = null;
  }

  return attribution;
}

module.exports = {
  ATTRIBUTION_LIMITS,
  extractAttribution,
};
