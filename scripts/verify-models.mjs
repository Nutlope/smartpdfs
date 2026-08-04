import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageRoute = await readFile(
  new URL("../src/app/api/image/route.ts", import.meta.url),
  "utf8",
);
const summaryRoute = await readFile(
  new URL("../src/lib/summary-model.ts", import.meta.url),
  "utf8",
);

assert.match(imageRoute, /Qwen\/Qwen3\.5-9B/);
assert.match(imageRoute, /black-forest-labs\/FLUX\.2-dev/);
assert.match(summaryRoute, /deepseek-ai\/DeepSeek-V4-Flash-0731/);
assert.doesNotMatch(
  imageRoute,
  /meta-llama\/Llama-4-Maverick-17B-128E-Instruct-FP8/,
  "The image prompt route must not use the removed Llama Maverick endpoint",
);
assert.doesNotMatch(
  `${imageRoute}\n${summaryRoute}`,
  /Llama-Guard-4-12B|gemma-3n-E4B-it|MiniMax-M2\.7|Llama-4-Maverick/,
  "Routes must not reference removed Together endpoints",
);

console.log("SmartPDFs model configuration excludes removed endpoints.");
