"use client";

import type { Rect } from "@/lib/use-window-state";

const SNAPSHOT_CACHE_KEY = "richietan.dev::claude-window-snapshot";
const SNAPSHOT_CACHE_VERSION = 3;
const SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;

export interface CachedWindowSnapshot {
  version: number;
  src: string;
  width: number;
  height: number;
  savedAt: number;
}

export function readCachedWindowSnapshot(): CachedWindowSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedWindowSnapshot>;
    if (
      parsed.version !== SNAPSHOT_CACHE_VERSION ||
      typeof parsed.src !== "string" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS) {
      clearCachedWindowSnapshot();
      return null;
    }

    return parsed as CachedWindowSnapshot;
  } catch {
    return null;
  }
}

export function writeCachedWindowSnapshot(
  src: string,
  rect: Pick<Rect, "width" | "height">,
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CachedWindowSnapshot = {
    version: SNAPSHOT_CACHE_VERSION,
    src,
    width: rect.width,
    height: rect.height,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota failures; in-memory fallback still works.
  }
}

export function clearCachedWindowSnapshot() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SNAPSHOT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function isCachedWindowSnapshotCompatible(
  snapshot: CachedWindowSnapshot | null,
  rect: Pick<Rect, "width" | "height">,
) {
  if (!snapshot) {
    return false;
  }

  const widthDelta = Math.abs(snapshot.width - rect.width);
  const heightDelta = Math.abs(snapshot.height - rect.height);
  const aspectDelta = Math.abs(
    snapshot.width / snapshot.height - rect.width / rect.height,
  );

  return widthDelta <= 8 && heightDelta <= 8 && aspectDelta <= 0.004;
}

export function isCachedWindowSnapshotOpeningCompatible(
  snapshot: CachedWindowSnapshot | null,
  rect: Pick<Rect, "width" | "height">,
) {
  if (!snapshot) {
    return false;
  }

  const widthDelta = Math.abs(snapshot.width - rect.width);
  const heightDelta = Math.abs(snapshot.height - rect.height);
  const aspectDelta = Math.abs(
    snapshot.width / snapshot.height - rect.width / rect.height,
  );

  return widthDelta <= 280 && heightDelta <= 220 && aspectDelta <= 0.12;
}
