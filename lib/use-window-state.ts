"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type SnapZone =
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  preMaximize: Rect | null;
  preSnap: Rect | null;
  isMaximized: boolean;
  isMinimized: boolean;
  isClosed: boolean;
  isAnimating: boolean;
  snapZone: SnapZone;
}

// Minimum padding from viewport edges — window can never touch the browser border
const VP_PAD = 16;
// Gap between tiled/snapped windows
const SNAP_GAP = 8;
const SNAP_EDGE_THRESHOLD = 5;
const SNAP_CORNER_SIZE = 60;

function getDefaultRect(): Rect {
  if (typeof window === "undefined") {
    return { x: VP_PAD, y: VP_PAD, width: 800, height: 600 };
  }
  // Fill viewport minus padding on all sides
  return {
    x: VP_PAD,
    y: VP_PAD,
    width: window.innerWidth - VP_PAD * 2,
    height: window.innerHeight - VP_PAD * 2,
  };
}

/**
 * Soft clamp: only ensure the title bar stays grabbable.
 * At least TITLE_GRAB px of the title bar must remain inside the viewport.
 * The window body can extend off-screen in any direction — matching macOS behavior.
 */
const TITLE_BAR_H = 38;
const TITLE_GRAB = 60; // min visible title bar width to grab

function clampRect(r: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    ...r,
    // Title bar left edge can't go further right than (viewport - TITLE_GRAB)
    // Title bar right edge can't go further left than TITLE_GRAB
    x: Math.max(TITLE_GRAB - r.width, Math.min(r.x, vw - TITLE_GRAB)),
    // Title bar top can't go above viewport, bottom of title bar can't go below viewport
    y: Math.max(0, Math.min(r.y, vh - TITLE_BAR_H)),
  };
}

export function getSnapRect(zone: SnapZone): Rect | null {
  if (!zone) return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const p = VP_PAD;
  const g = SNAP_GAP;
  const halfW = (w - p * 2 - g) / 2;
  const halfH = (h - p * 2 - g) / 2;

  switch (zone) {
    case "left":
      return { x: p, y: p, width: halfW, height: h - p * 2 };
    case "right":
      return { x: p + halfW + g, y: p, width: halfW, height: h - p * 2 };
    case "top":
      return { x: p, y: p, width: w - p * 2, height: h - p * 2 };
    case "top-left":
      return { x: p, y: p, width: halfW, height: halfH };
    case "top-right":
      return { x: p + halfW + g, y: p, width: halfW, height: halfH };
    case "bottom-left":
      return { x: p, y: p + halfH + g, width: halfW, height: halfH };
    case "bottom-right":
      return { x: p + halfW + g, y: p + halfH + g, width: halfW, height: halfH };
    default:
      return null;
  }
}

export function detectSnapZone(cursorX: number, cursorY: number): SnapZone {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const nearLeft = cursorX <= SNAP_EDGE_THRESHOLD;
  const nearRight = cursorX >= w - SNAP_EDGE_THRESHOLD;
  const nearTop = cursorY <= SNAP_EDGE_THRESHOLD;
  const nearBottom = cursorY >= h - SNAP_EDGE_THRESHOLD;

  // Corners first
  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";
  if (cursorX <= SNAP_CORNER_SIZE && cursorY <= SNAP_CORNER_SIZE) return "top-left";
  if (cursorX >= w - SNAP_CORNER_SIZE && cursorY <= SNAP_CORNER_SIZE) return "top-right";
  if (cursorX <= SNAP_CORNER_SIZE && cursorY >= h - SNAP_CORNER_SIZE) return "bottom-left";
  if (cursorX >= w - SNAP_CORNER_SIZE && cursorY >= h - SNAP_CORNER_SIZE) return "bottom-right";

  // Edges
  if (nearLeft) return "left";
  if (nearRight) return "right";
  if (nearTop) return "top";

  return null;
}

