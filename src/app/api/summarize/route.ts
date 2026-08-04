import { togetheraiBaseClient } from "@/lib/ai";
import {
  endBraintrustSpan,
  flushBraintrustSpan,
  logBraintrustSpan,
  serializeBraintrustError,
  startBraintrustChildSpan,
  startBraintrustSpan,
} from "@/lib/braintrust";
import {
  buildSummarySystemPrompt,
  SUMMARY_MODEL,
  sanitizeSummaryHtml,
  summaryRequestSchema,
  summarySchema,
} from "@/lib/summary-model";
import { after } from "next/server";

const SUMMARY_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  const { text, language, mode = "chunk" } = summaryRequestSchema.parse(
    await req.json(),
  );
  const startedAt = performance.now();
  const requestSpan = startBraintrustSpan({
    name: "smartpdfs.summarize",
    type: "task",
    event: {
      metadata: {
        route: "/api/summarize",
        language,
        mode,
        sourceChars: text.length,
      },
    },
  });
  const inferenceSpan = startBraintrustChildSpan(requestSpan, {
    name: "smartpdfs.summarize.inference",
    type: "llm",
    event: {
      metadata: {
        model: SUMMARY_MODEL,
        provider: "together",
        reasoningEnabled: false,
      },
    },
  });

  try {
    const summaryResponse = await togetheraiBaseClient.chat.completions.create(
      {
        model: SUMMARY_MODEL,
        messages: [
          {
            role: "system",
            content: buildSummarySystemPrompt(language, mode),
          },
          { role: "user", content: text },
        ],
        reasoning: { enabled: false },
        temperature: 0,
        max_tokens: mode === "final" ? 1_000 : 1_600,
        // JSON mode keeps output machine-readable without the severe latency
        // observed from constrained JSON-schema decoding on longer PDF chunks.
        // summarySchema remains the application-level contract below.
        response_format: {
          type: "json_object",
        },
      },
      { signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS) },
    );

    const content = summaryResponse.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Together returned an empty summary");
    }

    const parsed = summarySchema.parse(JSON.parse(content));
    const sanitizedSummary = sanitizeSummaryHtml(parsed.summary);
    if (!sanitizedSummary) {
      throw new Error("Together returned an empty summary after sanitization");
    }
    const safeResult = { ...parsed, summary: sanitizedSummary };
    const usage = summaryResponse.usage;
    logBraintrustSpan(inferenceSpan, {
      metadata: {
        finishReason: summaryResponse.choices[0]?.finish_reason ?? null,
        schemaValid: true,
        outputChars: safeResult.summary.length,
      },
      metrics: {
        latency_ms: performance.now() - startedAt,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        tokens: usage?.total_tokens ?? 0,
      },
    });
    endBraintrustSpan(inferenceSpan);

    logBraintrustSpan(requestSpan, {
      metadata: { success: true, schemaValid: true },
      metrics: { total_ms: performance.now() - startedAt },
    });
    return Response.json(safeResult);
  } catch (error) {
    const serializedError = serializeBraintrustError(error);
    logBraintrustSpan(inferenceSpan, { error: serializedError });
    endBraintrustSpan(inferenceSpan);
    logBraintrustSpan(requestSpan, {
      error: serializedError,
      metadata: { success: false },
      metrics: { total_ms: performance.now() - startedAt },
    });
    throw error;
  } finally {
    endBraintrustSpan(requestSpan);
    after(() => flushBraintrustSpan(requestSpan));
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
