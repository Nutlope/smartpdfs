import dedent from "dedent";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export const SUMMARY_MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";

export const summarySchema = z.object({
  title: z.string().min(1).describe("A short title for the summary"),
  summary: z
    .string()
    .min(1)
    .describe("A concise, accurate summary formatted as safe HTML"),
});

export const summaryRequestSchema = z.object({
  text: z.string().min(1).max(100_000),
  language: z.enum([
    "english",
    "german",
    "french",
    "italian",
    "portuguese",
    "hindi",
    "spanish",
    "thai",
  ]),
});

export function sanitizeSummaryHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "ul", "ol", "li", "h3", "strong", "em"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  }).trim();
}

export function buildSummarySystemPrompt(language: string) {
  return dedent`
    You are an expert at summarizing text accurately.

    Your task:
    1. Read the document excerpt I will provide
    2. Create a concise summary in ${language}
    3. Generate a short, descriptive title in ${language}

    Guidelines for the summary:
    - Preserve names, dates, quantities, decisions, and causal relationships from the source
    - Do not add facts that are absent from the source
    - Format the summary in HTML
    - Use <p> tags for paragraphs of 2-3 sentences
    - Use <ul> and <li> tags for useful bullet points
    - Use <h3> tags for subheadings when needed, without repeating the title
    - Do not use scripts, styles, links, images, markdown, or plain-text line breaks

    Return only JSON matching this schema:
    {
      "title": "non-empty string",
      "summary": "non-empty HTML string"
    }
  `;
}