export function useWindowState() {
  const [state, setState] = useState<WindowState>({
    x: VP_PAD,
    y: VP_PAD,
    width: 800,
    height: 600,
    preMaximize: null,
    preSnap: null,
    isMaximized: false,
    isMinimized: false,
    isClosed: false,
    isAnimating: false,
    snapZone: null,
  });

  const [dragSnapZone, setDragSnapZone] = useState<SnapZone>(null);
  // showOpenAnim starts true — the CSS animation starts from opacity:0 + scale(0.95),
  // so the window is invisible initially and animates in. No blank frame.
  const [showOpenAnim, setShowOpenAnim] = useState(true);
  const [ready, setReady] = useState(true);
  const preSnapRef = useRef<Rect | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // On mount: compute correct viewport-based size and clear the open animation flag.
  useEffect(() => {
    const rect = getDefaultRect();
    setState((s) => ({ ...s, ...rect }));
    const timer = setTimeout(() => setShowOpenAnim(false), 450);
    return () => clearTimeout(timer);
  }, []);

  // Handle viewport resize — keep window in bounds
  useEffect(() => {
    const handleResize = () => {
      setState((s) => {
        if (s.isMaximized) {
          const rect = getSnapRect("top");
          return rect ? { ...s, ...rect } : s;
        }
        return { ...s, ...clampRect(s) };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear animation after a safe timeout (fallback if transitionEnd doesn't fire)
  const scheduleAnimClear = useCallback(() => {
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      setState((s) => (s.isAnimating ? { ...s, isAnimating: false } : s));
    }, 500);
  }, []);

  // Raw move — no clamping, used during active drag for responsiveness
  const moveToRaw = useCallback((x: number, y: number) => {
    setState((s) => ({ ...s, x, y, isMaximized: false, isAnimating: false }));
  }, []);

  // Raw resize — no clamping, used during active resize
  const resizeToRaw = useCallback(
    (width: number, height: number, x: number, y: number) => {
      setState((s) => ({ ...s, width, height, x, y, isMaximized: false, isAnimating: false }));
    },
    [],
  );

  // Clamped move — used for final position after drag
  const moveTo = useCallback((x: number, y: number) => {
    setState((s) => {
      const clamped = clampRect({ x, y, width: s.width, height: s.height });
      return { ...s, ...clamped, isMaximized: false, isAnimating: false };
    });
  }, []);

  const resizeTo = useCallback(
    (width: number, height: number, x: number, y: number) => {
      setState((s) => {
        const clamped = clampRect({ x, y, width, height });
        return { ...s, ...clamped, isMaximized: false, isAnimating: false };
      });
    },
    [],
  );

  const maximize = useCallback(() => {
    setState((s) => {
      if (s.isMaximized) {
        const prev = s.preMaximize || getDefaultRect();
        return { ...s, ...clampRect(prev), preMaximize: null, isMaximized: false, isAnimating: true };
      }
      const target = getSnapRect("top")!;
      return {
        ...s,
        preMaximize: { x: s.x, y: s.y, width: s.width, height: s.height },
        ...target,
        isMaximized: true,
        isAnimating: true,
      };
    });
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const minimize = useCallback(() => {
    setState((s) => ({ ...s, isMinimized: true, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const restore = useCallback(() => {
    setState((s) => ({ ...s, isMinimized: false, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, isClosed: true, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const reopen = useCallback(() => {
    setState({
      ...getDefaultRect(),
      preMaximize: null,
      preSnap: null,
      isMaximized: false,
      isMinimized: false,
      isClosed: false,
      isAnimating: true,
      snapZone: null,
    });
    setShowOpenAnim(true);
    setTimeout(() => setShowOpenAnim(false), 400);
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const snapTo = useCallback(
    (zone: SnapZone) => {
      if (!zone) return;
      const target = getSnapRect(zone);
      if (!target) return;
      setState((s) => ({
        ...s,
        preSnap: preSnapRef.current || { x: s.x, y: s.y, width: s.width, height: s.height },
        ...target,
        isMaximized: zone === "top",
        isAnimating: true,
        snapZone: zone,
      }));
      preSnapRef.current = null;
      scheduleAnimClear();
    },
    [scheduleAnimClear],
  );

  const startDrag = useCallback(() => {
    setState((s) => {
      if (s.snapZone || s.isMaximized) {
        preSnapRef.current = s.preSnap || s.preMaximize;
      } else {
        preSnapRef.current = { x: s.x, y: s.y, width: s.width, height: s.height };
      }
      return { ...s, isAnimating: false, snapZone: null, isMaximized: false };
    });
  }, []);

  const onDragMove = useCallback((cursorX: number, cursorY: number) => {
    setDragSnapZone(detectSnapZone(cursorX, cursorY));
  }, []);

  const endDrag = useCallback(() => {
    if (dragSnapZone) {
      snapTo(dragSnapZone);
    } else {
      // Clamp final position within bounds
      setState((s) => ({ ...s, ...clampRect(s) }));
    }
    setDragSnapZone(null);
  }, [dragSnapZone, snapTo]);

  const clearAnimation = useCallback(() => {
    if (animTimer.current) clearTimeout(animTimer.current);
    setState((s) => (s.isAnimating ? { ...s, isAnimating: false } : s));
  }, []);

  return {
    state,
    ready,
    dragSnapZone,
    showOpenAnim,
    moveToRaw,
    resizeToRaw,
    moveTo,
    resizeTo,
    maximize,
    minimize,
    restore,
    close,
    reopen,
    snapTo,
    startDrag,
    onDragMove,
    endDrag,
    clearAnimation,
  };
}
