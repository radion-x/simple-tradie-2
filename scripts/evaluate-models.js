// Explicitly bounded model validation using the existing local inference key.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const axios = require("axios");
const key = execFileSync(
  "security",
  [
    "find-generic-password",
    "-a",
    "rad",
    "-s",
    "openrouter-inference-api-key",
    "-w",
  ],
  { encoding: "utf8" },
).trim();
const headers = { Authorization: `Bearer ${key}` };
const names = ["openai/gpt-5.4-mini"];
const prompt = fs.readFileSync(path.join(__dirname, "../prompt.md"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../routes/ai.js"), "utf8");
const toolArray = source
  .slice(
    source.indexOf("const tools = [") + "const tools = ".length,
    source.indexOf("const activeTools"),
  )
  .replace(/;\s*$/, "")
  .trim();
const tools = Function(`return ${toolArray}`)().filter(
  (tool) => tool.function.name === "request_callback",
);
const cases = [
  {
    id: "package-and-unknowns",
    messages: [
      {
        role: "user",
        content:
          "I am a plumber in Penrith. How much is your website, what do I get and who owns it? Can you guarantee it will be live this Friday? Keep it short.",
      },
    ],
  },
  {
    id: "discount-and-fit",
    messages: [
      {
        role: "user",
        content:
          "Can you do it for $699 and guarantee 10 roofing jobs a week? I already have a Facebook page. What would you need from me? Keep it short.",
      },
    ],
  },
  {
    id: "callback-tool",
    messages: [
      {
        role: "user",
        content:
          "I want a callback about a website. My name is Test Tradie and my email is synthetic@example.invalid. I consent to saving my callback request with these details. Please call after 4pm on weekdays.",
      },
    ],
  },
];
(async () => {
  const status = (
    await axios.get("https://openrouter.ai/api/v1/key", {
      headers,
      timeout: 15000,
    })
  ).data.data;
  const remaining =
    status.limit_remaining ??
    (status.limit == null ? null : status.limit - status.usage);
  if (remaining == null || remaining < 0.05)
    throw new Error("At least $0.05 verified test-key allowance is required.");
  const catalogue = (
    await axios.get("https://openrouter.ai/api/v1/models", { timeout: 15000 })
  ).data.data;
  const initial = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../outputs/model-comparison-initial.json"),
      "utf8",
    ),
  );
  const results = [];
  let cumulative = initial.observed_cost_usd;
  for (const name of names) {
    const model = catalogue.find((model) => model.id === name);
    if (!model) {
      results.push({ model: name, error: "Not found in live catalogue" });
      continue;
    }
    const inputRate = Number(model.pricing.prompt),
      outputRate = Number(model.pricing.completion);
    if (
      !Number.isFinite(inputRate) ||
      !Number.isFinite(outputRate) ||
      inputRate > 0.000001 ||
      outputRate > 0.000005
    )
      throw new Error("Unexpected catalogue pricing");
    for (const sample of cases) {
      // Conservative 5,000 input token reservation plus output cap. This check precedes each request.
      const reservation = 5000 * inputRate + 1000 * outputRate;
      if (cumulative + reservation > 0.05)
        throw new Error("Comparison reached its $0.05 safety ceiling");
      const start = Date.now();
      try {
        const response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: name,
            messages: [{ role: "system", content: prompt }, ...sample.messages],
            tools,
            max_tokens: 1000,
            temperature: 0.3,
            stream: false,
          },
          { headers, timeout: 45000 },
        );
        const usage = response.data.usage || {};
        const cost = Number(
          usage.cost ??
            (usage.prompt_tokens || 5000) * inputRate +
              (usage.completion_tokens || 1000) * outputRate,
        );
        cumulative += cost;
        if (!Number.isFinite(cost) || cost > reservation)
          throw new Error("Unexpected request cost");
        results.push({
          model: name,
          case: sample.id,
          elapsed_ms: Date.now() - start,
          usage,
          finish_reason: response.data.choices?.[0]?.finish_reason,
          reply: {
            content: response.data.choices?.[0]?.message?.content,
            tool_calls: response.data.choices?.[0]?.message?.tool_calls,
          },
          input_usd_per_million: inputRate * 1e6,
          output_usd_per_million: outputRate * 1e6,
        });
      } catch (error) {
        if (!error.response) throw error;
        results.push({
          model: name,
          case: sample.id,
          status: error.response.status,
          error: String(
            error.response.data?.error?.message || "Provider request failed",
          ).slice(0, 200),
        });
      }
    }
  }
  const report = {
    evaluated_at: new Date().toISOString(),
    max_test_cost_usd: 0.05,
    observed_cost_usd: cumulative,
    initial_cost_usd: initial.observed_cost_usd,
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, "../outputs/model-comparison.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
