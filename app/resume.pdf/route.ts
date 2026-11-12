import { getResumePdf, RESUME_PDF_FILENAME } from "@/lib/resume";

export async function GET() {
  let pdf: Awaited<ReturnType<typeof getResumePdf>>;
  try {
    pdf = await getResumePdf();
  } catch (error) {
    console.error("Failed to load resume PDF", error);
    return new Response("Resume is temporarily unavailable.", { status: 502 });
  }

  if (!pdf) {
    return new Response("Resume not found.", { status: 404 });
  }

  return new Response(pdf.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.size),
      "Content-Disposition": `inline; filename="${RESUME_PDF_FILENAME}"`,
      // Short CDN cache so a newly published resume shows up within minutes.
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
      ETag: pdf.etag,
    },
  });
}
