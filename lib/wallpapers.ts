import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { openai } from "@ai-sdk/openai";
import { generateImage } from "ai";
import sharp from "sharp";
import { z } from "zod";

const MANIFEST_PATH = "wallpapers/manifest.json";
const IMAGE_PREFIX = "wallpapers/macos";
const WALLPAPER_SIZE = "1536x1024";
const WALLPAPER_WIDTH = 1536;
const WALLPAPER_HEIGHT = 1024;
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;
const MANIFEST_CACHE_SECONDS = 0;
const MANIFEST_VERSION = 3;
const PREVIEW_WIDTH = 128;
const PREVIEW_QUALITY = 72;
const MANIFEST_WRITE_RETRIES = 2;

export const WALLPAPER_POOL_TARGET = 12;
export const WALLPAPER_POOL_THRESHOLD = 6;
export const WALLPAPER_BATCH_SIZE = 4;

const wallpaperCoreSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  pathname: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.string(),
});

const wallpaperV2Schema = wallpaperCoreSchema.extend({
  blurDataUrl: z.string().optional(),
  averageColor: z.string().optional(),
});

const wallpaperSchema = wallpaperCoreSchema.extend({
  previewDataUrl: z.string().optional(),
  averageColor: z.string().optional(),
});

const legacyWallpaperManifestSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  wallpapers: z.array(wallpaperCoreSchema),
});

const wallpaperManifestV2Schema = z.object({
  version: z.literal(2),
  updatedAt: z.string(),
  wallpapers: z.array(wallpaperV2Schema),
});

const wallpaperManifestSchema = z.object({
  version: z.literal(MANIFEST_VERSION),
  updatedAt: z.string(),
  wallpapers: z.array(wallpaperSchema),
});

const anyWallpaperManifestSchema = z.union([
  legacyWallpaperManifestSchema,
  wallpaperManifestV2Schema,
  wallpaperManifestSchema,
]);

export type Wallpaper = z.infer<typeof wallpaperSchema>;
type WallpaperManifest = z.infer<typeof wallpaperManifestSchema>;

const palettePrompts = [
  "midnight graphite, cool silver, and soft pearl highlights",
  "deep navy, slate, charcoal, and subtle moonlit cyan accents",
  "stormy blue-gray, black glass, and faint silver glow",
  "smoky indigo, charcoal, and pale steel light bands",
  "obsidian, ash gray, and restrained electric blue reflections",
];

const compositionPrompts = [
  "an abstract premium operating-system wallpaper with smooth atmospheric gradients and flowing glass-like light ribbons",
  "a minimal desktop wallpaper with soft aurora-like bands drifting across a dark atmospheric horizon",
  "a cinematic abstract landscape of blurred light fields and premium glassy gradients",
  "a polished operating-system wallpaper with layered fog, luminous arcs, and elegant negative space",
  "a restrained futuristic desktop backdrop with soft light trails, mist, and subtle depth",
];

const structurePrompts = [
  "Keep the composition clean, low-detail, and calm enough to sit behind desktop windows.",
  "Leave broad negative space and avoid busy focal points so UI remains readable.",
  "Use gentle motion cues and broad shapes rather than intricate detail.",
  "Favor soft atmosphere and premium material lighting over literal scenes.",
];

function emptyManifest(): WallpaperManifest {
  return {
    version: MANIFEST_VERSION,
    updatedAt: new Date(0).toISOString(),
    wallpapers: [],
  };
}

function normalizeManifest(
  manifest: z.infer<typeof anyWallpaperManifestSchema>,
): WallpaperManifest {
  if (manifest.version === MANIFEST_VERSION) {
    return manifest;
  }

  if (manifest.version === 2) {
    return {
      version: MANIFEST_VERSION,
      updatedAt: manifest.updatedAt,
      wallpapers: manifest.wallpapers.map((wallpaper) => ({
        id: wallpaper.id,
        url: wallpaper.url,
        pathname: wallpaper.pathname,
        prompt: wallpaper.prompt,
        createdAt: wallpaper.createdAt,
        width: wallpaper.width,
        height: wallpaper.height,
        contentType: wallpaper.contentType,
        averageColor: wallpaper.averageColor,
      })),
    };
  }

  return {
    version: MANIFEST_VERSION,
    updatedAt: manifest.updatedAt,
    wallpapers: manifest.wallpapers,
  };
}

