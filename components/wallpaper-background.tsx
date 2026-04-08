"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

type WallpaperBackgroundProps = {
  averageColor: string;
  previewDataUrl?: string;
  url?: string;
};

export function WallpaperBackground({
  averageColor,
  previewDataUrl,
  url,
}: WallpaperBackgroundProps) {
  const [isReady, setIsReady] = useState(false);

  const markReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      requestAnimationFrame(markReady);
    }
  }, [markReady]);

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: averageColor,
        }}
      />
      {previewDataUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${previewDataUrl}")`,
            opacity: isReady ? 0 : 1,
          }}
        />
      ) : null}
      {url ? (
        <Image
          ref={handleImageRef}
          src={url}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          preload
          className="object-cover"
          style={{
            opacity: isReady ? 1 : 0,
          }}
          onLoad={(event) => {
            const image = event.currentTarget;
            image
              .decode()
              .catch(() => undefined)
              .finally(markReady);
          }}
        />
      ) : null}
    </>
  );
}
