"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Rect, WindowTransitionPhase } from "@/lib/use-window-state";

const TARGET_INSET_X = 7;
const TARGET_INSET_Y = 7;
const MAX_CANVAS_DPR = 1.2;
const MIN_GRID_COLS = 10;
const MAX_GRID_COLS = 15;
const MIN_GRID_ROWS = 14;
const MAX_GRID_ROWS = 20;
const TARGET_CELL_SIZE_X = 74;
const TARGET_CELL_SIZE_Y = 46;

export const GENIE_DURATION_MS = 460;

interface GenieWindowOverlayProps {
  phase: Exclude<WindowTransitionPhase, "idle">;
  imageSrc: string;
  windowRect: Rect;
  targetRect: Rect;
  animationKey: number;
  onTakeover?: () => void;
  onComplete: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface SourceCell {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

interface MeshConfig {
  cols: number;
  rows: number;
}

export function GenieWindowOverlay({
  phase,
  imageSrc,
  windowRect,
  targetRect,
  animationKey,
  onTakeover,
  onComplete,
}: GenieWindowOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const hasTakenOverRef = useRef(false);
  const towardIcon = phase === "minimizing-genie";
  const collapseTarget = useMemo(
    () => insetRect(targetRect, TARGET_INSET_X, TARGET_INSET_Y),
    [targetRect],
  );
  const meshConfig = useMemo(() => getMeshConfig(windowRect), [windowRect]);
  const sourceCells = useMemo(
    () => buildSourceCells(windowRect, meshConfig),
    [meshConfig, windowRect],
  );

  useEffect(() => {
    let cancelled = false;
    const nextImage = new Image();
    nextImage.decoding = "async";

    const finalize = () => {
      if (!cancelled) {
        setImage(nextImage);
      }
    };

    nextImage.onload = finalize;
    nextImage.src = imageSrc;

    if (nextImage.complete) {
      void nextImage.decode().catch(() => undefined).finally(finalize);
    }

    return () => {
      cancelled = true;
      nextImage.onload = null;
    };
  }, [imageSrc]);

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
    if (!canvas || !image) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      onComplete();
      return;
    }

    let frameId = 0;
    let startTime = 0;
    let cancelled = false;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      return { dpr, width, height };
    };

    let viewport = resizeCanvas();

    const handleResize = () => {
      viewport = resizeCanvas();
    };

    window.addEventListener("resize", handleResize);

    const step = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      if (startTime === 0) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const linearProgress = clamp(elapsed / GENIE_DURATION_MS, 0, 1);
      const eased = easeInOutCubic(linearProgress);
      const collapse = towardIcon ? eased : 1 - eased;
      const mesh = buildMesh(windowRect, collapseTarget, collapse, meshConfig);

      drawMeshFrame({
        context,
        image,
        viewport,
        sourceRect: windowRect,
        sourceCells,
        meshConfig,
        mesh,
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
    collapseTarget,
    image,
    meshConfig,
    onTakeover,
    onComplete,
    sourceCells,
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
  image,
  viewport,
  sourceRect,
  sourceCells,
  meshConfig,
  mesh,
}: {
  context: CanvasRenderingContext2D;
  image: HTMLImageElement;
  viewport: { dpr: number; width: number; height: number };
  sourceRect: Rect;
  sourceCells: SourceCell[];
  meshConfig: MeshConfig;
  mesh: Point[];
}) {
  const { dpr, width, height } = viewport;
  const { cols, rows } = meshConfig;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellIndex = row * cols + col;
      const sourceCell = sourceCells[cellIndex];
      if (!sourceCell) {
        continue;
      }

      const topLeft = mesh[getMeshIndex(row, col, cols)];
      const topRight = mesh[getMeshIndex(row, col + 1, cols)];
      const bottomRight = mesh[getMeshIndex(row + 1, col + 1, cols)];
      const bottomLeft = mesh[getMeshIndex(row + 1, col, cols)];

      if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
        continue;
      }

      const even = (row + col) % 2 === 0;

