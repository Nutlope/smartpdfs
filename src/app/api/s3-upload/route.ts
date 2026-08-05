import { NextResponse } from "next/server";
import { parsePdfUploadRequest, PdfUploadError } from "@/lib/pdf-upload";
import { createPdfUploadPost } from "@/lib/s3-pdf-storage";

export async function POST(request: Request) {
  try {
    const upload = parsePdfUploadRequest(await request.json());
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
