"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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

interface Viewport {
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
  usesDefaultRect: boolean;
}

const VP_PAD = 16;
const SNAP_GAP = 8;
const SNAP_EDGE_THRESHOLD = 5;
const SNAP_CORNER_SIZE = 60;
const TITLE_BAR_H = 38;
const TITLE_GRAB = 60;
const DEFAULT_VIEWPORT: Viewport = {
  width: 800 + VP_PAD * 2,
  height: 600 + VP_PAD * 2,
};
let viewportSnapshot: Viewport = DEFAULT_VIEWPORT;

const DEFAULT_RECT: Rect = {
  x: VP_PAD,
  y: VP_PAD,
  width: 800,
  height: 600,
};

function subscribeToViewport(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getViewportSnapshot(): Viewport {
  if (typeof window === "undefined") {
    return DEFAULT_VIEWPORT;
  }

  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;

  if (
    viewportSnapshot.width !== nextWidth ||
    viewportSnapshot.height !== nextHeight
  ) {
    viewportSnapshot = {
      width: nextWidth,
      height: nextHeight,
    };
  }

  return viewportSnapshot;
}

function getDefaultRect(viewport: Viewport = DEFAULT_VIEWPORT): Rect {
  return {
    x: VP_PAD,
    y: VP_PAD,
    width: viewport.width - VP_PAD * 2,
    height: viewport.height - VP_PAD * 2,
  };
}

function clampRect(rect: Rect, viewport: Viewport): Rect {
  return {
    ...rect,
    x: Math.max(TITLE_GRAB - rect.width, Math.min(rect.x, viewport.width - TITLE_GRAB)),
    y: Math.max(0, Math.min(rect.y, viewport.height - TITLE_BAR_H)),
  };
}

export function getSnapRect(
  zone: SnapZone,
  viewport: Viewport = getViewportSnapshot(),
): Rect | null {
  if (!zone) {
    return null;
  }

  const halfWidth = (viewport.width - VP_PAD * 2 - SNAP_GAP) / 2;
  const halfHeight = (viewport.height - VP_PAD * 2 - SNAP_GAP) / 2;

  switch (zone) {
    case "left":
      return {
        x: VP_PAD,
        y: VP_PAD,
        width: halfWidth,
        height: viewport.height - VP_PAD * 2,
      };
    case "right":
      return {
        x: VP_PAD + halfWidth + SNAP_GAP,
        y: VP_PAD,
        width: halfWidth,
        height: viewport.height - VP_PAD * 2,
      };
    case "top":
      return getDefaultRect(viewport);
    case "top-left":
      return {
        x: VP_PAD,
        y: VP_PAD,
        width: halfWidth,
        height: halfHeight,
      };
    case "top-right":
      return {
        x: VP_PAD + halfWidth + SNAP_GAP,
        y: VP_PAD,
        width: halfWidth,
        height: halfHeight,
      };
    case "bottom-left":
      return {
        x: VP_PAD,
        y: VP_PAD + halfHeight + SNAP_GAP,
        width: halfWidth,
        height: halfHeight,
      };
    case "bottom-right":
      return {
        x: VP_PAD + halfWidth + SNAP_GAP,
        y: VP_PAD + halfHeight + SNAP_GAP,
        width: halfWidth,
        height: halfHeight,
      };
    default:
      return null;
  }
}

export function detectSnapZone(
  cursorX: number,
  cursorY: number,
  viewport: Viewport = getViewportSnapshot(),
): SnapZone {
  const nearLeft = cursorX <= SNAP_EDGE_THRESHOLD;
  const nearRight = cursorX >= viewport.width - SNAP_EDGE_THRESHOLD;
  const nearTop = cursorY <= SNAP_EDGE_THRESHOLD;
  const nearBottom = cursorY >= viewport.height - SNAP_EDGE_THRESHOLD;

  if (nearTop && nearLeft) {
    return "top-left";
  }
  if (nearTop && nearRight) {
    return "top-right";
  }
  if (nearBottom && nearLeft) {
    return "bottom-left";
  }
  if (nearBottom && nearRight) {
    return "bottom-right";
  }
  if (cursorX <= SNAP_CORNER_SIZE && cursorY <= SNAP_CORNER_SIZE) {
    return "top-left";
  }
  if (cursorX >= viewport.width - SNAP_CORNER_SIZE && cursorY <= SNAP_CORNER_SIZE) {
    return "top-right";
  }
  if (cursorX <= SNAP_CORNER_SIZE && cursorY >= viewport.height - SNAP_CORNER_SIZE) {
    return "bottom-left";
  }
  if (cursorX >= viewport.width - SNAP_CORNER_SIZE && cursorY >= viewport.height - SNAP_CORNER_SIZE) {
    return "bottom-right";
  }
  if (nearLeft) {
    return "left";
  }
  if (nearRight) {
    return "right";
  }
  if (nearTop) {
    return "top";
  }

  return null;
}

function resolveRect(state: WindowState, viewport: Viewport): Rect {
  if (state.isMaximized) {
    return getSnapRect("top", viewport) ?? getDefaultRect(viewport);
  }

  if (state.snapZone) {
    return getSnapRect(state.snapZone, viewport) ?? getDefaultRect(viewport);
  }

  if (state.usesDefaultRect) {
    return getDefaultRect(viewport);
  }

  return clampRect(
    {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    },
    viewport,
  );
}

export function useWindowState() {
  const viewport = useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    () => DEFAULT_VIEWPORT,
  );

  const [state, setState] = useState<WindowState>({
    ...DEFAULT_RECT,
    preMaximize: null,
    preSnap: null,
    isMaximized: false,
    isMinimized: false,
    isClosed: false,
    isAnimating: false,
    snapZone: null,
    usesDefaultRect: true,
  });
  const [dragSnapZone, setDragSnapZone] = useState<SnapZone>(null);
  const [showOpenAnim, setShowOpenAnim] = useState(true);
  const preSnapRef = useRef<Rect | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedRect = resolveRect(state, viewport);

  useEffect(() => {
    openAnimTimer.current = setTimeout(() => {
      setShowOpenAnim(false);
      openAnimTimer.current = null;
    }, 450);

    return () => {
      if (openAnimTimer.current) {
        clearTimeout(openAnimTimer.current);
      }
      if (animTimer.current) {
        clearTimeout(animTimer.current);
      }
    };
  }, []);

  const scheduleAnimClear = useCallback(() => {
    if (animTimer.current) {
      clearTimeout(animTimer.current);
    }

    animTimer.current = setTimeout(() => {
      setState((current) =>
        current.isAnimating ? { ...current, isAnimating: false } : current,
      );
      animTimer.current = null;
    }, 500);
  }, []);

  const scheduleOpenAnimClear = useCallback(() => {
    if (openAnimTimer.current) {
      clearTimeout(openAnimTimer.current);
    }

    openAnimTimer.current = setTimeout(() => {
      setShowOpenAnim(false);
      openAnimTimer.current = null;
    }, 400);
  }, []);

  const moveToRaw = useCallback((x: number, y: number) => {
    setState((current) => ({
      ...current,
      x,
      y,
      isAnimating: false,
      isMaximized: false,
      snapZone: null,
      usesDefaultRect: false,
    }));
  }, []);

  const resizeToRaw = useCallback(
    (width: number, height: number, x: number, y: number) => {
      setState((current) => ({
        ...current,
        width,
        height,
        x,
        y,
        isAnimating: false,
        isMaximized: false,
        snapZone: null,
        usesDefaultRect: false,
      }));
    },
    [],
  );

  const moveTo = useCallback(
    (x: number, y: number) => {
      setState((current) => {
        const nextRect = clampRect(
          { ...resolveRect(current, viewport), x, y },
          viewport,
        );
        return {
          ...current,
          ...nextRect,
          isAnimating: false,
          isMaximized: false,
          snapZone: null,
          usesDefaultRect: false,
        };
      });
    },
    [viewport],
  );

  const resizeTo = useCallback(
    (width: number, height: number, x: number, y: number) => {
      setState((current) => {
        const nextRect = clampRect({ width, height, x, y }, viewport);
        return {
          ...current,
          ...nextRect,
          isAnimating: false,
          isMaximized: false,
          snapZone: null,
          usesDefaultRect: false,
        };
      });
    },
    [viewport],
  );

  const maximize = useCallback(() => {
    setState((current) => {
      if (current.isMaximized) {
        const previousRect = current.preMaximize ?? getDefaultRect(viewport);
        return {
          ...current,
          ...clampRect(previousRect, viewport),
          preMaximize: null,
          isMaximized: false,
          snapZone: null,
          isAnimating: true,
          usesDefaultRect: false,
        };
      }

      return {
        ...current,
        preMaximize: resolveRect(current, viewport),
        isMaximized: true,
        snapZone: "top",
        isAnimating: true,
        usesDefaultRect: false,
      };
    });
    scheduleAnimClear();
  }, [scheduleAnimClear, viewport]);

  const minimize = useCallback(() => {
    setState((current) => ({ ...current, isMinimized: true, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const restore = useCallback(() => {
    setState((current) => ({ ...current, isMinimized: false, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const close = useCallback(() => {
    setState((current) => ({ ...current, isClosed: true, isAnimating: true }));
    scheduleAnimClear();
  }, [scheduleAnimClear]);

  const reopen = useCallback(() => {
    setState({
      ...DEFAULT_RECT,
      preMaximize: null,
      preSnap: null,
      isMaximized: false,
      isMinimized: false,
      isClosed: false,
      isAnimating: true,
      snapZone: null,
      usesDefaultRect: true,
    });
    setShowOpenAnim(true);
    scheduleOpenAnimClear();
    scheduleAnimClear();
  }, [scheduleAnimClear, scheduleOpenAnimClear]);

  const snapTo = useCallback(
    (zone: SnapZone) => {
      if (!zone) {
        return;
      }

      if (!getSnapRect(zone, viewport)) {
        return;
      }

      setState((current) => ({
        ...current,
        preSnap: preSnapRef.current ?? resolveRect(current, viewport),
        isMaximized: zone === "top",
        isAnimating: true,
        snapZone: zone,
        usesDefaultRect: false,
      }));
      preSnapRef.current = null;
      scheduleAnimClear();
    },
    [scheduleAnimClear, viewport],
  );

  const startDrag = useCallback(() => {
    setState((current) => {
      const currentRect = resolveRect(current, viewport);
      preSnapRef.current =
        current.snapZone || current.isMaximized
          ? current.preSnap ?? current.preMaximize ?? currentRect
          : currentRect;

      return {
        ...current,
        ...currentRect,
        isAnimating: false,
        isMaximized: false,
        snapZone: null,
        usesDefaultRect: false,
      };
    });
  }, [viewport]);

  const onDragMove = useCallback(
    (cursorX: number, cursorY: number) => {
      setDragSnapZone(detectSnapZone(cursorX, cursorY, viewport));
    },
    [viewport],
  );

  const endDrag = useCallback(() => {
    if (dragSnapZone) {
      snapTo(dragSnapZone);
      setDragSnapZone(null);
      return;
    }

    setState((current) => {
      const nextRect = clampRect(resolveRect(current, viewport), viewport);
      return {
        ...current,
        ...nextRect,
        usesDefaultRect: false,
      };
    });
    setDragSnapZone(null);
  }, [dragSnapZone, snapTo, viewport]);

  const clearAnimation = useCallback(() => {
    if (animTimer.current) {
      clearTimeout(animTimer.current);
      animTimer.current = null;
    }

    setState((current) =>
      current.isAnimating ? { ...current, isAnimating: false } : current,
    );
  }, []);

  return {
    state: {
      ...state,
      ...resolvedRect,
    },
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
