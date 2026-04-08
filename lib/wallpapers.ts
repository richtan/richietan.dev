import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { openai } from "@ai-sdk/openai";
import { generateImage } from "ai";
import { z } from "zod";

const MANIFEST_PATH = "wallpapers/manifest.json";
const IMAGE_PREFIX = "wallpapers/macos";
const WALLPAPER_SIZE = "1536x1024";
const WALLPAPER_WIDTH = 1536;
const WALLPAPER_HEIGHT = 1024;
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;
const MANIFEST_CACHE_SECONDS = 60;

export const WALLPAPER_POOL_TARGET = 12;
export const WALLPAPER_POOL_THRESHOLD = 6;
export const WALLPAPER_BATCH_SIZE = 4;

const wallpaperSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  pathname: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.string(),
});

const wallpaperManifestSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  wallpapers: z.array(wallpaperSchema),
});

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
    version: 1,
    updatedAt: new Date(0).toISOString(),
    wallpapers: [],
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
      etag: undefined as string | undefined,
    };
  }

  const parsed = wallpaperManifestSchema.parse(JSON.parse(blob.text));
  return {
    manifest: parsed,
    etag: blob.etag,
  };
}

async function writeManifest(
  manifest: WallpaperManifest,
  etag?: string,
) {
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
    ...(etag ? { ifMatch: etag } : {}),
  });
}

function extensionFromMediaType(mediaType: string) {
  if (mediaType === "image/jpeg") {
    return "jpg";
  }

  return mediaType.split("/")[1] ?? "png";
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

  const blob = await put(pathname, Buffer.from(image.uint8Array), {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: IMAGE_CACHE_SECONDS,
    contentType: image.mediaType,
    token,
  });

  return {
    id,
    url: blob.url,
    pathname: blob.pathname,
    prompt,
    createdAt,
    width: WALLPAPER_WIDTH,
    height: WALLPAPER_HEIGHT,
    contentType: image.mediaType,
  };
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

export async function topUpWallpaperPool() {
  const { manifest, etag } = await readManifest();
  const beforeCount = manifest.wallpapers.length;

  if (!needsTopUp(manifest)) {
    return {
      generated: 0,
      skipped: true,
      total: beforeCount,
      target: WALLPAPER_POOL_TARGET,
      threshold: WALLPAPER_POOL_THRESHOLD,
    };
  }

  const count = Math.min(
    WALLPAPER_BATCH_SIZE,
    WALLPAPER_POOL_TARGET - beforeCount,
  );

  const generated: Wallpaper[] = [];
  for (let index = 0; index < count; index++) {
    generated.push(await generateWallpaperEntry());
  }

  const nextManifest: WallpaperManifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    wallpapers: [...generated, ...manifest.wallpapers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  };

  await writeManifest(nextManifest, etag);

  return {
    generated: generated.length,
    skipped: false,
    total: nextManifest.wallpapers.length,
    target: WALLPAPER_POOL_TARGET,
    threshold: WALLPAPER_POOL_THRESHOLD,
  };
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
