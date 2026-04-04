"use client";

import { useCallback, useRef } from "react";

interface MacWindowProps {
  children: React.ReactNode;
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
const HANDLE = 6; // resize handle thickness in px

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
  // ---- Drag ----
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);

  const handleTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't drag from traffic light buttons
      if ((e.target as HTMLElement).closest("[data-traffic-light]")) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, winX: x, winY: y };
      onDragStart();
    },
    [x, y, onDragStart],
  );

  const handleTitlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = dragRef.current.winX + dx;
      const newY = dragRef.current.winY + dy;
      onDragMove(newX, newY, e.clientX, e.clientY);
    },
    [onDragMove],
  );

  const handleTitlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
      onDragEnd();
    },
    [onDragEnd],
  );

  // ---- Resize ----
  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const handleResizePointerDown = useCallback(
    (dir: ResizeDir, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
        origW: width,
        origH: height,
      };
    },
    [x, y, width, height],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;

      let newX = r.origX;
      let newY = r.origY;
      let newW = r.origW;
      let newH = r.origH;

      // East edge
      if (r.dir.includes("e")) {
        newW = Math.max(MIN_W, r.origW + dx);
      }
      // West edge
      if (r.dir.includes("w")) {
        const proposedW = r.origW - dx;
        if (proposedW >= MIN_W) {
          newW = proposedW;
          newX = r.origX + dx;
        }
      }
      // South edge
      if (r.dir === "s" || r.dir === "se" || r.dir === "sw") {
        newH = Math.max(MIN_H, r.origH + dy);
      }
      // North edge
      if (r.dir === "n" || r.dir === "ne" || r.dir === "nw") {
        const proposedH = r.origH - dy;
        if (proposedH >= MIN_H) {
          newH = proposedH;
          newY = r.origY + dy;
        }
      }

      onResize(newW, newH, newX, newY);
    },
    [onResize],
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      resizeRef.current = null;
    },
    [],
  );

  // ---- Styles ----
  const transition = isAnimating
    ? `left ${ANIM_DURATION} ${EASE}, top ${ANIM_DURATION} ${EASE}, width ${ANIM_DURATION} ${EASE}, height ${ANIM_DURATION} ${EASE}, opacity ${ANIM_DURATION} ${EASE}, transform ${ANIM_DURATION} ${EASE}`
    : "none";

  let extraStyle: React.CSSProperties = {};

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
    // Use CSS @keyframes animation — starts at opacity:0 scale(0.95), ends at opacity:1 scale(1)
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
        willChange: isAnimating || showOpenAnim ? "left, top, width, height, transform, opacity" : "auto",
        ...extraStyle,
      }}
      onTransitionEnd={(e) => {
        // Only fire once (on the first property that finishes)
        if (e.target === e.currentTarget && (e.propertyName === "left" || e.propertyName === "opacity" || e.propertyName === "transform")) {
          onAnimationEnd();
        }
      }}
    >
      {/* Resize handles */}
      {!isMinimized && !isClosed && (
        <ResizeHandles
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}

      {/* Window content */}
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-[10px]"
        style={{
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.15), 0 22px 70px 4px rgba(0,0,0,0.2)",
        }}
      >
        {/* Title bar — drag handle */}
        <div
          className="relative flex shrink-0 items-center px-3"
          onPointerDown={handleTitlePointerDown}
          onPointerMove={handleTitlePointerMove}
          onPointerUp={handleTitlePointerUp}
          onDoubleClick={onMaximize}
          style={{
            height: "38px",
            background: "#323232",
            userSelect: "none",
            cursor: "default",
            touchAction: "none",
          }}
        >
          <TrafficLights onClose={onClose} onMinimize={onMinimize} onMaximize={onMaximize} />
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
              fontSize: "13px",
              fontWeight: 400,
              color: "#EBEBEB",
            }}
          >
            richie — richietan.dev — zsh
          </span>
        </div>

        {/* Terminal body */}
        <div className="flex-1 overflow-hidden bg-black">{children}</div>
      </div>
    </div>
  );
}

// ---- Resize Handles ----

function ResizeHandles({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (dir: ResizeDir, e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const common = {
    onPointerMove,
    onPointerUp,
    style: { position: "absolute" as const, touchAction: "none" as const },
  };

  return (
    <>
      {/* Edges */}
      <div {...common} onPointerDown={(e) => onPointerDown("n", e)} className="cursor-ns-resize" style={{ ...common.style, top: -HANDLE / 2, left: HANDLE, right: HANDLE, height: HANDLE }} />
      <div {...common} onPointerDown={(e) => onPointerDown("s", e)} className="cursor-ns-resize" style={{ ...common.style, bottom: -HANDLE / 2, left: HANDLE, right: HANDLE, height: HANDLE }} />
      <div {...common} onPointerDown={(e) => onPointerDown("e", e)} className="cursor-ew-resize" style={{ ...common.style, right: -HANDLE / 2, top: HANDLE, bottom: HANDLE, width: HANDLE }} />
      <div {...common} onPointerDown={(e) => onPointerDown("w", e)} className="cursor-ew-resize" style={{ ...common.style, left: -HANDLE / 2, top: HANDLE, bottom: HANDLE, width: HANDLE }} />
      {/* Corners */}
      <div {...common} onPointerDown={(e) => onPointerDown("nw", e)} className="cursor-nwse-resize" style={{ ...common.style, top: -HANDLE / 2, left: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }} />
      <div {...common} onPointerDown={(e) => onPointerDown("ne", e)} className="cursor-nesw-resize" style={{ ...common.style, top: -HANDLE / 2, right: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }} />
      <div {...common} onPointerDown={(e) => onPointerDown("sw", e)} className="cursor-nesw-resize" style={{ ...common.style, bottom: -HANDLE / 2, left: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }} />
      <div {...common} onPointerDown={(e) => onPointerDown("se", e)} className="cursor-nwse-resize" style={{ ...common.style, bottom: -HANDLE / 2, right: -HANDLE / 2, width: HANDLE * 2, height: HANDLE * 2 }} />
    </>
  );
}

// ---- Traffic Lights ----

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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
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
        {icon === "close" && (
          <>
            <line x1="0.5" y1="0.5" x2="5.5" y2="5.5" stroke="#4D0000" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="5.5" y1="0.5" x2="0.5" y2="5.5" stroke="#4D0000" strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
        {icon === "minimize" && (
          <line x1="0.5" y1="3" x2="5.5" y2="3" stroke="#995700" strokeWidth="1.2" strokeLinecap="round" />
        )}
        {icon === "maximize" && (
          <>
            <polyline points="1,4 1,1 4,1" fill="none" stroke="#006500" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="5,2 5,5 2,5" fill="none" stroke="#006500" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </button>
  );
}
