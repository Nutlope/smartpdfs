import { describe, expect, it } from "vitest";
import {
  MAX_PDF_UPLOAD_BYTES,
  parsePdfUploadRequest,
  PdfUploadError,
} from "./pdf-upload";

describe("parsePdfUploadRequest", () => {
  it("accepts a non-empty PDF within the app limit", () => {
    expect(
      parsePdfUploadRequest({
        filename: "quarterly-report.pdf",
        contentType: "application/pdf",
        size: MAX_PDF_UPLOAD_BYTES,
      }),
    ).toEqual({
      contentType: "application/pdf",
      size: MAX_PDF_UPLOAD_BYTES,
    });
  });

  it.each([
    [{ filename: "report.svg", contentType: "image/svg+xml", size: 10 }, 415],
    [{ filename: "report.exe", contentType: "application/pdf", size: 10 }, 415],
    [{ filename: "report.pdf", contentType: "application/pdf", size: 0 }, 400],
    [
      {
        filename: "report.pdf",
        contentType: "application/pdf",
        size: MAX_PDF_UPLOAD_BYTES + 1,
      },
      413,
    ],
  ])("rejects an unsafe upload request", (input, status) => {
    expect(() => parsePdfUploadRequest(input)).toThrow(PdfUploadError);
    try {
      parsePdfUploadRequest(input);
    } catch (error) {
      expect(error).toMatchObject({ status });
    }
  });
});
