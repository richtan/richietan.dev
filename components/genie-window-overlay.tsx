"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Rect, WindowTransitionPhase } from "@/lib/desktop-manager";

const TARGET_INSET_X = 7;
const TARGET_INSET_Y = 7;
const DEGRADE_FRAME_MS = 22;
const DEGRADE_STREAK = 3;
const OFFSCREEN_PAD = 6;
const PHASE_LOW_START = 0.08;
const PHASE_LOW_END = 0.92;
const BAND_OVERLAP = 0.18;
const FLAT_COLLAPSE_THRESHOLD = 0.1;
const FULL_IMAGE_COLLAPSE_THRESHOLD = 0.065;

export const GENIE_DURATION_MS = 460;

type QualityMode = "high" | "medium" | "low";
type SnapshotSource = HTMLImageElement | ImageBitmap | HTMLCanvasElement;
type SnapshotInput = string | SnapshotSource;

interface GenieWindowOverlayProps {
  phase: Exclude<WindowTransitionPhase, "idle">;
  imageSource: SnapshotInput;
  windowRect: Rect;
  targetRect: Rect;
  animationKey: number;
  onTakeover?: () => void;
  onComplete: () => void;
}

interface MeshProfile {
  mode: QualityMode;
  cols: number;
  rows: number;
  dprCap: number;
  rowData: RowData[];
  colData: ColData[];
  meshBuffer: Float32Array;
}

interface RowData {
  v: number;
  band: number;
  profile: number;
  verticalLag: number;
  cornerLag: number;
  stretch: number;
}

interface ColData {
  u: number;
  horizontalLag: number;
  cornerLag: number;
  neck: number;
  stretch: number;
}

const QUALITY_PRESETS: Record<
  QualityMode,
  {
    dprCap: number;
    minCols: number;
    maxCols: number;
    minRows: number;
    maxRows: number;
    targetCellX: number;
    targetCellY: number;
    inflation: number;
    tinyQuadArea: number;
    subdivideQuadArea: number;
    microSubdivideQuadArea: number;
    subdivideDistortion: number;
    microSubdivideDistortion: number;
  }
> = {
  high: {
    dprCap: 1,
    minCols: 12,
    maxCols: 15,
    minRows: 14,
    maxRows: 19,
    targetCellX: 86,
    targetCellY: 52,
    inflation: 0.28,
    tinyQuadArea: 1,
    subdivideQuadArea: 2_500,
    microSubdivideQuadArea: 5_000,
    subdivideDistortion: 0.038,
    microSubdivideDistortion: 0.082,
  },
  medium: {
    dprCap: 0.92,
    minCols: 10,
    maxCols: 13,
    minRows: 12,
    maxRows: 17,
    targetCellX: 102,
    targetCellY: 60,
    inflation: 0.2,
    tinyQuadArea: 1.45,
    subdivideQuadArea: 3_600,
    microSubdivideQuadArea: 6_200,
    subdivideDistortion: 0.046,
    microSubdivideDistortion: 0.095,
  },
  low: {
    dprCap: 0.8,
    minCols: 8,
    maxCols: 10,
    minRows: 10,
    maxRows: 13,
    targetCellX: 132,
    targetCellY: 76,
    inflation: 0.14,
    tinyQuadArea: 2,
    subdivideQuadArea: 6_000,
    microSubdivideQuadArea: 9_000,
    subdivideDistortion: 0.058,
    microSubdivideDistortion: 0.11,
  },
};

