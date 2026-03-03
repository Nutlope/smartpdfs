import { togetheraiBaseClient } from "@/lib/ai";
import assert from "assert";
import dedent from "dedent";
import { z } from "zod";

export async function POST(req: Request) {
  const { text, language } = await req.json();

  assert.ok(typeof text === "string");
  assert.ok(typeof language === "string");

  const systemPrompt = dedent`
    You are an expert at summarizing text.

    Your task:
    1. Read the document excerpt I will provide
    2. Create a concise summary in ${language}
    3. Generate a short, descriptive title in ${language}

    Guidelines for the summary:
    - Format the summary in HTML
    - Use <p> tags for paragraphs (2-3 sentences each)
    - Use <ul> and <li> tags for bullet points
    - Use <h3> tags for subheadings when needed but don't repeat the initial title in the first paragraph
    - Ensure proper spacing with appropriate HTML tags

    The summary should be well-structured and easy to scan, while maintaining accuracy and completeness.
    Please analyze the text thoroughly before starting the summary.

    IMPORTANT: Output ONLY valid JSON matching the schema. Output ONLY valid HTML without any markdown or plain text line breaks.
  `;

  const summarySchema = z.object({
    title: z.string().describe("A title for the summary"),
    summary: z
      .string()
      .describe(
        "The actual summary of the text containing new lines breaks between paragraphs or phrases for better readability.",
      ),
  });

  const jsonSchema = z.toJSONSchema(summarySchema, {
    target: "openapi-3.0",
    io: "output",
  });

  const summaryResponse = await togetheraiBaseClient.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "summary",
        schema: jsonSchema,
      },
    } as any,
  });

  const content = summaryResponse.choices[0]?.message?.content;

  if (!content) {
    console.log("Content was blank", JSON.stringify(summaryResponse, null, 2));
    return Response.json({ error: "No content generated" }, { status: 500 });
  }

  const parsed = summarySchema.parse(JSON.parse(content));

  return Response.json(parsed);
}

export const runtime = "edge";
