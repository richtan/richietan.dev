"use client";

import type { SnapZone } from "@/lib/use-window-state";
import { getSnapRect } from "@/lib/use-window-state";

interface DesktopProps {
  children: React.ReactNode;
  snapPreview: SnapZone;
  isMinimized: boolean;
  onRestore: () => void;
  isClosed: boolean;
  onReopen: () => void;
}

export function Desktop({
  children,
  snapPreview,
  isMinimized,
  onRestore,
  isClosed,
  onReopen,
}: DesktopProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {children}

      {/* Snap preview overlay */}
      {snapPreview && <SnapPreviewOverlay zone={snapPreview} />}

      {/* Dock icon for minimized window */}
      {isMinimized && <DockIcon onClick={onRestore} />}

      {/* Closed state — click to reopen */}
      {isClosed && <ClosedOverlay onClick={onReopen} />}
    </div>
  );
}

function SnapPreviewOverlay({ zone }: { zone: SnapZone }) {
  const rect = getSnapRect(zone);
  if (!rect) return null;

  return (
    <div
      className="pointer-events-none absolute z-40 rounded-[10px] border-2 border-white/20 bg-white/10 transition-all duration-150"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}

function DockIcon({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2">
      <button
        onClick={onClick}
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#323232] shadow-lg transition-transform hover:scale-110 active:scale-95"
        style={{
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
        title="Click to restore"
      >
        <span className="text-lg text-cc-claude">✻</span>
      </button>
    </div>
  );
}

function ClosedOverlay({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <button
        onClick={onClick}
        className="group flex flex-col items-center gap-3 transition-opacity"
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#323232] transition-transform group-hover:scale-110"
          style={{ boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)" }}
        >
          <span className="text-2xl text-cc-claude">✻</span>
        </div>
        <span className="text-sm text-white/60 group-hover:text-white/80">
          Click to open
        </span>
      </button>
    </div>
  );
}