export function GenieWindowOverlay({
  phase,
  imageSource,
  windowRect,
  targetRect,
  animationKey,
  onTakeover,
  onComplete,
}: GenieWindowOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [resolvedImageSource, setResolvedImageSource] = useState<SnapshotSource | null>(null);
  const hasTakenOverRef = useRef(false);
  const directImageSource = typeof imageSource === "string" ? null : imageSource;
  const activeImageSource = directImageSource ?? resolvedImageSource;
  const towardIcon = phase === "minimizing-genie";
  const collapseTarget = useMemo(
    () => insetRect(targetRect, TARGET_INSET_X, TARGET_INSET_Y),
    [targetRect],
  );
  const profiles = useMemo(() => createProfiles(windowRect), [windowRect]);

  useEffect(() => {
    if (typeof imageSource !== "string") {
      return;
    }

    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
    const nextImage = new Image();
    nextImage.decoding = "async";

    const finalize = async () => {
      let resolvedSource: SnapshotSource = nextImage;

      if ("createImageBitmap" in window) {
        try {
          bitmap = await createImageBitmap(nextImage);
          resolvedSource = bitmap;
        } catch {
          bitmap = null;
        }
      }

      if (!cancelled) {
        setResolvedImageSource(resolvedSource);
        return;
      }

      bitmap?.close();
    };

    nextImage.onload = () => {
      if (nextImage.complete) {
        void nextImage.decode().catch(() => undefined).finally(() => {
          void finalize();
        });
        return;
      }

      void finalize();
    };
    nextImage.src = imageSource;

    if (nextImage.complete) {
      void nextImage.decode().catch(() => undefined).finally(() => {
        void finalize();
      });
    }

    return () => {
      cancelled = true;
      nextImage.onload = null;
      bitmap?.close();
    };
  }, [imageSource]);

  useEffect(() => {
    hasTakenOverRef.current = false;
  }, [animationKey]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      onComplete();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !activeImageSource) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      onComplete();
      return;
    }

    let frameId = 0;
    let startTime = 0;
    let previousFrameTime = 0;
    let slowFrameStreak = 0;
    let cancelled = false;
    let currentBaseQuality = getInitialQuality(windowRect);
    let currentCanvasDpr = 0;

    const resizeCanvas = (dprCap: number) => {
      const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (
        currentCanvasDpr === nextDpr &&
        canvas.width === Math.max(1, Math.round(width * nextDpr)) &&
        canvas.height === Math.max(1, Math.round(height * nextDpr))
      ) {
        return { dpr: nextDpr, width, height };
      }

      currentCanvasDpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * nextDpr));
      canvas.height = Math.max(1, Math.round(height * nextDpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      return { dpr: nextDpr, width, height };
    };

    let viewport = resizeCanvas(profiles[currentBaseQuality].dprCap);

    const handleResize = () => {
      viewport = resizeCanvas(profiles[currentBaseQuality].dprCap);
    };

    window.addEventListener("resize", handleResize);

    const step = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      if (startTime === 0) {
        startTime = timestamp;
        previousFrameTime = timestamp;
      }

      const frameDuration = timestamp - previousFrameTime;
      previousFrameTime = timestamp;

      if (frameDuration > DEGRADE_FRAME_MS) {
        slowFrameStreak += 1;
      } else {
        slowFrameStreak = 0;
      }

      if (slowFrameStreak >= DEGRADE_STREAK) {
        const degradedQuality = demoteQuality(currentBaseQuality);
        if (degradedQuality !== currentBaseQuality) {
          currentBaseQuality = degradedQuality;
          viewport = resizeCanvas(profiles[currentBaseQuality].dprCap);
        }
        slowFrameStreak = 0;
      }

      const linearProgress = clamp((timestamp - startTime) / GENIE_DURATION_MS, 0, 1);
      const eased = easeInOutCubic(linearProgress);
      const collapse = towardIcon ? eased : 1 - eased;
      const renderQuality = getPhaseQuality(currentBaseQuality, linearProgress);
      const profile = profiles[renderQuality];

      fillMeshBuffer(profile, windowRect, collapseTarget, collapse);

      drawMeshFrame({
        context,
        imageSource: activeImageSource,
        sourceRect: windowRect,
        viewport,
        profile,
        collapse,
      });

      if (!hasTakenOverRef.current) {
        hasTakenOverRef.current = true;
        onTakeover?.();
      }

      if (linearProgress >= 1) {
        if (!towardIcon) {
          window.requestAnimationFrame(() => {
            if (!cancelled) {
              onComplete();
            }
          });
          return;
        }

        onComplete();
        return;
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [
    animationKey,
    activeImageSource,
    collapseTarget,
    onComplete,
    onTakeover,
    profiles,
    towardIcon,
    windowRect,
  ]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ contain: "strict" }}
      />
    </div>
  );
}

