import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const DEFAULT_MODELS = [
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "deepseek-ai/DeepSeek-V4-Flash-0731",
];
const PRICES = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": { input: 1.04, output: 1.04 },
  "deepseek-ai/DeepSeek-V4-Flash-0731": { input: 0.14, output: 0.28 },
};
const apiKey = process.env.TOGETHER_API_KEY;
assert.ok(apiKey, "TOGETHER_API_KEY is required");

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, value = "true"] = argument.replace(/^--/, "").split("=");
    return [name, value];
  }),
);
const models = args.models?.split(",").filter(Boolean) ?? DEFAULT_MODELS;
const runs = Number.parseInt(args.runs ?? "1", 10);
assert.ok(
  Number.isInteger(runs) && runs > 0 && runs <= 10,
  "--runs must be 1-10",
);

const fixtures = JSON.parse(
  await readFile(
    new URL("../evals/summary-fixtures.json", import.meta.url),
    "utf8",
  ),
);
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary"],
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
  },
};

const rows = [];
for (const model of models) {
  for (const fixture of fixtures) {
    for (let run = 1; run <= runs; run += 1) {
      try {
        rows.push(await benchmark(model, fixture, run));
      } catch (error) {
        rows.push({
          model,
          fixture: fixture.id,
          run,
          latencyMs: 30_000,
          schemaValid: false,
          factualCoverage: 0,
          missingFacts: fixture.requiredFacts,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostUsd: Number.NaN,
          error:
            error instanceof DOMException && error.name === "TimeoutError"
              ? "request timed out after 30 seconds"
              : error instanceof Error
                ? error.message.slice(0, 500)
                : "unknown benchmark error",
        });
      }
    }
  }
}

const summary = models.map((model) => {
  const modelRows = rows.filter((row) => row.model === model);
  return {
    model,
    requests: modelRows.length,
    schemaSuccessRate: ratio(modelRows, (row) => row.schemaValid),
    factualCoverage: average(modelRows.map((row) => row.factualCoverage)),
    p50Ms: percentile(
      modelRows.map((row) => row.latencyMs),
      0.5,
    ),
    p95Ms: percentile(
      modelRows.map((row) => row.latencyMs),
      0.95,
    ),
    averageEstimatedCostUsd: average(
      modelRows.map((row) => row.estimatedCostUsd).filter(Number.isFinite),
    ),
  };
});

console.log(JSON.stringify({ summary, rows }, null, 2));
if (rows.some((row) => !row.schemaValid || row.factualCoverage < 1)) {
  process.exitCode = 1;
}

async function benchmark(model, fixture, run) {
  const startedAt = performance.now();
  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildPrompt(fixture.language) },
        { role: "user", content: fixture.text },
      ],
      reasoning: { enabled: false },
      temperature: 0.2,
      max_tokens: 1_600,
      response_format: {
        type: "json_schema",
        json_schema: { name: "summary", schema },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const latencyMs = performance.now() - startedAt;
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `${model} failed (${response.status}): ${body?.error?.message ?? "unknown error"}`,
    );
  }

  let output;
  let schemaValid = false;
  try {
    output = JSON.parse(body.choices?.[0]?.message?.content ?? "");
    schemaValid =
      typeof output.title === "string" &&
      output.title.length > 0 &&
      typeof output.summary === "string" &&
      output.summary.length > 0 &&
      /<(p|ul|h3)(>|\s)/i.test(output.summary) &&
      !/<(script|style|a|img)(>|\s)/i.test(output.summary) &&
      !/```/.test(output.summary);
  } catch {
    output = { title: "", summary: "" };
  }

  const searchableOutput =
    `${output.title} ${output.summary}`.toLocaleLowerCase();
  const factsFound = fixture.requiredFacts.filter((fact) =>
    searchableOutput.includes(fact.toLocaleLowerCase()),
  );
  const usage = body.usage ?? {};
  const price = PRICES[model];
  const estimatedCostUsd = price
    ? ((usage.prompt_tokens ?? 0) * price.input +
        (usage.completion_tokens ?? 0) * price.output) /
      1_000_000
    : Number.NaN;

  return {
    model,
    fixture: fixture.id,
    run,
    latencyMs: Math.round(latencyMs),
    schemaValid,
    factualCoverage: factsFound.length / fixture.requiredFacts.length,
    missingFacts: fixture.requiredFacts.filter(
      (fact) => !factsFound.includes(fact),
    ),
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    estimatedCostUsd,
  };
}

function buildPrompt(language) {
  return `You summarize documents accurately. Create a concise summary and short title in ${language}. Preserve names, dates, quantities, decisions, and causal relationships. Do not invent facts. Format the summary using only p, ul, li, and h3 HTML tags. Return only JSON matching the provided schema.`;
}

function ratio(items, predicate) {
  return items.filter(predicate).length / items.length;
}

function average(values) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
  ];
}
