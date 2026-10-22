import { z } from "zod";
import { sanitizeSummaryHtml } from "@/lib/summary-model";

export const MAX_SHARED_SECTIONS = 200;

const sectionSchema = z.object({
  type: z.enum(["quick-summary", "summary"]),
  title: z.string().max(500),
  summary: z.string().max(20_000),
  position: z.number().int().min(0).max(MAX_SHARED_SECTIONS),
});

const sharePdfRequestSchema = z.object({
  pdfName: z.string().min(1).max(255),
  pdfUrl: z.string().max(2_048),
  imageUrl: z.string().max(2_048),
  sections: z.array(sectionSchema).min(1).max(MAX_SHARED_SECTIONS),
});

export type SharePdfRequest = z.infer<typeof sharePdfRequestSchema>;

export type S3Location = { bucket: string; region: string };

export function parseSharePdfRequest(
  input: unknown,
  { bucket, region }: S3Location,
): SharePdfRequest | null {
  const parsed = sharePdfRequestSchema.safeParse(input);
  if (!parsed.success) return null;

  const { pdfName, pdfUrl, imageUrl, sections } = parsed.data;
  const origin = `https://${bucket}.s3.${region}.amazonaws.com/`;
  const pdfPattern = new RegExp(
    `^${escapeRegExp(origin)}next-s3-uploads/pdfs/[0-9a-f-]{36}\\.pdf$`,
  );
  const imagePattern = new RegExp(
    `^${escapeRegExp(origin)}pdf-cover-[A-Za-z0-9_-]{1,128}\\.jpg$`,
  );
  if (!pdfPattern.test(pdfUrl) || !imagePattern.test(imageUrl)) return null;
  if (sections[0].type !== "quick-summary") return null;

  return {
    pdfName,
    pdfUrl,
    imageUrl,
    sections: sections.map((section) => ({
      ...section,
      summary: sanitizeSummaryHtml(section.summary),
    })),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
