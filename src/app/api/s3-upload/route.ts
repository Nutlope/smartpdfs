import { NextResponse } from "next/server";
import { parsePdfUploadRequest, PdfUploadError } from "@/lib/pdf-upload";
import { createPdfUploadPost } from "@/lib/s3-pdf-storage";
import { enforceRateLimit } from "@/lib/server-rate-limit";

export async function POST(request: Request) {
  try {
    const upload = parsePdfUploadRequest(await request.json());
    const limited = await enforceRateLimit("pdfUpload", request.headers);
    if (limited) return limited;
    return NextResponse.json(await createPdfUploadPost(upload));
  } catch (error) {
    if (error instanceof PdfUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to create PDF upload:", error);
    return NextResponse.json(
      { error: "Failed to create PDF upload" },
      { status: 500 },
    );
  }
}