      if (even) {
        drawTexturedTriangle(
          context,
          image,
          sourceRect,
          [sourceCell.topLeft, sourceCell.topRight, sourceCell.bottomRight],
          inflateTriangle([topLeft, topRight, bottomRight], 0.42),
        );
        drawTexturedTriangle(
          context,
          image,
          sourceRect,
          [sourceCell.topLeft, sourceCell.bottomRight, sourceCell.bottomLeft],
          inflateTriangle([topLeft, bottomRight, bottomLeft], 0.42),
        );
      } else {
        drawTexturedTriangle(
          context,
          image,
          sourceRect,
          [sourceCell.topLeft, sourceCell.topRight, sourceCell.bottomLeft],
          inflateTriangle([topLeft, topRight, bottomLeft], 0.42),
        );
        drawTexturedTriangle(
          context,
          image,
          sourceRect,
          [sourceCell.topRight, sourceCell.bottomRight, sourceCell.bottomLeft],
          inflateTriangle([topRight, bottomRight, bottomLeft], 0.42),
        );
      }
    }
  }
}

function drawTexturedTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sourceRect: Rect,
  sourceTriangle: [Point, Point, Point],
  destinationTriangle: [Point, Point, Point],
) {
  const transform = solveAffineTransform(sourceTriangle, destinationTriangle);
  if (!transform) {
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(destinationTriangle[0].x, destinationTriangle[0].y);
  context.lineTo(destinationTriangle[1].x, destinationTriangle[1].y);
  context.lineTo(destinationTriangle[2].x, destinationTriangle[2].y);
  context.closePath();
  context.clip();

  context.transform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  );
  context.drawImage(image, 0, 0, sourceRect.width, sourceRect.height);
  context.restore();
}

function buildSourceCells(rect: Rect, meshConfig: MeshConfig): SourceCell[] {
  const cells: SourceCell[] = [];
  const { cols, rows } = meshConfig;

  for (let row = 0; row < rows; row += 1) {
    const y0 = rect.height * (row / rows);
    const y1 = rect.height * ((row + 1) / rows);

    for (let col = 0; col < cols; col += 1) {
      const x0 = rect.width * (col / cols);
      const x1 = rect.width * ((col + 1) / cols);

      cells.push({
        topLeft: { x: x0, y: y0 },
        topRight: { x: x1, y: y0 },
        bottomRight: { x: x1, y: y1 },
        bottomLeft: { x: x0, y: y1 },
      });
    }
  }

  return cells;
}

function buildMesh(
  sourceRect: Rect,
  targetRect: Rect,
  collapse: number,
  meshConfig: MeshConfig,
): Point[] {
  const mesh: Point[] = [];
  const { cols, rows } = meshConfig;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;

    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols;
      mesh.push(getWarpedPoint(sourceRect, targetRect, u, v, collapse));
    }
  }

  return mesh;
}

function getWarpedPoint(
  sourceRect: Rect,
  targetRect: Rect,
  u: number,
  v: number,
  collapse: number,
): Point {
  const sourceX = sourceRect.x + sourceRect.width * u;
  const sourceY = sourceRect.y + sourceRect.height * v;

  if (collapse <= 0.0001) {
    return { x: sourceX, y: sourceY };
  }

  const targetRow = getTargetRow(targetRect, v);
  const finalX = targetRow.left + targetRow.width * u;
  const finalY = targetRow.top;

  const horizontalLag = Math.pow(1 - u, 1.9) * 0.62;
  const verticalLag = Math.pow(1 - v, 1.5) * 0.22;
  const cornerLag =
    Math.pow(1 - u, 1.15) * Math.pow(Math.abs(v - 0.5) * 2, 1.18) * 0.085;
  const lag = Math.min(0.87, horizontalLag + verticalLag + cornerLag);

  const pullX = smoothstep(lag * 0.42, 1, collapse);
  const pullY = smoothstep(lag * 0.82, 1, collapse);

  let x = mix(sourceX, finalX, pullX);
  let y = mix(sourceY, finalY, pullY);

  const targetCenterX = targetRect.x + targetRect.width / 2;
  const centerBand = Math.sin(v * Math.PI);
  const neckPull =
    smoothstep(0.16, 0.94, collapse) *
    Math.pow(1 - u, 0.72) *
    (0.095 + centerBand * 0.08);
  x += (targetCenterX - x) * neckPull;

  const verticalStretch =
    smoothstep(0.24, 1, collapse) *
    Math.pow(1 - u, 0.68) *
    Math.pow(1 - v, 1.18);
  y += (finalY - y) * verticalStretch * 0.24;

  return { x, y };
}

