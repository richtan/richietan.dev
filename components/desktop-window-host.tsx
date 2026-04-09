"use client";

import { toPng } from "html-to-image";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GenieWindowOverlay } from "@/components/genie-window-overlay";
import { MacWindow } from "@/components/mac-window";
import type { AppDefinition } from "@/lib/app-registry";
import {
  getWindowFrameStyle,
  resolveWindowRect,
  type DesktopWindow,
  type Rect,
  type Viewport,
  type WindowTransitionPhase,
} from "@/lib/desktop-manager";
import {
  isCachedWindowSnapshotCompatible,
  isCachedWindowSnapshotOpeningCompatible,
  readCachedWindowSnapshot,
  writeCachedWindowSnapshot,
  type CachedWindowSnapshot,
} from "@/lib/window-snapshot-cache";

const OPEN_FALLBACK_MS = 220;
const SNAPSHOT_REFRESH_DEBOUNCE_MS = 650;

type GenieSnapshot = {
  key: number;
  source: string;
};

interface DesktopWindowHostProps {
  app: AppDefinition;
  window: DesktopWindow;
  viewport: Viewport;
  launcherRect: Rect | null;
  onFocusWindow: (windowId: string) => void;
  onMoveWindowToRaw: (windowId: string, x: number, y: number) => void;
  onResizeWindowToRaw: (
    windowId: string,
    width: number,
    height: number,
    x: number,
    y: number,
  ) => void;
  onStartDrag: (windowId: string) => void;
  onUpdateDragPreview: (windowId: string, cursorX: number, cursorY: number) => void;
  onEndDrag: (windowId: string) => void;
  onMaximizeWindow: (windowId: string) => void;
  onMinimizeWindow: (windowId: string) => void;
  onMinimizeWindowImmediately: (windowId: string) => void;
  onCloseWindow: (windowId: string) => void;
  onClearAnimation: (windowId: string) => void;
  onFinishWindowTransition: (windowId: string) => void;
}

function isGeniePhase(
  phase: WindowTransitionPhase,
): phase is Exclude<WindowTransitionPhase, "idle"> {
  return phase !== "idle";
}

