import dedent from "dedent";
import { togetheraiBaseClient } from "@/lib/ai";
import { ImageGenerationResponse } from "@/lib/summarize";
import { awsS3Client } from "@/lib/s3client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  const json = await req.json();
  const text = "text" in json ? json.text : "";

  const start = new Date();

  const prompt = dedent`
    I'm going to give you the first few pages of a PDF document. Based on this initial content, analyze and identify the main themes, topics, and overall subject matter.

    Create a detailed, realistic image that directly illustrates the main subject matter. The image should:
    - Focus on depicting actual scenes, objects, or environments related to the topic
    - Show specific elements like historical settings, scientific concepts, or real-world scenarios
    - Create a photorealistic or artistically detailed representation
    - Include relevant background elements and environmental context
    - Maintain high visual quality and professional composition
    - Avoid generic book covers or presentation slides
    - Do not include any text or written elements

    For example:
    - If about Ancient Rome: Show detailed Roman architecture, soldiers, or city life
    - If about science: Illustrate the actual phenomena, experiments, or concepts
    - If about business: Depict real workplace scenarios or industry-specific elements

    Here is the initial content to analyze:

    ${text}
  `;

  const generatedImage = await togetheraiBaseClient.images.create({
    model: "black-forest-labs/FLUX.1-dev",
    width: 1280,
    height: 720,
    steps: 24,
    prompt: prompt,
  });

  const end = new Date();
  console.log(
    `Flux took ${end.getTime() - start.getTime()}ms to generate an image`,
  );

  const fluxImageUrl = generatedImage.data[0].url;

  if (!fluxImageUrl) throw new Error("No image URL from Flux");

  const fluxFetch = await fetch(fluxImageUrl);
  const fluxImage = await fluxFetch.blob();
  const imageBuffer = Buffer.from(await fluxImage.arrayBuffer());

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
