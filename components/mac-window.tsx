"use client";

import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";

interface MacWindowProps {
  children: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  isAnimating: boolean;
  isMinimized: boolean;
  isClosed: boolean;
  showOpenAnim: boolean;
  onDragStart: () => void;
  onDragMove: (newX: number, newY: number, cursorX: number, cursorY: number) => void;
  onDragEnd: () => void;
  onResize: (width: number, height: number, x: number, y: number) => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onAnimationEnd: () => void;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ANIM_DURATION = "0.4s";
const MIN_W = 450;
const MIN_H = 300;
const HANDLE = 6;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function MacWindow({
  children,
  x,
  y,
  width,
  height,
  isAnimating,
  isMinimized,
  isClosed,
  showOpenAnim,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResize,
  onMaximize,
  onMinimize,
  onClose,
  onAnimationEnd,
}: MacWindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const handleTitlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).closest("[data-traffic-light]")) {
        return;
      }

      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startY: event.clientY, winX: x, winY: y };
      onDragStart();
    },
    [onDragStart, x, y],
  );

  const handleTitlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current) {
        return;
      }

      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      onDragMove(
        dragRef.current.winX + dx,
        dragRef.current.winY + dy,
        event.clientX,
        event.clientY,
      );
    },
    [onDragMove],
  );

  const handleTitlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current) {
        return;
      }

      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      dragRef.current = null;
      onDragEnd();
    },
    [onDragEnd],
  );

  const handleResizePointerDown = useCallback(
    (dir: ResizeDir, event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      resizeRef.current = {
        dir,
        startX: event.clientX,
        startY: event.clientY,
        origX: x,
        origY: y,
        origW: width,
        origH: height,
      };
    },
    [height, width, x, y],
  );

  const handleResizePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const active = resizeRef.current;
      if (!active) {
        return;
      }

      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      let nextX = active.origX;
      let nextY = active.origY;
      let nextWidth = active.origW;
      let nextHeight = active.origH;

      if (active.dir.includes("e")) {
        nextWidth = Math.max(MIN_W, active.origW + dx);
      }

      if (active.dir.includes("w")) {
        const proposedWidth = active.origW - dx;
        if (proposedWidth >= MIN_W) {
          nextWidth = proposedWidth;
          nextX = active.origX + dx;
        }
      }

      if (active.dir === "s" || active.dir === "se" || active.dir === "sw") {
        nextHeight = Math.max(MIN_H, active.origH + dy);
      }

      if (active.dir === "n" || active.dir === "ne" || active.dir === "nw") {
        const proposedHeight = active.origH - dy;
        if (proposedHeight >= MIN_H) {
          nextHeight = proposedHeight;
          nextY = active.origY + dy;
        }
      }

      onResize(nextWidth, nextHeight, nextX, nextY);
    },
    [onResize],
  );

  const handleResizePointerUp = useCallback((event: React.PointerEvent) => {
    if (!resizeRef.current) {
      return;
    }

    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    resizeRef.current = null;
  }, []);

  const transition = isAnimating
    ? `left ${ANIM_DURATION} ${EASE}, top ${ANIM_DURATION} ${EASE}, width ${ANIM_DURATION} ${EASE}, height ${ANIM_DURATION} ${EASE}, opacity ${ANIM_DURATION} ${EASE}, transform ${ANIM_DURATION} ${EASE}`
    : "none";

  let extraStyle: CSSProperties = {};

  if (isMinimized) {
    extraStyle = {
      transform: "scale(0.12) translateY(55vh)",
      opacity: 0,
      pointerEvents: "none",
      transformOrigin: "center bottom",
    };
  } else if (isClosed) {
    extraStyle = {
      transform: "scale(0.92)",
      opacity: 0,
      pointerEvents: "none",
    };
  } else if (showOpenAnim) {
    extraStyle = {
      animation: `windowOpen 0.4s ${EASE} forwards`,
      opacity: 0,
    };
  }

  return (
    <div
      className="absolute z-30"
      style={{
        left: x,
        top: y,
        width,
        height,
        transition,
        willChange:
          isAnimating || showOpenAnim
            ? "left, top, width, height, transform, opacity"
            : "auto",
        ...extraStyle,
      }}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.propertyName === "left" ||
            event.propertyName === "opacity" ||
            event.propertyName === "transform")
        ) {
          onAnimationEnd();
        }
      }}
    >
      {!isMinimized && !isClosed ? (
        <ResizeHandles
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      ) : null}

      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-[10px]"
        style={{
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.15), 0 22px 70px 4px rgba(0,0,0,0.2)",
        }}
      >
        <div
          className="relative flex shrink-0 items-center px-3"
          onPointerDown={handleTitlePointerDown}
          onPointerMove={handleTitlePointerMove}
          onPointerUp={handleTitlePointerUp}
          onDoubleClick={onMaximize}
          style={{
            height: "32px",
            background: "#323232",
            userSelect: "none",
            cursor: "default",
            touchAction: "none",
          }}
        >
          <TrafficLights
            onClose={onClose}
            onMinimize={onMinimize}
            onMaximize={onMaximize}
          />
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
              fontSize: "13px",
              fontWeight: 400,
              color: "#EBEBEB",
            }}
          >
            richie — richietan.dev — zsh
          </span>
        </div>

        <div className="flex-1 overflow-hidden bg-black">{children}</div>
      </div>
    </div>
  );
}

