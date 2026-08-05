import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import {
  createPdfObjectKey,
  PDF_UPLOAD_EXPIRY_SECONDS,
  type PdfUploadRequest,
} from "./pdf-upload";
import { getS3 } from "./s3client";

const PDF_CONTENT_DISPOSITION = 'inline; filename="document.pdf"';

export async function createPdfUploadPost(request: PdfUploadRequest) {
  const { bucket, client, region } = getS3();
  const key = createPdfObjectKey();
  const post = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: PDF_UPLOAD_EXPIRY_SECONDS,
    Fields: {
      "Content-Type": request.contentType,
      "Content-Disposition": PDF_CONTENT_DISPOSITION,
    },
    Conditions: [
      ["eq", "$Content-Type", request.contentType],
      ["eq", "$Content-Disposition", PDF_CONTENT_DISPOSITION],
      ["content-length-range", 1, request.size],
    ],
  });

  return {
    ...post,
    key,
    pdfUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    expiresIn: PDF_UPLOAD_EXPIRY_SECONDS,
    maxBytes: request.size,
  };
}