function drawMeshFrame({
  context,
  imageSource,
  sourceRect,
  viewport,
  profile,
  collapse,
}: {
  context: CanvasRenderingContext2D;
  imageSource: SnapshotSource;
  sourceRect: Rect;
  viewport: { dpr: number; width: number; height: number };
  profile: MeshProfile;
  collapse: number;
}) {
  const { dpr, width, height } = viewport;
  const { cols, rows, meshBuffer, mode } = profile;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (collapse <= FULL_IMAGE_COLLAPSE_THRESHOLD) {
    context.drawImage(
      imageSource,
      0,
      0,
      sourceRect.width,
      sourceRect.height,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
    );
    return;
  }

  const bandSubdivisions = getBandSubdivisions(mode, collapse);

  for (let row = 0; row < rows; row += 1) {
    const leftTopIndex = getMeshIndex(row, 0, cols);
    const rightTopIndex = getMeshIndex(row, cols, cols);
    const leftBottomIndex = getMeshIndex(row + 1, 0, cols);
    const rightBottomIndex = getMeshIndex(row + 1, cols, cols);

    const leftTop = {
      x: meshBuffer[leftTopIndex]!,
      y: meshBuffer[leftTopIndex + 1]!,
    };
    const rightTop = {
      x: meshBuffer[rightTopIndex]!,
      y: meshBuffer[rightTopIndex + 1]!,
    };
    const leftBottom = {
      x: meshBuffer[leftBottomIndex]!,
      y: meshBuffer[leftBottomIndex + 1]!,
    };
    const rightBottom = {
      x: meshBuffer[rightBottomIndex]!,
      y: meshBuffer[rightBottomIndex + 1]!,
    };

    for (let band = 0; band < bandSubdivisions; band += 1) {
      const t0 = band / bandSubdivisions;
      const t1 = (band + 1) / bandSubdivisions;
      const overlapT = bandSubdivisions > 1 ? BAND_OVERLAP / bandSubdivisions : 0;
      const sampleT0 = Math.max(0, t0 - overlapT);
      const sampleT1 = Math.min(1, t1 + overlapT);
      const quadTl = midpointLerp(
        leftTop.x,
        leftTop.y,
        leftBottom.x,
        leftBottom.y,
        sampleT0,
      );
      const quadTr = midpointLerp(
        rightTop.x,
        rightTop.y,
        rightBottom.x,
        rightBottom.y,
        sampleT0,
      );
      const quadBl = midpointLerp(
        leftTop.x,
        leftTop.y,
        leftBottom.x,
        leftBottom.y,
        sampleT1,
      );
      const quadBr = midpointLerp(
        rightTop.x,
        rightTop.y,
        rightBottom.x,
        rightBottom.y,
        sampleT1,
      );

      const minX = Math.min(quadTl.x, quadTr.x, quadBr.x, quadBl.x);
      const maxX = Math.max(quadTl.x, quadTr.x, quadBr.x, quadBl.x);
      const minY = Math.min(quadTl.y, quadTr.y, quadBr.y, quadBl.y);
      const maxY = Math.max(quadTl.y, quadTr.y, quadBr.y, quadBl.y);

      if (
        maxX < -OFFSCREEN_PAD ||
        minX > width + OFFSCREEN_PAD ||
        maxY < -OFFSCREEN_PAD ||
        minY > height + OFFSCREEN_PAD
      ) {
        continue;
      }

      const drawWidth = Math.max(
        1,
        ((quadTr.x - quadTl.x) + (quadBr.x - quadBl.x)) / 2 + 1,
      );
      const drawHeight = Math.max(1, maxY - minY + 1);
      if (drawWidth * drawHeight <= 1) {
        continue;
      }

      const sourceY = sourceRect.height * ((row + sampleT0) / rows);
      const sourceHeight = Math.max(
        1 / Math.max(1, dpr),
        sourceRect.height * ((sampleT1 - sampleT0) / rows),
      );
      const averageLeftX = (quadTl.x + quadBl.x) / 2 - 0.5;

      context.save();
      context.beginPath();
      context.moveTo(quadTl.x, quadTl.y);
      context.lineTo(quadTr.x, quadTr.y);
      context.lineTo(quadBr.x, quadBr.y);
      context.lineTo(quadBl.x, quadBl.y);
      context.closePath();
      context.clip();
      context.drawImage(
        imageSource,
        0,
        sourceY,
        sourceRect.width,
        sourceHeight,
        averageLeftX,
        minY - 0.5,
        drawWidth,
        drawHeight,
      );
      context.restore();
    }
  }
}

function createProfiles(rect: Rect): Record<QualityMode, MeshProfile> {
  return {
    high: createMeshProfile(rect, "high"),
    medium: createMeshProfile(rect, "medium"),
    low: createMeshProfile(rect, "low"),
  };
}

function createMeshProfile(rect: Rect, mode: QualityMode): MeshProfile {
  const preset = QUALITY_PRESETS[mode];
  const cols = clampInt(
    Math.round(rect.width / preset.targetCellX),
    preset.minCols,
    preset.maxCols,
  );
  const rows = clampInt(
    Math.round(rect.height / preset.targetCellY),
    preset.minRows,
    preset.maxRows,
  );

  return {
    mode,
    cols,
    rows,
    dprCap: preset.dprCap,
    rowData: buildRowData(rows),
    colData: buildColData(cols),
    meshBuffer: new Float32Array((cols + 1) * (rows + 1) * 2),
  };
}

