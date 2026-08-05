export const MAX_PDF_UPLOAD_BYTES = 15 * 1024 * 1024;
export const PDF_UPLOAD_EXPIRY_SECONDS = 5 * 60;

export class PdfUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfUploadError";
  }
}

export type PdfUploadRequest = {
  contentType: "application/pdf";
  size: number;
};

export function parsePdfUploadRequest(input: unknown): PdfUploadRequest {
  if (!isRecord(input)) {
    throw new PdfUploadError("Invalid upload request", 400);
  }

  const { filename, contentType, size } = input;
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    filename.length > 255 ||
    typeof contentType !== "string" ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size)
  ) {
    throw new PdfUploadError("Invalid upload request", 400);
  }

  if (contentType !== "application/pdf") {
    throw new PdfUploadError("Only PDF files are allowed", 415);
  }

  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new PdfUploadError(
      "The filename extension must match the PDF file type",
      415,
    );
  }

  if (size < 1) {
    throw new PdfUploadError("The PDF is empty", 400);
  }

  if (size > MAX_PDF_UPLOAD_BYTES) {
    throw new PdfUploadError("PDF files must be 15 MB or smaller", 413);
  }

  return { contentType, size };
}

export function createPdfObjectKey() {
  return `next-s3-uploads/pdfs/${crypto.randomUUID()}.pdf`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