function ResizeHandles({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (dir: ResizeDir, event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
}) {
  const common = {
    onPointerMove,
    onPointerUp,
    style: { position: "absolute" as const, touchAction: "none" as const },
  };

  return (
    <>
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("n", event)}
        className="cursor-ns-resize"
        style={{ ...common.style, top: -HANDLE / 2, left: HANDLE, right: HANDLE, height: HANDLE }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("s", event)}
        className="cursor-ns-resize"
        style={{
          ...common.style,
          bottom: -HANDLE / 2,
          left: HANDLE,
          right: HANDLE,
          height: HANDLE,
        }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("e", event)}
        className="cursor-ew-resize"
        style={{ ...common.style, right: -HANDLE / 2, top: HANDLE, bottom: HANDLE, width: HANDLE }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("w", event)}
        className="cursor-ew-resize"
        style={{ ...common.style, left: -HANDLE / 2, top: HANDLE, bottom: HANDLE, width: HANDLE }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("nw", event)}
        className="cursor-nwse-resize"
        style={{ ...common.style, top: -HANDLE / 2, left: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("ne", event)}
        className="cursor-nesw-resize"
        style={{ ...common.style, top: -HANDLE / 2, right: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("sw", event)}
        className="cursor-nesw-resize"
        style={{ ...common.style, bottom: -HANDLE / 2, left: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }}
      />
      <div
        {...common}
        onPointerDown={(event) => onPointerDown("se", event)}
        className="cursor-nwse-resize"
        style={{ ...common.style, bottom: -HANDLE / 2, right: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }}
      />
    </>
  );
}

function TrafficLights({
  onClose,
  onMinimize,
  onMaximize,
}: {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}) {
  return (
    <div className="group flex items-center gap-2" data-traffic-light>
      <TrafficLight color="#FF5F57" icon="close" onClick={onClose} />
      <TrafficLight color="#FEBC2E" icon="minimize" onClick={onMinimize} />
      <TrafficLight color="#28C840" icon="maximize" onClick={onMaximize} />
    </div>
  );
}

function TrafficLight({
  color,
  icon,
  onClick,
}: {
  color: string;
  icon: "close" | "minimize" | "maximize";
  onClick: () => void;
}) {
  return (
    <button
      data-traffic-light
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="relative flex items-center justify-center"
      style={{
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: color,
        border: "0.5px solid rgba(0, 0, 0, 0.12)",
        cursor: "default",
      }}
    >
      <svg className="hidden group-hover:block" width="6" height="6" viewBox="0 0 6 6" fill="none">
        {icon === "close" ? (
          <>
            <line x1="0.5" y1="0.5" x2="5.5" y2="5.5" stroke="#4D0000" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="5.5" y1="0.5" x2="0.5" y2="5.5" stroke="#4D0000" strokeWidth="1.2" strokeLinecap="round" />
          </>
        ) : null}
        {icon === "minimize" ? (
          <line x1="0.5" y1="3" x2="5.5" y2="3" stroke="#995700" strokeWidth="1.2" strokeLinecap="round" />
        ) : null}
        {icon === "maximize" ? (
          <>
            <polyline points="1,4 1,1 4,1" fill="none" stroke="#006500" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="5,2 5,5 2,5" fill="none" stroke="#006500" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
      </svg>
    </button>
  );
}
