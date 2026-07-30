import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageRoute = await readFile(
  new URL("../src/app/api/image/route.ts", import.meta.url),
  "utf8",
);

assert.match(imageRoute, /Qwen\/Qwen3\.5-9B/);
assert.doesNotMatch(
  imageRoute,
  /meta-llama\/Llama-4-Maverick-17B-128E-Instruct-FP8/,
  "The image prompt route must not use the removed Llama Maverick endpoint",
);

console.log("SmartPDFs model configuration excludes removed endpoints.");
