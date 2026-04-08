"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Rect, WindowTransitionPhase } from "@/lib/use-window-state";

const SLICE_COUNT = 36;
const SLICE_OVERLAP = 3;
export const GENIE_DURATION_MS = 440;
export const GENIE_HANDOFF_REVEAL_MS = 64;
const EASE = "cubic-bezier(0.22, 0.86, 0.26, 1)";

interface GenieWindowOverlayProps {
  phase: Exclude<WindowTransitionPhase, "idle">;
  imageSrc: string;
  windowRect: Rect;
  targetRect: Rect;
  animationKey: number;
  onComplete: () => void;
}

interface SliceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function GenieWindowOverlay({
  phase,
  imageSrc,
  windowRect,
  targetRect,
  animationKey,
  onComplete,
}: GenieWindowOverlayProps) {
  const sliceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const towardIcon = phase === "minimizing-genie";

  const slices = useMemo(() => {
    const windowSliceHeight = windowRect.height / SLICE_COUNT;

    return Array.from({ length: SLICE_COUNT }, (_, index) => {
      const normalized = index / (SLICE_COUNT - 1);
      const windowSlice = getWindowSliceRect(windowRect, windowSliceHeight, index);
      const iconSlice = getIconSliceRect(targetRect, normalized, index);
      const cropTop = Math.max(
        0,
        index * windowSliceHeight - (index === 0 ? 0 : SLICE_OVERLAP / 2),
      );

      return {
        index,
        cropTop,
        windowSlice,
        motion: getMotion(windowSlice, iconSlice),
      };
    });
  }, [targetRect, windowRect]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      onComplete();
      return;
    }

    const animations = sliceRefs.current
      .map((node, index) => {
        if (!node) {
          return null;
        }

        const slice = slices[index];
        if (!slice) {
          return null;
        }

        const startKeyframe = towardIcon
          ? {
              transform: "translate3d(0px, 0px, 0px) scale(1, 1)",
              opacity: 1,
            }
          : {
              transform: slice.motion,
              opacity: 1,
            };
        const endKeyframe = towardIcon
          ? {
              transform: slice.motion,
              opacity: 1,
            }
          : {
              transform: "translate3d(0px, 0px, 0px) scale(1, 1)",
              opacity: 1,
            };

        return node.animate([startKeyframe, endKeyframe], {
          duration: GENIE_DURATION_MS,
          easing: EASE,
          fill: "both",
        });
      })
      .filter((animation): animation is Animation => animation !== null);

    const timer = window.setTimeout(onComplete, GENIE_DURATION_MS + 24);

    return () => {
      window.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [animationKey, onComplete, slices, towardIcon]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[35]">
      {slices.map((slice) => (
        <div
          key={`${animationKey}-${slice.index}`}
          ref={(node) => {
            sliceRefs.current[slice.index] = node;
          }}
          className="absolute overflow-hidden"
          style={{
            left: slice.windowSlice.left,
            top: slice.windowSlice.top,
            width: slice.windowSlice.width,
            height: slice.windowSlice.height,
            transformOrigin: "0 0",
            transform: towardIcon
              ? "translate3d(0px, 0px, 0px) scale(1, 1)"
              : slice.motion,
            opacity: 1,
            willChange: "transform, opacity",
          }}
        >
          <div
            style={{
              width: windowRect.width,
              height: windowRect.height,
              backgroundImage: `url(${imageSrc})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${windowRect.width}px ${windowRect.height}px`,
              transform: `translateY(-${slice.cropTop}px)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function getWindowSliceRect(
  rect: Rect,
  sliceHeight: number,
  index: number,
): SliceRect {
  const overlapBefore = index === 0 ? 0 : SLICE_OVERLAP / 2;
  const overlapAfter = index === SLICE_COUNT - 1 ? 0 : SLICE_OVERLAP / 2;

  return {
    left: rect.x,
    top: rect.y + sliceHeight * index - overlapBefore,
    width: rect.width,
    height: sliceHeight + overlapBefore + overlapAfter,
  };
}

function getIconSliceRect(rect: Rect, normalized: number, index: number): SliceRect {
  const sliceHeight = rect.height / SLICE_COUNT;
  const bulge = Math.sin(normalized * Math.PI);
  const width = rect.width * (0.84 + bulge * 0.14);
  const centerShift = (0.5 - normalized) * rect.width * 0.12;
  const overlapBefore = index === 0 ? 0 : 0.6;
  const overlapAfter = index === SLICE_COUNT - 1 ? 0 : 0.6;

  return {
    left: rect.x + rect.width / 2 - width / 2 + centerShift,
    top: rect.y + sliceHeight * index - overlapBefore,
    width,
    height: Math.max(1, sliceHeight + overlapBefore + overlapAfter),
  };
}

function getMotion(start: SliceRect, end: SliceRect) {
  const translateX = end.left - start.left;
  const translateY = end.top - start.top;
  const scaleX = end.width / start.width;
  const scaleY = end.height / start.height;

  return `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scaleX}, ${scaleY})`;
}
