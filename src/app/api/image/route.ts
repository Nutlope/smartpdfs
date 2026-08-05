import dedent from "dedent";
import { togetheraiBaseClient } from "@/lib/ai";
import {
  endBraintrustSpan,
  flushBraintrustSpan,
  logBraintrustSpan,
  serializeBraintrustError,
  startBraintrustChildSpan,
  startBraintrustSpan,
  type Span,
} from "@/lib/braintrust";
import type { ImageGenerationResponse } from "@/lib/summarize";
import { getS3 } from "@/lib/s3client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { after } from "next/server";
import { z } from "zod";

const IMAGE_PROMPT_MODEL = "Qwen/Qwen3.5-9B";
const IMAGE_MODEL = "black-forest-labs/FLUX.2-dev";
const TEXT_TIMEOUT_MS = 30_000;
const IMAGE_TIMEOUT_MS = 60_000;

const imageRequestSchema = z.object({
  text: z.string().min(1).max(100_000),
});

export async function POST(req: Request) {
  const { text } = imageRequestSchema.parse(await req.json());
  const startedAt = performance.now();
  const requestSpan = startBraintrustSpan({
    name: "smartpdfs.image",
    type: "task",
    event: {
      metadata: {
        route: "/api/image",
        sourceChars: text.length,
      },
    },
  });

  try {
    const truncatedText = text.slice(0, 2_000);
    const visualDescription = await generateVisualDescription(
      truncatedText,
      requestSpan,
    );
    const prompt = dedent`
      ${visualDescription}

      Oil painting, fine art, museum quality, artistic brushstrokes.
      No text, no words, no letters, no writing, no documents, no signs.
      Pure visual illustration only.
    `;

    const generatedImage = await generateCoverImage(prompt, requestSpan);
    const imageData = generatedImage.data[0];
    if (!imageData?.url) {
      throw new Error("Together returned no image URL");
    }

    const storageStartedAt = performance.now();
    const storageSpan = startBraintrustChildSpan(requestSpan, {
      name: "smartpdfs.image.store",
      type: "task",
      event: { metadata: { provider: "s3" } },
    });
    try {
      const imageFetch = await fetch(imageData.url, {
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      });
      if (!imageFetch.ok) {
        throw new Error(
          `Together image download failed (${imageFetch.status})`,
        );
      }
      const imageBuffer = Buffer.from(await imageFetch.arrayBuffer());
      const coverImageKey = `pdf-cover-${generatedImage.id}.jpg`;
      const { bucket, client, region } = getS3();

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: coverImageKey,
          Body: imageBuffer,
          ContentType: "image/jpeg",
        }),
      );

      logBraintrustSpan(storageSpan, {
        metadata: { success: true, bytes: imageBuffer.byteLength },
        metrics: { latency_ms: performance.now() - storageStartedAt },
      });
      endBraintrustSpan(storageSpan);

      const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${coverImageKey}`;
      logBraintrustSpan(requestSpan, {
        metadata: { success: true },
        metrics: { total_ms: performance.now() - startedAt },
      });
      return Response.json({ url: imageUrl } as ImageGenerationResponse);
    } catch (error) {
      logBraintrustSpan(storageSpan, {
        error: serializeBraintrustError(error),
        metadata: { success: false },
      });
      endBraintrustSpan(storageSpan);
      throw error;
    }
  } catch (error) {
    logBraintrustSpan(requestSpan, {
      error: serializeBraintrustError(error),
      metadata: { success: false },
      metrics: { total_ms: performance.now() - startedAt },
    });
    throw error;
  } finally {
    endBraintrustSpan(requestSpan);
    after(() => flushBraintrustSpan(requestSpan));
  }
}

async function generateVisualDescription(
  text: string,
  parent: Span | undefined,
) {
  const startedAt = performance.now();
  const span = startBraintrustChildSpan(parent, {
    name: "smartpdfs.image.visual-description",
    type: "llm",
    event: {
      metadata: {
        model: IMAGE_PROMPT_MODEL,
        provider: "together",
        sourceChars: text.length,
      },
    },
  });

  try {
    const result = await togetheraiBaseClient.chat.completions.create(
      {
        model: IMAGE_PROMPT_MODEL,
        messages: [
          {
            role: "user",
            content: dedent`
              Based on the following content, describe a single visual scene that represents its essence.
              The scene should be suitable for a painting or illustration.
              Do NOT include any text, words, or writing in your description.
              Just describe what you would see: objects, colors, atmosphere, lighting, mood.
              Keep it to 2-3 sentences.

              Content: ${text}

              Visual scene description:
            `,
          },
        ],
        reasoning: { enabled: false },
        temperature: 0.3,
        max_tokens: 240,
      },
      { signal: AbortSignal.timeout(TEXT_TIMEOUT_MS) },
    );
    const visualDescription = result.choices[0]?.message?.content;
    if (!visualDescription) {
      throw new Error("Together returned an empty visual description");
    }
    const usage = result.usage;

    logBraintrustSpan(span, {
      metadata: {
        success: true,
        reasoningEnabled: false,
        outputChars: visualDescription.length,
        finishReason: result.choices[0]?.finish_reason ?? null,
      },
      metrics: {
        latency_ms: performance.now() - startedAt,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        tokens: usage?.total_tokens ?? 0,
      },
    });
    endBraintrustSpan(span);
    return visualDescription;
  } catch (error) {
    logBraintrustSpan(span, { error: serializeBraintrustError(error) });
    endBraintrustSpan(span);
    throw error;
  }
}

async function generateCoverImage(prompt: string, parent: Span | undefined) {
  const startedAt = performance.now();
  const span = startBraintrustChildSpan(parent, {
    name: "smartpdfs.image.generation",
    type: "llm",
    event: {
      metadata: {
        model: IMAGE_MODEL,
        provider: "together",
        width: 1280,
        height: 720,
      },
    },
  });

  try {
    const result = await togetheraiBaseClient.images.generate(
      {
        model: IMAGE_MODEL,
        width: 1280,
        height: 720,
        prompt,
      },
      { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) },
    );
    logBraintrustSpan(span, {
      metadata: { success: true, imageCount: result.data.length },
      metrics: { latency_ms: performance.now() - startedAt },
    });
    endBraintrustSpan(span);
    return result;
  } catch (error) {
    logBraintrustSpan(span, { error: serializeBraintrustError(error) });
    endBraintrustSpan(span);
    throw error;
  }
}

export const runtime = "nodejs";
export const maxDuration = 90;
