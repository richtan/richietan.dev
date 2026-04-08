import { connection } from "next/server";
import { preconnect, preload } from "react-dom";
import { HomeShellLoader } from "@/components/home-shell-loader";
import { getRandomWallpaper } from "@/lib/wallpapers";

const FALLBACK_BACKGROUND =
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 52%, #0f3460 100%)";

export default async function Home() {
  await connection();

  const wallpaper = await getRandomWallpaper();

  if (wallpaper) {
    preconnect(new URL(wallpaper.url).origin);
    preload(wallpaper.url, {
      as: "image",
      fetchPriority: "high",
    });
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: FALLBACK_BACKGROUND,
        }}
      />
      {wallpaper ? (
        <img
          src={wallpaper.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : null}

      <div className="relative z-10 h-dvh w-full">
        <HomeShellLoader />
      </div>
    </main>
  );
}