function getTargetRow(targetRect: Rect, v: number) {
  const profile = Math.pow(Math.sin(v * Math.PI), 0.92);
  const width = targetRect.width * (0.66 + profile * 0.26);
  const centerShift = (0.5 - v) * targetRect.width * 0.08;
  const centerX = targetRect.x + targetRect.width / 2 + centerShift;

  return {
    left: centerX - width / 2,
    width,
    top: targetRect.y + targetRect.height * v,
  };
}

function solveAffineTransform(
  source: [Point, Point, Point],
  destination: [Point, Point, Point],
) {
  const matrix = [
    [source[0].x, source[0].y, 1, 0, 0, 0],
    [0, 0, 0, source[0].x, source[0].y, 1],
    [source[1].x, source[1].y, 1, 0, 0, 0],
    [0, 0, 0, source[1].x, source[1].y, 1],
    [source[2].x, source[2].y, 1, 0, 0, 0],
    [0, 0, 0, source[2].x, source[2].y, 1],
  ];
  const vector = [
    destination[0].x,
    destination[0].y,
    destination[1].x,
    destination[1].y,
    destination[2].x,
    destination[2].y,
  ];

  const solution = solveLinearSystem(matrix, vector);
  if (!solution) {
    return null;
  }

  const [a, c, e, b, d, f] = solution;
  if ([a, b, c, d, e, f].some((value) => !Number.isFinite(value))) {
    return null;
  }

  return { a, b, c, d, e, f };
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index] ?? 0]);

  for (let pivotCol = 0; pivotCol < size; pivotCol += 1) {
    let pivotRow = pivotCol;

    for (let row = pivotCol + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row]?.[pivotCol] ?? 0) >
        Math.abs(augmented[pivotRow]?.[pivotCol] ?? 0)
      ) {
        pivotRow = row;
      }
    }

    const pivotValue = augmented[pivotRow]?.[pivotCol] ?? 0;
    if (Math.abs(pivotValue) < 1e-8) {
      return null;
    }

    if (pivotRow !== pivotCol) {
      [augmented[pivotCol], augmented[pivotRow]] = [
        augmented[pivotRow]!,
        augmented[pivotCol]!,
      ];
    }

    for (let col = pivotCol; col <= size; col += 1) {
      augmented[pivotCol]![col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivotCol) {
        continue;
      }

      const factor = augmented[row]?.[pivotCol] ?? 0;
      if (Math.abs(factor) < 1e-10) {
        continue;
      }

      for (let col = pivotCol; col <= size; col += 1) {
        augmented[row]![col] -= factor * (augmented[pivotCol]?.[col] ?? 0);
      }
    }
  }

  return augmented.map((row) => row[size] ?? 0);
}

function inflateTriangle(
  triangle: [Point, Point, Point],
  amount: number,
): [Point, Point, Point] {
  const center = {
    x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3,
    y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3,
  };

  return triangle.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;

    return {
      x: point.x + (dx / length) * amount,
      y: point.y + (dy / length) * amount,
    };
  }) as [Point, Point, Point];
}

function getMeshIndex(row: number, col: number, cols: number) {
  return row * (cols + 1) + col;
}

function getMeshConfig(rect: Rect): MeshConfig {
  return {
    cols: clampInt(
      Math.round(rect.width / TARGET_CELL_SIZE_X),
      MIN_GRID_COLS,
      MAX_GRID_COLS,
    ),
    rows: clampInt(
      Math.round(rect.height / TARGET_CELL_SIZE_Y),
      MIN_GRID_ROWS,
      MAX_GRID_ROWS,
    ),
  };
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
