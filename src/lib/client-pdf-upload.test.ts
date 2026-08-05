import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadPdf } from "./client-pdf-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadPdf", () => {
  it("requests a policy and uploads the PDF directly to S3", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          url: "https://test-bucket.s3.amazonaws.com",
          key: "next-s3-uploads/pdfs/test.pdf",
          fields: {
            key: "next-s3-uploads/pdfs/test.pdf",
            "Content-Type": "application/pdf",
          },
          pdfUrl:
            "https://test-bucket.s3.us-east-1.amazonaws.com/next-s3-uploads/pdfs/test.pdf",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["pdf-bytes"], "report.pdf", {
      type: "application/pdf",
    });

    await expect(uploadPdf(file)).resolves.toEqual({
      key: "next-s3-uploads/pdfs/test.pdf",
      url: "https://test-bucket.s3.us-east-1.amazonaws.com/next-s3-uploads/pdfs/test.pdf",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/s3-upload",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          filename: "report.pdf",
          contentType: "application/pdf",
          size: file.size,
        }),
      }),
    );
    const [, uploadRequest] = fetchMock.mock.calls[1];
    expect(uploadRequest?.method).toBe("POST");
    expect(uploadRequest?.body).toBeInstanceOf(FormData);
    const form = uploadRequest?.body as FormData;
    expect(form.get("key")).toBe("next-s3-uploads/pdfs/test.pdf");
    expect(form.get("file")).toBe(file);
  });

  it("surfaces signer errors without trying an S3 upload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: "Only PDF files are allowed" }, { status: 415 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadPdf(new File(["svg"], "file.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow("Only PDF files are allowed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
