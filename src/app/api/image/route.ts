import dedent from "dedent";
import { togetheraiBaseClient, togetheraiClient } from "@/lib/ai";
import { ImageGenerationResponse } from "@/lib/summarize";
import { awsS3Client } from "@/lib/s3client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateText } from "ai";

export async function POST(req: Request) {
  const json = await req.json();
  const text = "text" in json ? json.text : "";

  const start = new Date();

  const truncatedText = text.slice(0, 2000);

  const { text: visualDescription } = await generateText({
    model: togetheraiClient(
      "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    ),
    prompt: dedent`
      Based on the following content, describe a single visual scene that represents its essence. 
      The scene should be suitable for a painting or illustration.
      Do NOT include any text, words, or writing in your description.
      Just describe what you would see: objects, colors, atmosphere, lighting, mood.
      Keep it to 2-3 sentences.

      Content: ${truncatedText}

      Visual scene description:
    `,
  });

  const prompt = dedent`
    ${visualDescription}

    Oil painting, fine art, museum quality, artistic brushstrokes. 
    No text, no words, no letters, no writing, no documents, no signs.
    Pure visual illustration only.
  `;

  const generatedImage = await togetheraiBaseClient.images.generate({
    model: "black-forest-labs/FLUX.2-dev",
    width: 1280,
    height: 720,
    prompt: prompt,
  });

  const end = new Date();
  console.log(`Image generation took ${end.getTime() - start.getTime()}ms`);

  const imageData = generatedImage.data[0];
  if (!imageData) throw new Error("No image data generated");

  if (imageData.url === undefined)
    throw new Error("Expected URL response format");

  const imageUrl = imageData.url;

  if (!imageUrl) throw new Error("No image URL returned");

  const imageFetch = await fetch(imageUrl);
  const imageBlob = await imageFetch.blob();
  const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

  const coverImageKey = `pdf-cover-${generatedImage.id}.jpg`;

  const uploadedFile = await awsS3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_UPLOAD_BUCKET || "",
      Key: coverImageKey,
      Body: imageBuffer,
      ContentType: "image/jpeg",
    }),
  );

  if (!uploadedFile) {
    throw new Error("Failed to upload enhanced image to S3");
  }

  return Response.json({
    url: `https://${process.env.S3_UPLOAD_BUCKET}.s3.${
      process.env.S3_UPLOAD_REGION || "us-east-1"
    }.amazonaws.com/${coverImageKey}`,
  } as ImageGenerationResponse);
}

export const runtime = "edge";