function buildRowData(rows: number) {
  return Array.from({ length: rows + 1 }, (_, index) => {
    const v = index / rows;
    const band = Math.sin(v * Math.PI);

    return {
      v,
      band,
      profile: Math.pow(band, 0.92),
      verticalLag: Math.pow(1 - v, 1.5) * 0.22,
      cornerLag: Math.pow(Math.abs(v - 0.5) * 2, 1.18),
      stretch: Math.pow(1 - v, 1.18),
    };
  });
}

function buildColData(cols: number) {
  return Array.from({ length: cols + 1 }, (_, index) => {
    const u = index / cols;
    return {
      u,
      horizontalLag: Math.pow(1 - u, 1.9) * 0.62,
      cornerLag: Math.pow(1 - u, 1.15) * 0.085,
      neck: Math.pow(1 - u, 0.72),
      stretch: Math.pow(1 - u, 0.68),
    };
  });
}

function fillMeshBuffer(
  profile: MeshProfile,
  sourceRect: Rect,
  targetRect: Rect,
  collapse: number,
) {
  const { rows, cols, rowData, colData, meshBuffer } = profile;
  let pointer = 0;

  for (let row = 0; row <= rows; row += 1) {
    const rowProfile = rowData[row]!;
    const sourceY = sourceRect.y + sourceRect.height * rowProfile.v;

    const targetWidth = targetRect.width * (0.66 + rowProfile.profile * 0.26);
    const centerShift = (0.5 - rowProfile.v) * targetRect.width * 0.08;
    const targetCenterX = targetRect.x + targetRect.width / 2 + centerShift;
    const targetLeft = targetCenterX - targetWidth / 2;
    const targetY = targetRect.y + targetRect.height * rowProfile.v;
    const targetCenterBase = targetRect.x + targetRect.width / 2;

    for (let col = 0; col <= cols; col += 1) {
      const colProfile = colData[col]!;
      const sourceX = sourceRect.x + sourceRect.width * colProfile.u;

      if (collapse <= 0.0001) {
        meshBuffer[pointer] = sourceX;
        meshBuffer[pointer + 1] = sourceY;
        pointer += 2;
        continue;
      }

      const finalX = targetLeft + targetWidth * colProfile.u;
      const finalY = targetY;
      const lag = Math.min(
        0.87,
        colProfile.horizontalLag +
          rowProfile.verticalLag +
          colProfile.cornerLag * rowProfile.cornerLag,
      );
      const pullX = smoothstep(lag * 0.42, 1, collapse);
      const pullY = smoothstep(lag * 0.82, 1, collapse);

      let x = mix(sourceX, finalX, pullX);
      let y = mix(sourceY, finalY, pullY);

      const neckPull =
        smoothstep(0.16, 0.94, collapse) *
        colProfile.neck *
        (0.095 + rowProfile.band * 0.08);
      x += (targetCenterBase - x) * neckPull;

      const verticalStretch =
        smoothstep(0.24, 1, collapse) *
        colProfile.stretch *
        rowProfile.stretch;
      y += (finalY - y) * verticalStretch * 0.24;

      meshBuffer[pointer] = x;
      meshBuffer[pointer + 1] = y;
      pointer += 2;
    }
  }
}

function getInitialQuality(rect: Rect): QualityMode {
  const area = rect.width * rect.height;

  if (area >= 850_000) {
    return "medium";
  }

  return "high";
}

function getPhaseQuality(baseQuality: QualityMode, progress: number): QualityMode {
  if (progress <= PHASE_LOW_START || progress >= PHASE_LOW_END) {
    return demoteQuality(baseQuality);
  }

  return baseQuality;
}

function demoteQuality(mode: QualityMode): QualityMode {
  switch (mode) {
    case "high":
      return "medium";
    case "medium":
      return "low";
    default:
      return "low";
  }
}

function midpointLerp(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  amount: number,
) {
  return {
    x: mix(ax, bx, amount),
    y: mix(ay, by, amount),
  };
}

function getMeshIndex(row: number, col: number, cols: number) {
  return (row * (cols + 1) + col) * 2;
}

function insetRect(rect: Rect, insetX: number, insetY: number): Rect {
  return {
    x: rect.x + insetX,
    y: rect.y + insetY,
    width: Math.max(8, rect.width - insetX * 2),
    height: Math.max(8, rect.height - insetY * 2),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function getBandSubdivisions(mode: QualityMode, collapse: number) {
  if (collapse <= FLAT_COLLAPSE_THRESHOLD) {
    return 1;
  }

  switch (mode) {
    case "high":
      return 8;
    case "medium":
      return 7;
    default:
      return 6;
  }
}
