"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import type { AppDefinition, AppId } from "@/lib/app-registry";

export type SnapZone =
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowFrameStyle {
  x: number;
  y: number;
  width: number | string;
  height: number | string;
}

export type WindowTransitionPhase =
  | "idle"
  | "opening-genie"
  | "minimizing-genie"
  | "restoring-genie";

export type LauncherAppStatus = "open" | "minimized" | "closed";

export interface Viewport {
  width: number;
  height: number;
}

export interface DesktopWindow {
  id: string;
  appId: AppId;
  title: string;
  placement: "viewport" | "centered";
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  preMaximize: Rect | null;
  preSnap: Rect | null;
  isMaximized: boolean;
  isMinimized: boolean;
  isClosed: boolean;
  isAnimating: boolean;
  isFocused: boolean;
  snapZone: SnapZone;
  usesDefaultRect: boolean;
  transitionPhase: WindowTransitionPhase;
  transitionKey: number;
  zIndex: number;
}

interface DesktopState {
  windows: DesktopWindow[];
  focusedWindowId: string | null;
  dragPreview:
    | {
        windowId: string;
        zone: SnapZone;
      }
    | null;
  nextZIndex: number;
}

type DesktopAction =
  | {
      type: "focus-window";
      windowId: string;
    }
  | {
      type: "set-drag-preview";
      windowId: string;
      zone: SnapZone;
    }
  | {
      type: "move-window-raw";
      windowId: string;
      x: number;
      y: number;
    }
  | {
      type: "resize-window-raw";
      windowId: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }
  | {
      type: "start-drag";
      windowId: string;
      viewport: Viewport;
    }
  | {
      type: "end-drag";
      windowId: string;
      viewport: Viewport;
    }
  | {
      type: "snap-window";
      windowId: string;
      zone: SnapZone;
      viewport: Viewport;
    }
  | {
      type: "toggle-maximize";
      windowId: string;
      viewport: Viewport;
    }
  | {
      type: "minimize-window";
      windowId: string;
    }
  | {
      type: "minimize-window-immediately";
      windowId: string;
    }
  | {
      type: "restore-window";
      windowId: string;
    }
  | {
      type: "restore-window-immediately";
      windowId: string;
    }
  | {
      type: "close-window";
      windowId: string;
    }
  | {
      type: "launch-app";
      appId: AppId;
      viewport: Viewport;
    }
  | {
      type: "finish-transition";
      windowId: string;
    }
  | {
      type: "set-window-animating";
      windowId: string;
      isAnimating: boolean;
    };

const VP_PAD = 16;
const SNAP_GAP = 8;
const SNAP_EDGE_THRESHOLD = 5;
const SNAP_CORNER_SIZE = 60;
const TITLE_BAR_H = 32;
const TITLE_GRAB = 60;
const DEFAULT_VIEWPORT: Viewport = {
  width: 800 + VP_PAD * 2,
  height: 600 + VP_PAD * 2,
};
const DEFAULT_FRAME_STYLE: WindowFrameStyle = {
  x: VP_PAD,
  y: VP_PAD,
  width: `calc(100vw - ${VP_PAD * 2}px)`,
  height: `calc(100vh - ${VP_PAD * 2}px)`,
};
const WINDOW_ANIMATION_CLEAR_MS = 500;

let viewportSnapshot: Viewport = DEFAULT_VIEWPORT;

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

export function getViewportFillRect(viewport: Viewport = DEFAULT_VIEWPORT): Rect {
  return {
    x: VP_PAD,
    y: VP_PAD,
    width: viewport.width - VP_PAD * 2,
    height: viewport.height - VP_PAD * 2,
  };
}

export function getCenteredRect(
  width: number,
  height: number,
  viewport: Viewport = DEFAULT_VIEWPORT,
): Rect {
  return clampRect(
    {
      width,
      height,
      x: Math.round((viewport.width - width) / 2),
      y: Math.round((viewport.height - height) / 2),
    },
    viewport,
  );
}

