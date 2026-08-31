# SmartPDFs model, dependency, and observability audit

Date: 2026-08-04 (Europe/Rome)

Code baseline: `origin/main` at `422a0b37e0c7e8ff68d784bf04f5ca02d5af0281`

Scope: research only; this note does not change application code or deployment configuration.

## Executive findings

1. **No model used by `origin/main` is currently deprecated.** All three production model IDs are in Together's current serverless catalog and none is in the inference-removal history: `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `Qwen/Qwen3.5-9B`, and `black-forest-labs/FLUX.2-dev`. Together's lifecycle policy can remove serverless endpoints on two or three weeks' notice, so the existing model-verification script should cover all three IDs rather than only the image-prompt model. Sources: [serverless model catalog](https://docs.together.ai/docs/serverless/models), [deprecation policy and history](https://docs.together.ai/docs/deprecations).
2. **DeepSeek V4 Flash is the strongest first candidate to benchmark for PDF summaries, not an evidence-free automatic replacement.** It supports structured outputs, has a 1,000,000-token context, and costs $0.14 input / $0.28 output per million tokens. The current Llama model has 131,072 context and costs $1.04 / $1.04. Flash is therefore about 86.5% cheaper on input, 73.1% cheaper on output, and has 8x the context capacity. Quality and tail latency still require a SmartPDF-specific evaluation. Sources: [Together catalog](https://docs.together.ai/docs/serverless/models), [August 3 launch entry](https://docs.together.ai/docs/changelog#august-3-2026).
3. **Next.js is below the current security floor.** The repo pins Next.js 16.1.6, while Vercel's July 2026 security release says to upgrade 16.x applications to at least 16.2.11 to address four HIGH and five MEDIUM vulnerabilities. The current stable npm tag is 16.3.0. The repo also mismatches `next@16.1.6` with `eslint-config-next@15.3.1`, and its `next lint` script cannot work because Next.js 16 removed that command. Sources: [Next.js July security release summary](https://nextjs.org/blog), [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [npm registry](https://registry.npmjs.org/next).
4. **Helicone only fronts one of the app's two text calls.** `src/lib/ai.ts` sends the AI SDK client through `https://together.helicone.ai/v1`, but the native `Together` client uses Together directly. Consequently the visual-description call is proxied through Helicone while the PDF-summary call already bypasses it. A Braintrust migration should instrument both call paths, not merely delete the proxy URL.
5. **Braintrust has a documented Next.js/AI SDK 7 path.** The current `braintrust` npm release is 3.26.0. Braintrust supports AI SDK v3-v7, recommends `wrapNextjsConfigWithBraintrust` for Next.js auto-instrumentation, and offers `registerTelemetry(braintrustAISDKTelemetry())` for manual AI SDK 7 instrumentation. On Vercel it uses `waitUntil` automatically for background flushing. Sources: [Braintrust Vercel integration](https://www.braintrust.dev/docs/integrations/sdk-integrations/vercel), [npm registry](https://registry.npmjs.org/braintrust).

## Model inventory from `origin/main`

| Route                                        | Model                                     | Current serverless status      | Context / price                                   | Capability notes                                                                                                               | Action                                                                                                      |
| -------------------------------------------- | ----------------------------------------- | ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/app/api/summarize/route.ts`             | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Active, not in removal history | 131,072; $1.04 input / $1.04 output per 1M tokens | Function calling and structured outputs are supported.                                                                         | Keep as benchmark control, then replace only if a candidate matches summary quality and schema reliability. |
| `src/app/api/image/route.ts` (visual prompt) | `Qwen/Qwen3.5-9B`                         | Active, not in removal history | 262,144; $0.17 / $0.25                            | Function calling, structured outputs, and vision are supported; Together currently recommends it as the starting vision model. | No deprecation work. Keep unless the visual-prompt benchmark finds a quality regression.                    |
| `src/app/api/image/route.ts` (image)         | `black-forest-labs/FLUX.2-dev`            | Active, not in removal history | Starts at $0.0154/image                           | Current text-to-image serverless endpoint.                                                                                     | No deprecation work. Image-model quality is a separate benchmark from text summarization.                   |

The authenticated `GET /v1/models` response was also checked on 2026-08-04 without printing or recording credentials; it returned catalog entries for all three IDs. The serverless documentation remains the authoritative evidence that these catalog entries are available on the shared serverless API, because the general model API also contains models usable only on dedicated endpoints.

### Important near-name traps

- `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` was removed on 2025-11-13; SmartPDFs uses the non-Free endpoint, which is still active.
- `meta-llama/Meta-Llama-3-70B-Instruct-Turbo` was removed on 2025-12-23; SmartPDFs uses Llama **3.3**, not Llama 3.
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` was removed on 2026-02-25; SmartPDFs does not use that 3.1 endpoint.
- The previous-generation image endpoint was removed on 2026-02-25; SmartPDFs already uses **FLUX.2-dev**.

Source: [Together deprecation history](https://docs.together.ai/docs/deprecations#deprecation-history).

## Summary-model replacement shortlist

All prices below are per one million tokens and all capability flags come from Together's current [serverless catalog](https://docs.together.ai/docs/serverless/models).

| Candidate                                          |   Context | Input | Cached input | Output | Structured output | Why include                                                                  |
| -------------------------------------------------- | --------: | ----: | -----------: | -----: | ----------------- | ---------------------------------------------------------------------------- |
| `deepseek-ai/DeepSeek-V4-Flash-0731`               | 1,000,000 | $0.14 |        $0.03 |  $0.28 | Yes               | Best cost/context challenger and newly launched on 2026-08-03.               |
| `Qwen/Qwen3.5-9B`                                  |   262,144 | $0.17 |            - |  $0.25 | Yes               | Already used and deployed in this app; simplest consolidation candidate.     |
| `openai/gpt-oss-120b`                              |   128,000 | $0.15 |            - |  $0.60 | Yes               | Cheap general-purpose control, but slightly less context than current Llama. |
| `MiniMaxAI/MiniMax-M3`                             |   524,288 | $0.30 |        $0.06 |  $1.20 | Yes               | Together's current recommended mid-size general-purpose model.               |
| Current: `meta-llama/Llama-3.3-70B-Instruct-Turbo` |   131,072 | $1.04 |            - |  $1.04 | Yes               | Production control.                                                          |

Do not select the winner from catalog specifications. Use representative extracted PDF text, including long documents and every supported output language, and measure:

- Zod/schema success rate and valid JSON rate;
- factual coverage and hallucinations against the source text;
- safe, valid HTML matching the app's expected tags;
- title usefulness;
- p50 and p95 latency, including cold requests;
- prompt/completion tokens and calculated cost.

Together's structured-output guide recommends both passing `response_format` and explicitly including the schema in the prompt. The current prompt asks for valid JSON but does not include a plain-text copy of the schema, so prompt/schema adherence is another controlled benchmark variable. Source: [Together structured outputs](https://docs.together.ai/docs/inference/chat/structured-outputs).

## Helicone to Braintrust migration boundary

Current behavior:

- `togetheraiClient` (`@ai-sdk/togetherai`) sets the Helicone base URL and headers. It is used only by the visual-description `generateText` call.
- `togetheraiBaseClient` (`together-ai`) uses Together directly. It handles the PDF summary and FLUX image generation, so those calls are not observed through the Helicone proxy.
- `HELICONE_API_KEY` can therefore be removed only after code no longer constructs or references the Helicone proxy client and Vercel environments no longer need it.

Recommended migration shape:

1. Upgrade `ai` and `@ai-sdk/togetherai` together and add `braintrust@3.26.0`; keep `zod`, which Braintrust requires as a peer for the AI SDK integration.
2. For a Next.js-wide integration, wrap `next.config.ts` with `wrapNextjsConfigWithBraintrust` from `braintrust/next`. For a narrower AI SDK 7 integration, initialize once and call `ai.registerTelemetry(braintrustAISDKTelemetry())` before AI calls.
3. Consolidate the summary text call onto the AI SDK provider or add an explicit manual Braintrust span around the native Together call; otherwise removing Helicone still leaves incomplete observability.
4. Use a stable project name and `BRAINTRUST_API_KEY` in Vercel Production, Preview, and Development. Do not log full PDF text by default; record model, latency, token usage, schema success, safe document identifiers, and errors. This is a privacy recommendation based on the app processing user documents.
5. Verify end-to-end on a preview deployment: one visual-description span, one summary span, errors attached to failed spans, token/model metadata present, and Vercel completion flushes successfully. Braintrust documents automatic Vercel `waitUntil` flushing.
6. Only after that verification, delete the Helicone base URL/headers, remove `HELICONE_API_KEY` from Vercel, and update the README.

Source: [Braintrust Vercel and AI SDK integration](https://www.braintrust.dev/docs/integrations/sdk-integrations/vercel).

## Dependency audit

Versions are the `origin/main` declarations, locally resolved lockfile versions, and the npm registry `latest` dist-tag queried on 2026-08-04. The registry metadata links in the package names are the primary source for each version claim.

### Runtime dependencies

| Package                                                                               |   Declared |  Resolved |     Latest | Change          |
| ------------------------------------------------------------------------------------- | ---------: | --------: | ---------: | --------------- |
| [`@ai-sdk/togetherai`](https://registry.npmjs.org/%40ai-sdk%2Ftogetherai)             |  `^2.0.37` |  `2.0.37` |   `3.0.23` | major           |
| [`@aws-sdk/client-s3`](https://registry.npmjs.org/%40aws-sdk%2Fclient-s3)             | `^3.797.0` | `3.797.0` | `3.1102.0` | update          |
| [`@neondatabase/serverless`](https://registry.npmjs.org/%40neondatabase%2Fserverless) |   `^1.0.0` |   `1.0.0` |    `1.1.0` | update          |
| [`@prisma/adapter-neon`](https://registry.npmjs.org/%40prisma%2Fadapter-neon)         |   `^6.6.0` |   `6.6.0` |    `7.9.1` | major           |
| [`@prisma/client`](https://registry.npmjs.org/%40prisma%2Fclient)                     |   `^6.6.0` |   `6.6.0` |    `7.9.1` | major           |
| [`@radix-ui/react-select`](https://registry.npmjs.org/%40radix-ui%2Freact-select)     |   `^2.1.2` |   `2.2.2` |    `2.3.7` | update          |
| [`@radix-ui/react-slot`](https://registry.npmjs.org/%40radix-ui%2Freact-slot)         |   `^1.1.0` |   `1.2.0` |    `1.3.3` | update          |
| [`@radix-ui/react-toast`](https://registry.npmjs.org/%40radix-ui%2Freact-toast)       |   `^1.2.2` |  `1.2.11` |   `1.2.23` | update          |
| [`@tailwindcss/typography`](https://registry.npmjs.org/%40tailwindcss%2Ftypography)   |  `^0.5.16` |  `0.5.16` |   `0.5.20` | update          |
| [`ai`](https://registry.npmjs.org/ai)                                                 | `^6.0.108` | `6.0.108` |   `7.0.51` | major           |
| [`class-variance-authority`](https://registry.npmjs.org/class-variance-authority)     |   `^0.7.0` |   `0.7.1` |    `0.7.1` | current         |
| [`clsx`](https://registry.npmjs.org/clsx)                                             |   `^2.1.1` |   `2.1.1` |    `2.1.1` | current         |
| [`dedent`](https://registry.npmjs.org/dedent)                                         |   `^1.5.3` |   `1.5.3` |    `1.7.2` | update          |
| [`lucide-react`](https://registry.npmjs.org/lucide-react)                             | `^0.503.0` | `0.503.0` |   `1.28.0` | major           |
| [`nanoid`](https://registry.npmjs.org/nanoid)                                         |   `^5.1.5` |   `5.1.5` |    `6.0.1` | major           |
| [`next`](https://registry.npmjs.org/next)                                             |   `16.1.6` |  `16.1.6` |   `16.3.0` | update/security |
| [`next-plausible`](https://registry.npmjs.org/next-plausible)                         |  `^3.12.5` |  `3.12.5` |    `4.0.0` | major           |
| [`next-s3-upload`](https://registry.npmjs.org/next-s3-upload)                         |   `^0.3.4` |   `0.3.4` |    `0.3.4` | current         |
| [`pdfjs-dist`](https://registry.npmjs.org/pdfjs-dist)                                 |  `^4.8.69` | `4.10.38` |  `6.2.108` | major           |
| [`react`](https://registry.npmjs.org/react)                                           |   `19.2.4` |  `19.2.4` |   `19.2.8` | patch           |
| [`react-dom`](https://registry.npmjs.org/react-dom)                                   |   `19.2.4` |  `19.2.4` |   `19.2.8` | patch           |
| [`react-dropzone`](https://registry.npmjs.org/react-dropzone)                         |  `^14.3.5` |  `14.3.8` |   `20.0.0` | major           |
| [`tailwind-merge`](https://registry.npmjs.org/tailwind-merge)                         |   `^2.5.4` |   `2.6.0` |    `3.6.0` | major           |
| [`tailwindcss-animate`](https://registry.npmjs.org/tailwindcss-animate)               |   `^1.0.7` |   `1.0.7` |    `1.0.7` | current         |
| [`together-ai`](https://registry.npmjs.org/together-ai)                               |  `^0.37.0` |  `0.37.0` |   `0.46.0` | update          |
| [`ws`](https://registry.npmjs.org/ws)                                                 |  `^8.18.0` |  `8.18.1` |   `8.21.2` | update          |
| [`zod`](https://registry.npmjs.org/zod)                                               |   `^4.3.6` |   `4.3.6` |    `4.4.3` | update          |

### Development dependencies

| Package                                                                                 |   Declared |  Resolved |    Latest | Change                                                                                    |
| --------------------------------------------------------------------------------------- | ---------: | --------: | --------: | ----------------------------------------------------------------------------------------- |
| [`@types/node`](https://registry.npmjs.org/%40types%2Fnode)                             | `^22.15.3` | `22.15.3` |  `26.1.2` | major; keep aligned to the deployed Node 22 runtime rather than upgrading by number alone |
| [`@types/react`](https://registry.npmjs.org/%40types%2Freact)                           | `^19.2.14` | `19.2.14` | `19.2.18` | update                                                                                    |
| [`@types/react-dom`](https://registry.npmjs.org/%40types%2Freact-dom)                   |  `^19.2.3` |  `19.2.3` |  `19.2.4` | update                                                                                    |
| [`@types/ws`](https://registry.npmjs.org/%40types%2Fws)                                 |  `^8.5.13` |  `8.18.1` |  `8.18.1` | current; likely removable with unused `ws`                                                |
| [`eslint`](https://registry.npmjs.org/eslint)                                           |   `9.25.1` |  `9.25.1` |  `10.8.0` | major                                                                                     |
| [`eslint-config-next`](https://registry.npmjs.org/eslint-config-next)                   |   `15.3.1` |  `15.3.1` |  `16.3.0` | major/mismatched with Next 16                                                             |
| [`postcss`](https://registry.npmjs.org/postcss)                                         |       `^8` |   `8.5.3` |  `8.5.25` | update                                                                                    |
| [`prettier`](https://registry.npmjs.org/prettier)                                       |   `^3.3.3` |   `3.5.3` |   `3.9.6` | update                                                                                    |
| [`prettier-plugin-tailwindcss`](https://registry.npmjs.org/prettier-plugin-tailwindcss) |   `^0.6.8` |  `0.6.11` |   `0.8.1` | update                                                                                    |
| [`prisma`](https://registry.npmjs.org/prisma)                                           |   `^6.6.0` |   `6.6.0` |   `7.9.1` | major                                                                                     |
| [`tailwindcss`](https://registry.npmjs.org/tailwindcss)                                 |   `^3.4.1` |  `3.4.17` |   `4.3.3` | major                                                                                     |
| [`typescript`](https://registry.npmjs.org/typescript)                                   |       `^5` |   `5.8.3` |   `7.0.2` | major                                                                                     |

### Migration notes and sequencing

- **Urgent, low-scope security wave:** update Next.js to 16.3.0 (or at minimum 16.2.11), React/React DOM to 19.2.8, matching React types, and `eslint-config-next` to the same Next line. Replace `next lint` with the ESLint CLI or remove the script. Next 16's official guide says `next lint` is removed and `next build` no longer lints. Sources: [Next.js blog](https://nextjs.org/blog), [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
- **AI/observability wave:** upgrade `ai` 6 to 7 and `@ai-sdk/togetherai` 2 to 3 together, then install `braintrust@3.26.0`. AI SDK 7 has its own [6-to-7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0). Braintrust's current documentation explicitly supports v7 and gives a v7 telemetry registration API. The app's existing `generateText` usage is small, but compile and preview-test the provider options and traces.
- **Together SDK wave:** `together-ai` 0.46.0 remains the same public client shape used here (`new Together()`, `chat.completions.create`, `images.generate`). The first-party package notes that certain backwards-incompatible type changes can appear in minor releases, so run typecheck plus real chat/image preview calls. Source: [Together TypeScript SDK](https://github.com/togethercomputer/together-typescript), [0.37-to-0.46 changelog](https://github.com/togethercomputer/together-typescript/blob/main/CHANGELOG.md).
- **TypeScript wave:** 7.0.2 is a new native compiler with major default/configuration changes and no programmatic compiler API in 7.0. Microsoft says 7 adopts TypeScript 6 defaults and turns several deprecated flags into hard errors. SmartPDFs explicitly sets most relevant options and uses `moduleResolution: "bundler"`, but the upgrade should be isolated until Next/ESLint tooling is verified. Source: [Microsoft TypeScript 7 announcement and migration details](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- **Prisma wave:** 7.9.1 is not a version-only bump. Prisma 7 is ESM, moves connection configuration to `prisma.config.ts`, and its new `prisma-client` generator requires an explicit output path and changed imports. SmartPDFs still uses `prisma-client-js`, imports from `@prisma/client`, and keeps `url` in `schema.prisma`. Migrate separately. Source: [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).
- **Tailwind wave:** 4.3.3 requires the v3-to-v4 migration; the PostCSS plugin moves to `@tailwindcss/postcss` and configuration becomes CSS-first. SmartPDFs currently uses `tailwindcss` directly in PostCSS and a TypeScript config, so do not mix this into the model/observability PR. Source: [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide).
- **PDF.js, upload, and UI majors:** `pdfjs-dist` 4 to 6, `react-dropzone` 14 to 20, `next-plausible` 3 to 4, `lucide-react` 0.x to 1.x, `nanoid` 5 to 6, and `tailwind-merge` 2 to 3 all need separate changelog/API review and browser verification. PDF.js uses semantic major versions for API-breaking changes and marks release changes `[api-major]`; SmartPDFs imports legacy browser bundles and a worker, so verify PDF extraction and worker loading in a production build. Source: [PDF.js version policy](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).
- **Likely removable dependencies:** no `origin/main` source file imports `@neondatabase/serverless`, `@prisma/adapter-neon`, `ws`, or `@types/ws`. Prisma currently constructs a plain `PrismaClient`, not the Neon adapter. Confirm with build/runtime tests, then remove them instead of upgrading them.

## Recommended PR boundaries

1. Next/React security update plus ESLint command/config alignment.
2. SmartPDF summary benchmark and winning model change; keep model verification in the same PR.
3. Helicone removal and end-to-end Braintrust instrumentation for both AI call paths.
4. Safe same-major dependency updates and unused-dependency removal.
5. Separate majors: Prisma 7, Tailwind 4, PDF.js 6, then remaining UI package majors.

This sequence keeps security, model quality, observability, and framework migrations independently reviewable and reversible.