function pickRandom<T>(values: T[]): T {
  return values[randomInt(values.length)];
}

function buildWallpaperPrompt() {
  return [
    "Create an original macOS-inspired desktop wallpaper for a premium operating system.",
    pickRandom(compositionPrompts),
    `Color palette: ${pickRandom(palettePrompts)}.`,
    pickRandom(structurePrompts),
    "Landscape 3:2 composition.",
    "No text, logos, interface chrome, icons, people, animals, buildings, or watermarks.",
    "Do not imitate or reproduce any copyrighted Apple wallpaper exactly.",
  ].join(" ");
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function getCronSecret() {
  return process.env.CRON_SECRET;
}

async function readBlobText(pathname: string) {
  const token = getBlobToken();
  if (!token) {
    return null;
  }

  const result = await get(pathname, {
    access: "public",
    token,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await new Response(result.stream).text();
  return {
    text,
    etag: result.blob.etag,
  };
}

async function readManifest() {
  const blob = await readBlobText(MANIFEST_PATH);
  if (!blob) {
    return {
      manifest: emptyManifest(),
      needsRewrite: false,
    };
  }

  const parsed = anyWallpaperManifestSchema.parse(JSON.parse(blob.text));
  return {
    manifest: normalizeManifest(parsed),
    needsRewrite: parsed.version !== MANIFEST_VERSION,
  };
}

async function writeManifest(manifest: WallpaperManifest) {
  const token = getBlobToken();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  await put(MANIFEST_PATH, JSON.stringify(manifest, null, 2), {
    access: "public",
    allowOverwrite: true,
    cacheControlMaxAge: MANIFEST_CACHE_SECONDS,
    contentType: "application/json; charset=utf-8",
    token,
  });
}

function extensionFromMediaType(mediaType: string) {
  if (mediaType === "image/jpeg") {
    return "jpg";
  }

  return mediaType.split("/")[1] ?? "png";
}

async function buildWallpaperPreview(buffer: Buffer) {
  const previewBuffer = await sharp(buffer)
    .resize({ width: PREVIEW_WIDTH })
    .webp({ quality: PREVIEW_QUALITY })
    .toBuffer();

  const averagePixel = await sharp(buffer)
    .resize(1, 1, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  return {
    previewDataUrl: `data:image/webp;base64,${previewBuffer.toString("base64")}`,
    averageColor: rgbToHex(
      averagePixel[0] ?? 26,
      averagePixel[1] ?? 26,
      averagePixel[2] ?? 46,
    ),
  };
}

async function withWallpaperPreview(
  wallpaper: Omit<Wallpaper, "previewDataUrl" | "averageColor">,
  buffer: Buffer,
): Promise<Wallpaper> {
  try {
    const preview = await buildWallpaperPreview(buffer);
    return {
      ...wallpaper,
      ...preview,
    };
  } catch (error) {
    console.error("Failed to derive wallpaper preview:", error);
    return wallpaper;
  }
}

async function generateWallpaperEntry(): Promise<Wallpaper> {
  const token = getBlobToken();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const prompt = buildWallpaperPrompt();
  const { image } = await generateImage({
    model: openai.image("gpt-image-1.5"),
    prompt,
    size: WALLPAPER_SIZE,
    providerOptions: {
      openai: {
        background: "opaque",
        output_format: "webp",
        quality: "medium",
      },
    },
  });

  const createdAt = new Date().toISOString();
  const extension = extensionFromMediaType(image.mediaType);
  const id = randomUUID();
  const pathname = `${IMAGE_PREFIX}/${createdAt.slice(0, 10)}/${id}.${extension}`;
  const imageBuffer = Buffer.from(image.uint8Array);

  const blob = await put(pathname, imageBuffer, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: IMAGE_CACHE_SECONDS,
    contentType: image.mediaType,
    token,
  });

  return withWallpaperPreview(
    {
      id,
      url: blob.url,
      pathname: blob.pathname,
      prompt,
      createdAt,
      width: WALLPAPER_WIDTH,
      height: WALLPAPER_HEIGHT,
      contentType: image.mediaType,
    },
    imageBuffer,
  );
}

async function backfillWallpaperPreview(wallpaper: Wallpaper) {
  if (wallpaper.previewDataUrl && wallpaper.averageColor) {
    return {
      wallpaper,
      updated: false,
    };
  }

  const token = getBlobToken();
  if (!token) {
    return {
      wallpaper,
      updated: false,
    };
  }

  try {
    const result = await get(wallpaper.pathname, {
      access: "public",
      token,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return {
        wallpaper,
        updated: false,
      };
    }

    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    return {
      wallpaper: await withWallpaperPreview(wallpaper, buffer),
      updated: true,
    };
  } catch (error) {
    console.error("Failed to backfill wallpaper preview:", error);
    return {
      wallpaper,
      updated: false,
    };
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export async function getWallpaperManifest() {
  const { manifest } = await readManifest();
  return manifest;
}

export async function getRandomWallpaper() {
  try {
    const { manifest } = await readManifest();
    if (manifest.wallpapers.length === 0) {
      return null;
    }

    return pickRandom(manifest.wallpapers);
  } catch (error) {
    console.error("Failed to read wallpaper manifest:", error);
    return null;
  }
}

export function needsTopUp(manifest: WallpaperManifest) {
  return manifest.wallpapers.length < WALLPAPER_POOL_THRESHOLD;
}

async function topUpWallpaperPoolOnce() {
  const { manifest, needsRewrite } = await readManifest();
  const beforeCount = manifest.wallpapers.length;

  let nextWallpapers = manifest.wallpapers;
  let backfilled = 0;

  if (
    nextWallpapers.some(
      (wallpaper) => !wallpaper.previewDataUrl || !wallpaper.averageColor,
    )
  ) {
    const enriched: Wallpaper[] = [];
    for (const wallpaper of nextWallpapers) {
      const result = await backfillWallpaperPreview(wallpaper);
      enriched.push(result.wallpaper);
      if (result.updated) {
        backfilled += 1;
      }
    }
    nextWallpapers = enriched;
  }

  if (!needsTopUp({ ...manifest, wallpapers: nextWallpapers })) {
    if (backfilled > 0 || needsRewrite) {
      await writeManifest({
        version: MANIFEST_VERSION,
        updatedAt: new Date().toISOString(),
        wallpapers: nextWallpapers,
      });
    }

    return {
      generated: 0,
      backfilled,
      skipped: backfilled === 0,
      total: nextWallpapers.length,
      target: WALLPAPER_POOL_TARGET,
      threshold: WALLPAPER_POOL_THRESHOLD,
    };
  }

  const count = Math.min(
    WALLPAPER_BATCH_SIZE,
    WALLPAPER_POOL_TARGET - beforeCount,
  );

  const generated: Wallpaper[] = [];
  for (let index = 0; index < count; index += 1) {
    generated.push(await generateWallpaperEntry());
  }

  const nextManifest: WallpaperManifest = {
    version: MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    wallpapers: [...generated, ...nextWallpapers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  };

  await writeManifest(nextManifest);

  return {
    generated: generated.length,
    backfilled,
    skipped: false,
    total: nextManifest.wallpapers.length,
    target: WALLPAPER_POOL_TARGET,
    threshold: WALLPAPER_POOL_THRESHOLD,
  };
}

export async function topUpWallpaperPool() {
  let attempt = 0;

  while (true) {
    try {
      return await topUpWallpaperPoolOnce();
    } catch (error) {
      if (!isManifestWriteConflict(error) || attempt >= MANIFEST_WRITE_RETRIES) {
        throw error;
      }

      attempt += 1;
    }
  }
}

function isManifestWriteConflict(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("ETag mismatch") ||
    error.message.includes("Precondition failed")
  );
}

export function isCronRequestAuthorized(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const secret = getCronSecret();
  if (!secret) {
    throw new Error("CRON_SECRET is not configured.");
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