export function clampRect(rect: Rect, viewport: Viewport): Rect {
  return {
    ...rect,
    x: Math.max(
      TITLE_GRAB - rect.width,
      Math.min(rect.x, viewport.width - TITLE_GRAB),
    ),
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
      return getViewportFillRect(viewport);
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
  if (
    cursorX >= viewport.width - SNAP_CORNER_SIZE &&
    cursorY <= SNAP_CORNER_SIZE
  ) {
    return "top-right";
  }
  if (
    cursorX <= SNAP_CORNER_SIZE &&
    cursorY >= viewport.height - SNAP_CORNER_SIZE
  ) {
    return "bottom-left";
  }
  if (
    cursorX >= viewport.width - SNAP_CORNER_SIZE &&
    cursorY >= viewport.height - SNAP_CORNER_SIZE
  ) {
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

export function resolveWindowRect(
  window: DesktopWindow,
  viewport: Viewport = getViewportSnapshot(),
): Rect {
  if (window.isMaximized) {
    return getSnapRect("top", viewport) ?? getViewportFillRect(viewport);
  }

  if (window.snapZone) {
    return getSnapRect(window.snapZone, viewport) ?? getViewportFillRect(viewport);
  }

  if (window.usesDefaultRect) {
    return getViewportFillRect(viewport);
  }

  return clampRect(
    {
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
    },
    viewport,
  );
}

export function getWindowFrameStyle(
  window: DesktopWindow,
  viewport: Viewport,
): WindowFrameStyle {
  if (
    window.usesDefaultRect &&
    viewport.width === DEFAULT_VIEWPORT.width &&
    viewport.height === DEFAULT_VIEWPORT.height
  ) {
    return DEFAULT_FRAME_STYLE;
  }

  return resolveWindowRect(window, viewport);
}

function createWindowRecord(
  app: AppDefinition,
  viewport: Viewport,
  zIndex: number,
): DesktopWindow {
  const placement = app.defaultWindow.placement ?? "centered";
  const initialRect =
    placement === "viewport"
      ? getViewportFillRect(viewport)
      : getCenteredRect(app.defaultWindow.width, app.defaultWindow.height, viewport);

  return {
    id: app.id,
    appId: app.id,
    title: app.windowTitle,
    placement,
    x: initialRect.x,
    y: initialRect.y,
    width: app.defaultWindow.width,
    height: app.defaultWindow.height,
    minWidth: app.defaultWindow.minWidth ?? 450,
    minHeight: app.defaultWindow.minHeight ?? 300,
    preMaximize: null,
    preSnap: null,
    isMaximized: false,
    isMinimized: false,
    isClosed: app.startup !== "open",
    isAnimating: false,
    isFocused: app.startup === "open",
    snapZone: null,
    usesDefaultRect: placement === "viewport",
    transitionPhase: "idle",
    transitionKey: 0,
    zIndex,
  };
}

function createInitialState(apps: readonly AppDefinition[]): DesktopState {
  const viewport = DEFAULT_VIEWPORT;
  let zIndex = 20;

  const windows = apps.map((app) => {
    const nextWindow = createWindowRecord(app, viewport, zIndex);
    zIndex += 1;
    return nextWindow;
  });

  const focusedWindow = [...windows]
    .filter((window) => !window.isClosed && !window.isMinimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0];

  return {
    windows,
    focusedWindowId: focusedWindow?.id ?? null,
    dragPreview: null,
    nextZIndex: zIndex,
  };
}

function mapWindows(
  windows: DesktopWindow[],
  updater: (window: DesktopWindow) => DesktopWindow,
): DesktopWindow[] {
  let changed = false;
  const nextWindows = windows.map((window) => {
    const nextWindow = updater(window);
    if (nextWindow !== window) {
      changed = true;
    }
    return nextWindow;
  });

  return changed ? nextWindows : windows;
}

function getWindowById(state: DesktopState, windowId: string) {
  return state.windows.find((window) => window.id === windowId) ?? null;
}

function getNextVisibleWindowId(state: DesktopState, excludeWindowId: string) {
  return state.windows
    .filter(
      (window) =>
        window.id !== excludeWindowId && !window.isClosed && !window.isMinimized,
    )
    .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
}

function focusWindowState(state: DesktopState, windowId: string): DesktopState {
  const target = getWindowById(state, windowId);
  if (
    !target ||
    target.isClosed ||
    (target.isMinimized && target.transitionPhase !== "restoring-genie")
  ) {
    return state;
  }

  if (state.focusedWindowId === windowId && target.isFocused) {
    return state;
  }

  const nextZIndex = state.nextZIndex + 1;
  const nextWindows = mapWindows(state.windows, (window) => {
    if (window.id === windowId) {
      return {
        ...window,
        isFocused: true,
        zIndex: nextZIndex,
      };
    }

    if (window.isFocused) {
      return {
        ...window,
        isFocused: false,
      };
    }

    return window;
  });

  return {
    ...state,
    windows: nextWindows,
    focusedWindowId: windowId,
    nextZIndex,
  };
}

function desktopReducer(state: DesktopState, action: DesktopAction): DesktopState {
  switch (action.type) {
    case "focus-window":
      return focusWindowState(state, action.windowId);
    case "set-drag-preview":
      return {
        ...state,
        dragPreview: {
          windowId: action.windowId,
          zone: action.zone,
        },
      };
    case "move-window-raw":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          return {
            ...window,
            x: action.x,
            y: action.y,
            isAnimating: false,
            isMaximized: false,
            snapZone: null,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    case "resize-window-raw":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          return {
            ...window,
            width: action.width,
            height: action.height,
            x: action.x,
            y: action.y,
            isAnimating: false,
            isMaximized: false,
            snapZone: null,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    case "start-drag":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          const currentRect = resolveWindowRect(window, action.viewport);

          return {
            ...window,
            ...currentRect,
            preSnap:
              window.snapZone || window.isMaximized
                ? window.preSnap ?? window.preMaximize ?? currentRect
                : window.preSnap,
            isAnimating: false,
            isMaximized: false,
            snapZone: null,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    case "end-drag": {
      if (
        state.dragPreview &&
        state.dragPreview.windowId === action.windowId &&
        state.dragPreview.zone
      ) {
        return desktopReducer(
          {
            ...state,
            dragPreview: null,
          },
          {
            type: "snap-window",
            windowId: action.windowId,
            zone: state.dragPreview.zone,
            viewport: action.viewport,
          },
        );
      }

      return {
        ...state,
        dragPreview:
          state.dragPreview?.windowId === action.windowId ? null : state.dragPreview,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          const nextRect = clampRect(
            resolveWindowRect(window, action.viewport),
            action.viewport,
          );

          return {
            ...window,
            ...nextRect,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    }
    case "snap-window":
      if (!action.zone || !getSnapRect(action.zone, action.viewport)) {
        return state;
      }

      return {
        ...state,
        dragPreview:
          state.dragPreview?.windowId === action.windowId ? null : state.dragPreview,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          return {
            ...window,
            preSnap: window.preSnap ?? resolveWindowRect(window, action.viewport),
            isMaximized: action.zone === "top",
            isAnimating: true,
            snapZone: action.zone,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    case "toggle-maximize":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          if (window.isMaximized) {
            const previousRect =
              window.preMaximize ?? getViewportFillRect(action.viewport);
            return {
              ...window,
              ...clampRect(previousRect, action.viewport),
              preMaximize: null,
              isMaximized: false,
              snapZone: null,
              isAnimating: true,
              usesDefaultRect: false,
              transitionPhase: "idle",
            };
          }

          return {
            ...window,
            preMaximize: resolveWindowRect(window, action.viewport),
            isMaximized: true,
            snapZone: "top",
            isAnimating: true,
            usesDefaultRect: false,
            transitionPhase: "idle",
          };
        }),
      };
    case "minimize-window": {
      const nextFocusedId = getNextVisibleWindowId(state, action.windowId);
      const nextZIndex = nextFocusedId ? state.nextZIndex + 1 : state.nextZIndex;

      return {
        ...state,
        focusedWindowId: nextFocusedId,
        nextZIndex,
        windows: mapWindows(state.windows, (window) => {
          if (window.id === action.windowId) {
            if (
              window.transitionPhase !== "idle" ||
              window.isMinimized ||
              window.isClosed
            ) {
              return window;
            }

            return {
              ...window,
              isFocused: false,
              isAnimating: false,
              transitionPhase: "minimizing-genie",
              transitionKey: window.transitionKey + 1,
            };
          }

          if (window.id === nextFocusedId) {
            return {
              ...window,
              isFocused: true,
              zIndex: nextZIndex,
            };
          }

          if (window.isFocused) {
            return {
              ...window,
              isFocused: false,
            };
          }

          return window;
        }),
      };
    }
    case "minimize-window-immediately": {
      const nextFocusedId = getNextVisibleWindowId(state, action.windowId);
      const nextZIndex = nextFocusedId ? state.nextZIndex + 1 : state.nextZIndex;

      return {
        ...state,
        focusedWindowId: nextFocusedId,
        nextZIndex,
        windows: mapWindows(state.windows, (window) => {
          if (window.id === action.windowId) {
            if (
              window.transitionPhase !== "idle" ||
              window.isMinimized ||
              window.isClosed
            ) {
              return window;
            }

            return {
              ...window,
              isFocused: false,
              isMinimized: true,
              isAnimating: false,
              transitionPhase: "idle",
            };
          }

          if (window.id === nextFocusedId) {
            return {
              ...window,
              isFocused: true,
              zIndex: nextZIndex,
            };
          }

          if (window.isFocused) {
            return {
              ...window,
              isFocused: false,
            };
          }

          return window;
        }),
      };
    }
    case "restore-window":
      return focusWindowState(
        {
          ...state,
          windows: mapWindows(state.windows, (window) => {
            if (window.id !== action.windowId) {
              return window;
            }

            if (window.transitionPhase !== "idle" || !window.isMinimized) {
              return window;
            }

            return {
              ...window,
              isAnimating: false,
              transitionPhase: "restoring-genie",
              transitionKey: window.transitionKey + 1,
            };
          }),
        },
        action.windowId,
      );
    case "restore-window-immediately":
      return focusWindowState(
        {
          ...state,
          windows: mapWindows(state.windows, (window) => {
            if (window.id !== action.windowId) {
              return window;
            }

            if (window.transitionPhase !== "idle" || !window.isMinimized) {
              return window;
            }

            return {
              ...window,
              isMinimized: false,
              isAnimating: false,
              transitionPhase: "idle",
            };
          }),
        },
        action.windowId,
      );
    case "close-window": {
      const nextFocusedId = getNextVisibleWindowId(state, action.windowId);
      const nextZIndex = nextFocusedId ? state.nextZIndex + 1 : state.nextZIndex;

      return {
        ...state,
        focusedWindowId: nextFocusedId,
        nextZIndex,
        windows: mapWindows(state.windows, (window) => {
          if (window.id === action.windowId) {
            return {
              ...window,
              isClosed: true,
              isFocused: false,
              isAnimating: true,
              isMinimized: false,
              transitionPhase: "idle",
            };
          }

          if (window.id === nextFocusedId) {
            return {
              ...window,
              isFocused: true,
              zIndex: nextZIndex,
            };
          }

          if (window.isFocused) {
            return {
              ...window,
              isFocused: false,
            };
          }

          return window;
        }),
      };
    }
    case "launch-app": {
      const target = state.windows.find((window) => window.appId === action.appId);
      if (!target) {
        return state;
      }

      if (!target.isClosed && !target.isMinimized) {
        return focusWindowState(state, target.id);
      }

      if (target.isMinimized) {
        return desktopReducer(state, {
          type: "restore-window",
          windowId: target.id,
        });
      }

      return focusWindowState(
        {
          ...state,
          windows: mapWindows(state.windows, (window) => {
            if (window.id !== target.id) {
              return window;
            }

            const centeredRect =
              window.placement === "centered" && window.transitionKey === 0
                ? getCenteredRect(window.width, window.height, action.viewport)
                : null;

            return {
              ...window,
              ...(centeredRect ?? {}),
              isClosed: false,
              isMinimized: false,
              isAnimating: false,
              transitionPhase: "opening-genie",
              transitionKey: window.transitionKey + 1,
            };
          }),
        },
        target.id,
      );
    }
    case "finish-transition":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId) {
            return window;
          }

          switch (window.transitionPhase) {
            case "opening-genie":
            case "restoring-genie":
              return {
                ...window,
                isClosed: false,
                isMinimized: false,
                isAnimating: false,
                transitionPhase: "idle",
              };
            case "minimizing-genie":
              return {
                ...window,
                isMinimized: true,
                isAnimating: false,
                transitionPhase: "idle",
              };
            default:
              return window;
          }
        }),
      };
    case "set-window-animating":
      return {
        ...state,
        windows: mapWindows(state.windows, (window) => {
          if (window.id !== action.windowId || window.isAnimating === action.isAnimating) {
            return window;
          }

          return {
            ...window,
            isAnimating: action.isAnimating,
          };
        }),
      };
    default:
      return state;
  }
}

export function useDesktopManager(apps: readonly AppDefinition[]) {
  const viewport = useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    () => DEFAULT_VIEWPORT,
  );
  const [state, dispatch] = useReducer(desktopReducer, apps, createInitialState);
  const animationTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = animationTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const scheduleAnimationClear = useCallback((windowId: string) => {
    const currentTimer = animationTimersRef.current.get(windowId);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const timer = setTimeout(() => {
      dispatch({
        type: "set-window-animating",
        windowId,
        isAnimating: false,
      });
      animationTimersRef.current.delete(windowId);
    }, WINDOW_ANIMATION_CLEAR_MS);

    animationTimersRef.current.set(windowId, timer);
  }, []);

  const clearAnimation = useCallback((windowId: string) => {
    const currentTimer = animationTimersRef.current.get(windowId);
    if (currentTimer) {
      clearTimeout(currentTimer);
      animationTimersRef.current.delete(windowId);
    }

    dispatch({
      type: "set-window-animating",
      windowId,
      isAnimating: false,
    });
  }, []);

  const focusWindow = useCallback((windowId: string) => {
    dispatch({ type: "focus-window", windowId });
  }, []);

  const launchApp = useCallback((appId: AppId) => {
    dispatch({ type: "launch-app", appId, viewport });
  }, [viewport]);

  const moveWindowToRaw = useCallback((windowId: string, x: number, y: number) => {
    dispatch({ type: "move-window-raw", windowId, x, y });
  }, []);

  const resizeWindowToRaw = useCallback(
    (windowId: string, width: number, height: number, x: number, y: number) => {
      dispatch({ type: "resize-window-raw", windowId, width, height, x, y });
    },
    [],
  );

  const startDrag = useCallback((windowId: string) => {
    dispatch({ type: "start-drag", windowId, viewport });
  }, [viewport]);

  const updateDragPreview = useCallback(
    (windowId: string, cursorX: number, cursorY: number) => {
      dispatch({
        type: "set-drag-preview",
        windowId,
        zone: detectSnapZone(cursorX, cursorY, viewport),
      });
    },
    [viewport],
  );

  const endDrag = useCallback((windowId: string) => {
    dispatch({ type: "end-drag", windowId, viewport });
  }, [viewport]);

  const maximizeWindow = useCallback(
    (windowId: string) => {
      dispatch({ type: "toggle-maximize", windowId, viewport });
      scheduleAnimationClear(windowId);
    },
    [scheduleAnimationClear, viewport],
  );

  const minimizeWindow = useCallback((windowId: string) => {
    dispatch({ type: "minimize-window", windowId });
  }, []);

  const minimizeWindowImmediately = useCallback((windowId: string) => {
    dispatch({ type: "minimize-window-immediately", windowId });
  }, []);

  const restoreWindow = useCallback((windowId: string) => {
    dispatch({ type: "restore-window", windowId });
  }, []);

  const restoreWindowImmediately = useCallback((windowId: string) => {
    dispatch({ type: "restore-window-immediately", windowId });
  }, []);

  const closeWindow = useCallback(
    (windowId: string) => {
      dispatch({ type: "close-window", windowId });
      scheduleAnimationClear(windowId);
    },
    [scheduleAnimationClear],
  );

  const finishWindowTransition = useCallback((windowId: string) => {
    dispatch({ type: "finish-transition", windowId });
  }, []);

  const launcherStatuses = useMemo(() => {
    return state.windows.reduce<Record<string, LauncherAppStatus>>((acc, window) => {
      acc[window.appId] = window.isClosed
        ? "closed"
        : window.isMinimized
          ? "minimized"
          : "open";
      return acc;
    }, {});
  }, [state.windows]);

  const orderedWindows = useMemo(() => {
    return [...state.windows].sort((a, b) => a.zIndex - b.zIndex);
  }, [state.windows]);

  return {
    viewport,
    windows: orderedWindows,
    dragSnapZone: state.dragPreview?.zone ?? null,
    launcherStatuses,
    focusWindow,
    launchApp,
    moveWindowToRaw,
    resizeWindowToRaw,
    startDrag,
    updateDragPreview,
    endDrag,
    maximizeWindow,
    minimizeWindow,
    minimizeWindowImmediately,
    restoreWindow,
    restoreWindowImmediately,
    closeWindow,
    clearAnimation,
    finishWindowTransition,
  };
}
