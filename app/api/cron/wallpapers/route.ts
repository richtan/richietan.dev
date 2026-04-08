import { topUpWallpaperPool, isCronRequestAuthorized } from "@/lib/wallpapers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await topUpWallpaperPool();
    return Response.json(result);
  } catch (error) {
    console.error("Wallpaper cron failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Wallpaper generation failed.",
      },
      { status: 500 },
    );
  }
}
