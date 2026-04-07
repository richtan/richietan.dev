"use client";

import type { ReactNode } from "react";
import { AppLauncher } from "@/components/app-launcher";
import { getSnapRect, type SnapZone } from "@/lib/use-window-state";

interface DesktopProps {
  children: ReactNode;
  snapPreview: SnapZone;
  claudeStatus: "open" | "minimized" | "closed";
  onClaudeLaunch: () => void;
}

export function Desktop({
  children,
  snapPreview,
  claudeStatus,
  onClaudeLaunch,
}: DesktopProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {children}

      {snapPreview ? <SnapPreviewOverlay zone={snapPreview} /> : null}
      <AppLauncher claudeStatus={claudeStatus} onClaudeLaunch={onClaudeLaunch} />
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
