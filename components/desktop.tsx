"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { ClaudeDesktopIcon } from "@/components/claude-desktop-icon";
import { getSnapRect, type SnapZone } from "@/lib/use-window-state";

interface DesktopProps {
  children: ReactNode;
  snapPreview: SnapZone;
  showDesktopIcon: boolean;
  onDesktopIconOpen: () => void;
}

export function Desktop({
  children,
  snapPreview,
  showDesktopIcon,
  onDesktopIconOpen,
}: DesktopProps) {
  const [iconSelected, setIconSelected] = useState(false);

  const handleDesktopPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-desktop-icon]")) {
      return;
    }

    setIconSelected(false);
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]"
      onPointerDown={handleDesktopPointerDown}
    >
      {children}

      {snapPreview ? <SnapPreviewOverlay zone={snapPreview} /> : null}
      {showDesktopIcon ? (
        <ClaudeDesktopIcon
          selected={iconSelected}
          onSelect={() => setIconSelected(true)}
          onOpen={() => {
            setIconSelected(false);
            onDesktopIconOpen();
          }}
        />
      ) : null}
    </div>
  );
}

function SnapPreviewOverlay({ zone }: { zone: SnapZone }) {
  const rect = getSnapRect(zone);
  if (!rect) {
    return null;
  }

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
