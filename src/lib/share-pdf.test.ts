import { describe, expect, it } from "vitest";
import { parseSharePdfRequest } from "@/lib/share-pdf";

const location = { bucket: "test-bucket", region: "us-east-1" };
const origin = "https://test-bucket.s3.us-east-1.amazonaws.com";

function validRequest() {
  return {
    pdfName: "report.pdf",
    pdfUrl: `${origin}/next-s3-uploads/pdfs/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`,
    imageUrl: `${origin}/pdf-cover-abc123-xyz.jpg`,
    sections: [
      {
        type: "quick-summary",
        title: "Report",
        summary: "<p>Overview</p>",
        position: 0,
      },
      {
        type: "summary",
        title: "Part 1",
        summary: "<ul><li>Point</li></ul>",
        position: 1,
      },
    ],
  };
}

describe("parseSharePdfRequest", () => {
  it("accepts a legitimate share request", () => {
    expect(parseSharePdfRequest(validRequest(), location)).toEqual(
      validRequest(),
    );
  });

  it("strips scripts, event handlers, and disallowed tags from summaries", () => {
    const request = validRequest();
    request.sections[0].summary =
      '<p onclick="x()">Hi</p><img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">link</a>';

    const parsed = parseSharePdfRequest(request, location);

    expect(parsed?.sections[0].summary).toBe("<p>Hi</p>link");
  });

  it("rejects URLs outside the app's bucket", () => {
    const badPdf = validRequest();
    badPdf.pdfUrl = "javascript:alert(1)";
    const badImage = validRequest();
    badImage.imageUrl = "https://evil.example/pdf-cover-1.jpg";

    expect(parseSharePdfRequest(badPdf, location)).toBeNull();
    expect(parseSharePdfRequest(badImage, location)).toBeNull();
  });

  it("rejects oversized or malformed input", () => {
    const tooMany = validRequest();
    tooMany.sections = Array.from({ length: 201 }, (_, position) => ({
      ...tooMany.sections[1],
      position,
    }));
    const longSummary = validRequest();
    longSummary.sections[1].summary = "a".repeat(20_001);
    const badType = validRequest();
    badType.sections[0].type = "other";

    expect(parseSharePdfRequest(tooMany, location)).toBeNull();
    expect(parseSharePdfRequest(longSummary, location)).toBeNull();
    expect(parseSharePdfRequest(badType, location)).toBeNull();
    expect(parseSharePdfRequest({ sections: [] }, location)).toBeNull();
  });
});
