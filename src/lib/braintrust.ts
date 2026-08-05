import {
  initLogger,
  type ExperimentLogPartialArgs,
  type Logger,
  type Span,
  type StartSpanArgs,
} from "braintrust";

let logger: Logger<true> | null | undefined;

function getBraintrustLogger() {
  if (!process.env.BRAINTRUST_API_KEY) return undefined;

  if (logger !== undefined) {
    return logger ?? undefined;
  }

  try {
    logger = initLogger({
      apiKey: process.env.BRAINTRUST_API_KEY,
      projectName: process.env.BRAINTRUST_PROJECT ?? "smartpdfs",
      asyncFlush: true,
    });
  } catch (error) {
    logger = null;
    console.warn("Braintrust logger initialization failed:", error);
  }

  return logger ?? undefined;
}

export function startBraintrustSpan(args: StartSpanArgs) {
  try {
    return getBraintrustLogger()?.startSpan(args);
  } catch (error) {
    console.warn("Braintrust span initialization failed:", error);
    return undefined;
  }
}

export function startBraintrustChildSpan(
  parent: Span | undefined,
  args: StartSpanArgs,
) {
  try {
    return parent?.startSpan(args);
  } catch (error) {
    console.warn("Braintrust child span initialization failed:", error);
    return undefined;
  }
}

export function logBraintrustSpan(
  span: Span | undefined,
  event: ExperimentLogPartialArgs,
) {
  try {
    span?.log(event);
  } catch (error) {
    console.warn("Braintrust span logging failed:", error);
  }
}

export function endBraintrustSpan(span: Span | undefined) {
  try {
    span?.end();
  } catch (error) {
    console.warn("Braintrust span completion failed:", error);
  }
}

export async function flushBraintrustSpan(span: Span | undefined) {
  try {
    await span?.flush();
  } catch (error) {
    console.warn("Braintrust span flush failed:", error);
  }
}

export function serializeBraintrustError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    name: error instanceof Error ? error.name : "Error",
    message: /["'](?:messages|content|prompt)["']\s*:/i.test(message)
      ? "Provider request failed; request payload redacted"
      : sanitizeErrorMessage(message),
  };
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]")
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[REDACTED_DATA]")
    .replace(/[A-Za-z0-9+/=]{256,}/g, "[REDACTED_DATA]")
    .slice(0, 1_000);
}

export type { Span };
