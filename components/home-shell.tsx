"use client";

import { toPng } from "html-to-image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Desktop } from "@/components/desktop";
import {
  GenieWindowOverlay,
} from "@/components/genie-window-overlay";
import { MacWindow } from "@/components/mac-window";
import { Terminal } from "@/components/terminal";
import {
  isCachedWindowSnapshotCompatible,
  readCachedWindowSnapshot,
  writeCachedWindowSnapshot,
  type CachedWindowSnapshot,
} from "@/lib/window-snapshot-cache";
import {
  useWindowState,
  type Rect,
  type WindowTransitionPhase,
} from "@/lib/use-window-state";

const OPEN_FALLBACK_MS = 220;
const SNAPSHOT_REFRESH_DEBOUNCE_MS = 650;

function isGeniePhase(
  phase: WindowTransitionPhase,
): phase is Exclude<WindowTransitionPhase, "idle"> {
  return phase !== "idle";
}

type GenieSnapshot = {
  key: number;
  src: string;
};

export function HomeShell() {
  const win = useWindowState();
  const [launcherRect, setLauncherRect] = useState<Rect | null>(null);
  const [cachedSnapshot, setCachedSnapshot] = useState<CachedWindowSnapshot | null>(
    () => readCachedWindowSnapshot(),
  );
  const [genieSnapshot, setGenieSnapshot] = useState<GenieSnapshot | null>(null);
  const [genieHasTakenOver, setGenieHasTakenOver] = useState(false);
  const [genieWindowRect, setGenieWindowRect] = useState<Rect | null>(null);
  const liveWindowRef = useRef<HTMLDivElement | null>(null);
  const liveSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCapturingRef = useRef(false);

  const geniePhase = win.state.transitionPhase;
  const transitionKey = win.state.transitionKey;
  const isClosed = win.state.isClosed;
  const isMinimized = win.state.isMinimized;
  const isAnimating = win.state.isAnimating;
  const windowRect = useMemo(
    () => ({
      x: win.state.x,
      y: win.state.y,
      width: win.state.width,
      height: win.state.height,
    }),
    [win.state.height, win.state.width, win.state.x, win.state.y],
  );
  const finishGenieTransition = win.finishGenieTransition;
  const reopenWindow = win.reopen;
  const restoreWindow = win.restore;
  const restoreImmediately = win.restoreImmediately;
  const minimizeWindow = win.minimize;
  const minimizeImmediately = win.minimizeImmediately;

  const compatibleCachedSnapshot = useMemo(() => {
    return isCachedWindowSnapshotCompatible(cachedSnapshot, windowRect)
      ? cachedSnapshot
      : null;
  }, [cachedSnapshot, windowRect]);

  const activeSnapshot =
    genieSnapshot?.key === transitionKey
      ? genieSnapshot.src
      : geniePhase === "opening-genie"
        ? compatibleCachedSnapshot?.src ?? null
        : null;

  const showGenie =
    isGeniePhase(geniePhase) &&
    launcherRect !== null &&
    activeSnapshot !== null &&
    genieWindowRect !== null;
  const showFallbackOpen =
    geniePhase === "opening-genie" && activeSnapshot === null;
  const renderMacWindow = !isClosed || isAnimating;

  const handleGenieComplete = useCallback(() => {
    setGenieHasTakenOver(false);
    setGenieWindowRect(null);
    setGenieSnapshot(null);
    finishGenieTransition();
  }, [finishGenieTransition]);

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
      writeCachedWindowSnapshot(src, windowRect);
      setCachedSnapshot(readCachedWindowSnapshot());
    },
    [windowRect],
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
      minimizeImmediately();
      return;
    }

    setGenieSnapshot({
      key: transitionKey + 1,
      src: snapshot,
    });
    minimizeWindow();
  }, [
    compatibleCachedSnapshot,
    geniePhase,
    isClosed,
    isMinimized,
    minimizeImmediately,
    minimizeWindow,
    transitionKey,
  ]);

  const handleClaudeLaunch = useCallback(() => {
    const snapshot = lastSnapshotRef.current ?? compatibleCachedSnapshot?.src ?? null;

    if (isClosed) {
      if (snapshot) {
        setGenieSnapshot({
          key: transitionKey + 1,
          src: snapshot,
        });
      }
      reopenWindow();
      return;
    }

    if (!isMinimized) {
      return;
    }

    if (snapshot) {
      setGenieSnapshot({
        key: transitionKey + 1,
        src: snapshot,
      });
      restoreWindow();
      return;
    }

    restoreImmediately();
  }, [
    compatibleCachedSnapshot,
    isClosed,
    isMinimized,
    reopenWindow,
    restoreImmediately,
    restoreWindow,
    transitionKey,
  ]);

  return (
    <Desktop
      snapPreview={win.dragSnapZone}
      claudeStatus={
        isClosed ? "closed" : isMinimized ? "minimized" : "open"
      }
      onLauncherTriggerRectChange={setLauncherRect}
      onClaudeLaunch={handleClaudeLaunch}
    >
      {showGenie && launcherRect && activeSnapshot && genieWindowRect ? (
        <GenieWindowOverlay
          key={transitionKey}
          phase={geniePhase}
          imageSrc={activeSnapshot}
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
          surfaceRef={liveSurfaceRef}
          x={windowRect.x}
          y={windowRect.y}
          width={windowRect.width}
          height={windowRect.height}
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
          onDragStart={win.startDrag}
          onDragMove={(newX, newY, cursorX, cursorY) => {
            win.moveToRaw(newX, newY);
            win.onDragMove(cursorX, cursorY);
          }}
          onDragEnd={win.endDrag}
          onResize={win.resizeToRaw}
          onMaximize={win.maximize}
          onMinimize={handleMinimize}
          onClose={win.close}
          onAnimationEnd={win.clearAnimation}
        >
          <Terminal />
        </MacWindow>
      ) : null}
    </Desktop>
  );
}

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
