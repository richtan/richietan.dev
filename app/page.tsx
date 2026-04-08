import { connection } from "next/server";
import { HomeShellLoader } from "@/components/home-shell-loader";
import { WallpaperBackground } from "@/components/wallpaper-background";
import { getRandomWallpaper } from "@/lib/wallpapers";

const FALLBACK_BACKGROUND =
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 52%, #0f3460 100%)";

export default async function Home() {
  await connection();

  const wallpaper = await getRandomWallpaper();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <WallpaperBackground
        key={wallpaper?.url ?? "wallpaper-fallback"}
        averageColor={wallpaper?.averageColor ?? FALLBACK_BACKGROUND}
        previewDataUrl={wallpaper?.previewDataUrl}
        url={wallpaper?.url}
      />

      <div className="relative z-10 h-dvh w-full">
        <HomeShellLoader />
      </div>
    </main>
  );
}