export const DesktopWindowHost = memo(function DesktopWindowHost({
  app,
  window: desktopWindow,
  viewport,
  launcherRect,
  onFocusWindow,
  onMoveWindowToRaw,
  onResizeWindowToRaw,
  onStartDrag,
  onUpdateDragPreview,
  onEndDrag,
  onMaximizeWindow,
  onMinimizeWindow,
  onMinimizeWindowImmediately,
  onCloseWindow,
  onClearAnimation,
  onFinishWindowTransition,
}: DesktopWindowHostProps) {
  const [cachedSnapshot, setCachedSnapshot] = useState<CachedWindowSnapshot | null>(
    () => readCachedWindowSnapshot(desktopWindow.appId),
  );
  const [genieSnapshot, setGenieSnapshot] = useState<GenieSnapshot | null>(null);
  const [genieHasTakenOver, setGenieHasTakenOver] = useState(false);
  const [genieWindowRect, setGenieWindowRect] = useState<Rect | null>(null);
  const liveWindowRef = useRef<HTMLDivElement | null>(null);
  const liveSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCapturingRef = useRef(false);

  const Content = app.Content;
  const geniePhase = desktopWindow.transitionPhase;
  const transitionKey = desktopWindow.transitionKey;
  const isClosed = desktopWindow.isClosed;
  const isMinimized = desktopWindow.isMinimized;
  const isAnimating = desktopWindow.isAnimating;
  const windowRect = useMemo(
    () => resolveWindowRect(desktopWindow, viewport),
    [desktopWindow, viewport],
  );
  const frameStyle = useMemo(
    () => getWindowFrameStyle(desktopWindow, viewport),
    [desktopWindow, viewport],
  );

  const compatibleCachedSnapshot = useMemo(() => {
    return isCachedWindowSnapshotCompatible(cachedSnapshot, windowRect)
      ? cachedSnapshot
      : null;
  }, [cachedSnapshot, windowRect]);

  const openingCachedSnapshot = useMemo(() => {
    return isCachedWindowSnapshotOpeningCompatible(cachedSnapshot, windowRect)
      ? cachedSnapshot
      : null;
  }, [cachedSnapshot, windowRect]);

  const generatedOpeningSnapshotSrc = useMemo(
    () => app.snapshotRenderer?.(windowRect) ?? null,
    [app, windowRect],
  );
  const openingSnapshotSrc =
    openingCachedSnapshot?.src ?? generatedOpeningSnapshotSrc ?? null;

  const activeSnapshot =
    genieSnapshot?.key === transitionKey
      ? genieSnapshot.source
      : geniePhase === "opening-genie"
        ? openingSnapshotSrc
        : geniePhase === "restoring-genie"
          ? lastSnapshotRef.current ??
            compatibleCachedSnapshot?.src ??
            openingSnapshotSrc
          : null;

  const showGenie =
    isGeniePhase(geniePhase) &&
    launcherRect !== null &&
    activeSnapshot !== null &&
    genieWindowRect !== null;
  const showFallbackOpen = geniePhase === "opening-genie" && !showGenie;
  const renderMacWindow = !isClosed || isAnimating;

  const handleGenieComplete = useCallback(() => {
    setGenieHasTakenOver(false);
    setGenieWindowRect(null);
    setGenieSnapshot(null);
    onFinishWindowTransition(desktopWindow.id);
  }, [desktopWindow.id, onFinishWindowTransition]);

  const handleGenieTakeover = useCallback(() => {
    setGenieHasTakenOver(true);
  }, []);

  useLayoutEffect(() => {
    setGenieHasTakenOver(false);

    if (!isGeniePhase(geniePhase)) {
      setGenieWindowRect(null);
      return;
    }

    if (geniePhase === "minimizing-genie") {
      setGenieWindowRect(measureWindowRect(liveSurfaceRef.current) ?? windowRect);
      return;
    }

    setGenieWindowRect(windowRect);
  }, [geniePhase, transitionKey, windowRect]);

  const persistSnapshot = useCallback(
    (src: string) => {
      lastSnapshotRef.current = src;
      writeCachedWindowSnapshot(desktopWindow.appId, src, windowRect);
      setCachedSnapshot(readCachedWindowSnapshot(desktopWindow.appId));
    },
    [desktopWindow.appId, windowRect],
  );

  const captureWindow = useCallback(async (node: HTMLElement | null) => {
    if (!node) {
      throw new Error("Missing window node");
    }

    if ("fonts" in document && document.fonts.status !== "loaded") {
      await document.fonts.ready;
    }

    await waitForNextFrame();

    return toPng(node, {
      cacheBust: true,
      pixelRatio: 1,
      skipAutoScale: true,
    });
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (
      isCapturingRef.current ||
      geniePhase !== "idle" ||
      isAnimating ||
      isClosed ||
      isMinimized ||
      !liveSurfaceRef.current
    ) {
      return;
    }

    isCapturingRef.current = true;

    try {
      const src = await captureWindow(liveSurfaceRef.current);
      persistSnapshot(src);
    } catch {
      // Keep the last successful snapshot.
    } finally {
      isCapturingRef.current = false;
    }
  }, [captureWindow, geniePhase, isAnimating, isClosed, isMinimized, persistSnapshot]);

  const queueSnapshotRefresh = useCallback(
    (delay = SNAPSHOT_REFRESH_DEBOUNCE_MS) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(
            () => {
              void refreshSnapshot();
            },
            { timeout: 700 },
          );
          return;
        }

        void refreshSnapshot();
      }, delay);
    },
    [refreshSnapshot],
  );

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (compatibleCachedSnapshot?.src) {
      lastSnapshotRef.current = compatibleCachedSnapshot.src;
    }
  }, [compatibleCachedSnapshot]);

  useEffect(() => {
    setCachedSnapshot(readCachedWindowSnapshot(desktopWindow.appId));
  }, [desktopWindow.appId]);

  useEffect(() => {
    if (!showFallbackOpen) {
      return;
    }

    const timer = window.setTimeout(handleGenieComplete, OPEN_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [handleGenieComplete, showFallbackOpen]);

  useEffect(() => {
    if (
      !renderMacWindow ||
      geniePhase !== "idle" ||
      isAnimating ||
      isClosed ||
      isMinimized
    ) {
      return;
    }

    const node = liveWindowRef.current;
    if (!node) {
      return;
    }

    queueSnapshotRefresh(360);

    const resizeObserver = new ResizeObserver(() => {
      queueSnapshotRefresh();
    });
    resizeObserver.observe(node);

    const mutationObserver = new MutationObserver(() => {
      queueSnapshotRefresh();
    });
    mutationObserver.observe(node, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [
    geniePhase,
    isAnimating,
    isClosed,
    isMinimized,
    queueSnapshotRefresh,
    renderMacWindow,
  ]);

  const handleMinimize = useCallback(() => {
    if (geniePhase !== "idle" || isClosed || isMinimized) {
      return;
    }

    const snapshot = lastSnapshotRef.current ?? compatibleCachedSnapshot?.src ?? null;
    if (!snapshot) {
      onMinimizeWindowImmediately(desktopWindow.id);
      return;
    }

    setGenieSnapshot({
      key: transitionKey + 1,
      source: snapshot,
    });
    onMinimizeWindow(desktopWindow.id);
  }, [
    compatibleCachedSnapshot,
    desktopWindow.id,
    geniePhase,
    isClosed,
    isMinimized,
    onMinimizeWindow,
    onMinimizeWindowImmediately,
    transitionKey,
  ]);

  const requestFocus = useCallback(() => {
    onFocusWindow(desktopWindow.id);
  }, [desktopWindow.id, onFocusWindow]);

  return (
    <>
      {showGenie && launcherRect && activeSnapshot && genieWindowRect ? (
        <GenieWindowOverlay
          key={transitionKey}
          phase={geniePhase}
          imageSource={activeSnapshot}
          windowRect={genieWindowRect}
          targetRect={launcherRect}
          animationKey={transitionKey}
          onTakeover={handleGenieTakeover}
          onComplete={handleGenieComplete}
        />
      ) : null}

      {renderMacWindow ? (
        <MacWindow
          ref={liveWindowRef}
          title={desktopWindow.title}
          minWidth={desktopWindow.minWidth}
          minHeight={desktopWindow.minHeight}
          surfaceRef={liveSurfaceRef}
          x={windowRect.x}
          y={windowRect.y}
          width={windowRect.width}
          height={windowRect.height}
          frameStyle={frameStyle}
          showOpenIntro={showFallbackOpen}
          disableInteraction={isGeniePhase(geniePhase)}
          hideVisual={
            geniePhase === "minimizing-genie"
              ? genieHasTakenOver
              : geniePhase === "opening-genie" || geniePhase === "restoring-genie"
                ? true
                : false
          }
          visualOpacity={
            geniePhase === "minimizing-genie"
              ? genieHasTakenOver
                ? 0
                : 1
              : geniePhase === "opening-genie" || geniePhase === "restoring-genie"
                ? 0
                : 1
          }
          isAnimating={isAnimating}
          isMinimized={isMinimized}
          isClosed={isClosed}
          onFocusRequest={requestFocus}
          onDragStart={() => {
            requestFocus();
            onStartDrag(desktopWindow.id);
          }}
          onDragMove={(newX, newY, cursorX, cursorY) => {
            onMoveWindowToRaw(desktopWindow.id, newX, newY);
            onUpdateDragPreview(desktopWindow.id, cursorX, cursorY);
          }}
          onDragEnd={() => onEndDrag(desktopWindow.id)}
          onResize={(width, height, x, y) => {
            onResizeWindowToRaw(desktopWindow.id, width, height, x, y);
          }}
          onMaximize={() => onMaximizeWindow(desktopWindow.id)}
          onMinimize={handleMinimize}
          onClose={() => onCloseWindow(desktopWindow.id)}
          onAnimationEnd={() => onClearAnimation(desktopWindow.id)}
        >
          <Content
            windowId={desktopWindow.id}
            appId={desktopWindow.appId}
            isFocused={desktopWindow.isFocused}
            requestFocus={requestFocus}
          />
        </MacWindow>
      ) : null}
    </>
  );
});

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function measureWindowRect(node: HTMLDivElement | null): Rect | null {
  if (!node) {
    return null;
  }

  const rect = node.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
