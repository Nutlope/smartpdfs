type PresignedPdfPost = {
  url: string;
  fields: Record<string, string>;
  key: string;
  pdfUrl: string;
};

export async function uploadPdf(file: File) {
  const signResponse = await fetch("/api/s3-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!signResponse.ok) {
    throw new Error(
      await getErrorMessage(signResponse, "The PDF could not be uploaded"),
    );
  }

  const post = (await signResponse.json()) as PresignedPdfPost;
  const form = new FormData();
  for (const [name, value] of Object.entries(post.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  const uploadResponse = await fetch(post.url, {
    method: "POST",
    body: form,
  });
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload PDF directly to S3");
  }

  return { key: post.key, url: post.pdfUrl };
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}
