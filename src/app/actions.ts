"use server";

import { nanoid } from "nanoid";
import client from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseSharePdfRequest } from "@/lib/share-pdf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorMessage,
} from "@/lib/server-rate-limit";

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 20);
};

export async function sharePdf(input: {
  pdfName: string;
  pdfUrl: string;
  imageUrl: string;
  sections: {
    type: string;
    title: string;
    summary: string;
    position: number;
  }[];
}): Promise<{ error: string }> {
  const bucket = process.env.S3_UPLOAD_BUCKET;
  const region = process.env.S3_UPLOAD_REGION;
  if (!bucket || !region) {
    console.error("Missing S3 upload configuration");
    return { error: "Unable to share this PDF right now." };
  }

  const request = parseSharePdfRequest(input, { bucket, region });
  if (!request) {
    return { error: "Invalid share request." };
  }

  const rateLimit = await checkRateLimit(
    "sharePdf",
    getClientIp(await headers()),
  );
  if (!rateLimit.ok) {
    return { error: rateLimitErrorMessage(rateLimit) };
  }

  const { pdfName, pdfUrl, imageUrl, sections } = request;
  const smartPdf = await client.smartPDF.create({
    data: {
      id: `${slugify(sections[0].title)}-${nanoid(4)}`,
      pdfName,
      pdfUrl,
      imageUrl,
      sections: {
        createMany: {
          data: sections,
        },
      },
    },
  });

  redirect(`/pdf/${smartPdf.id}`);
}
