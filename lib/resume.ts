import "server-only";

import { get } from "@vercel/blob";
import { cached } from "@/lib/github";

// The resume lives in a private repo. Its publish workflow overwrites these two
// blobs on every push, so the blob store only ever holds the current version.
const RESUME_PDF_PATH = "resume/Richie_Tan_Resume.pdf";
const RESUME_TEX_PATH = "resume/Richie_Tan_Resume.tex";
const LATEX_CACHE_MS = 5 * 60 * 1000;

export const RESUME_PDF_FILENAME = "Richie_Tan_Resume.pdf";
export const RESUME_PDF_URL = "https://richietan.dev/resume.pdf";

async function readResumeBlob(pathname: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const result = await get(pathname, { access: "public", token });
  if (!result || result.statusCode !== 200) {
    return null;
  }

  return result;
}

/** LaTeX resume source, cached in memory with stale-on-error fallback. */
export async function getResumeLatex(): Promise<string> {
  return cached("resume-tex", LATEX_CACHE_MS, async () => {
    const result = await readResumeBlob(RESUME_TEX_PATH);
    if (!result) throw new Error("Resume source has not been published.");
    return new Response(result.stream).text();
  });
}

/** Current resume PDF as a stream, or null if it has not been published. */
export async function getResumePdf() {
  const result = await readResumeBlob(RESUME_PDF_PATH);
  if (!result) return null;

  return {
    stream: result.stream,
    size: result.blob.size,
    etag: result.blob.etag,
  };
}
