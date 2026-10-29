// Approved scope: one site-specific $5/month key and a key-only model allowlist.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");
const service = "openrouter-tradie-simplepage-api-key",
  name = "Tradie Simple Page Production",
  guardrailName = "Tradie Simple Page GPT-5.4 Mini";
function secret(service) {
  return execFileSync(
    "security",
    ["find-generic-password", "-a", "rad", "-s", service, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}
(async () => {
  const headers = {
    Authorization: `Bearer ${secret("openrouter-management-api-key")}`,
  };
  const api = axios.create({
    baseURL: "https://openrouter.ai/api/v1",
    headers,
    timeout: 20000,
  });
  const keys = (await api.get("/keys")).data.data;
  let info = keys.find((item) => item.name === name),
    key;
  if (info) {
    key = secret(service);
    if (info.limit !== 5 || info.limit_reset !== "monthly")
      throw new Error("Existing site key does not match approved cap");
  } else {
    const response = (
      await api.post("/keys", {
        name,
        limit: 5,
        limit_reset: "monthly",
        include_byok_in_limit: true,
      })
    ).data;
    info = response.data;
    key = response.key;
    execFileSync(
      "security",
      ["add-generic-password", "-U", "-a", "rad", "-s", service, "-w", key],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  }
  const guards = (await api.get("/guardrails")).data.data;
  let guard = guards.find((item) => item.name === guardrailName);
  if (!guard)
    guard = (
      await api.post("/guardrails", {
        name: guardrailName,
        description:
          "Dedicated to tradie.simplepage.com.au. Restricts this site key to the approved model.",
        allowed_models: ["openai/gpt-5.4-mini"],
      })
    ).data.data;
  const catalogue = (await api.get("/models")).data.data;
  const model = catalogue.find((item) => item.id === "openai/gpt-5.4-mini");
  if (
    guard.allowed_models?.length !== 1 ||
    !["openai/gpt-5.4-mini", model?.canonical_slug].includes(
      guard.allowed_models[0],
    )
  )
    throw new Error("Unexpected existing model restriction");
  await api.post(`/guardrails/${guard.id}/assignments/keys`, {
    key_hashes: [info.hash],
  });
  const current = (
    await axios.get("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 15000,
    })
  ).data.data;
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-5.4-mini",
      messages: [{ role: "user", content: "Reply with ready." }],
      max_tokens: 20,
    },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 25000 },
  );
  let otherModelBlocked = false;
  try {
    await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-chat-v3-0324",
        messages: [{ role: "user", content: "Reply with ready." }],
        max_tokens: 1,
      },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 15000 },
    );
  } catch (error) {
    otherModelBlocked =
      [403, 404].includes(error.response?.status) &&
      /guardrail|blocked/i.test(error.response?.data?.error?.message || "");
  }
  const report = {
    name,
    site: "https://tradie.simplepage.com.au",
    limit_usd: current.limit,
    limit_reset: current.limit_reset,
    include_byok_in_limit: current.include_byok_in_limit,
    model: "openai/gpt-5.4-mini",
    other_model_blocked: otherModelBlocked,
    provider_reply: response.data.choices?.[0]?.message?.content,
    verification_cost_usd: response.data.usage?.cost,
    stored_in: "macOS Keychain",
    installed_in_deployment: false,
  };
  fs.writeFileSync(
    path.join(__dirname, "../outputs/production-ai-configuration.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})().catch((error) => {
  console.error(
    "AI provisioning failed:",
    error.response?.status || error.message,
  );
  process.exitCode = 1;
});
