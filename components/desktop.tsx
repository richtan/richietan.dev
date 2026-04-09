"use client";

import type { ReactNode } from "react";
import { AppLauncher } from "@/components/app-launcher";
import type { AppDefinition, AppId } from "@/lib/app-registry";
import {
  getSnapRect,
  type LauncherAppStatus,
  type Rect,
  type SnapZone,
} from "@/lib/desktop-manager";

interface DesktopProps {
  children: ReactNode;
  snapPreview: SnapZone;
  launcherApps: readonly AppDefinition[];
  appStatuses: Record<string, LauncherAppStatus>;
  onLaunchApp: (appId: AppId) => void;
  onLauncherTriggerRectChange: (rect: Rect | null) => void;
}

export function Desktop({
  children,
  snapPreview,
  launcherApps,
  appStatuses,
  onLaunchApp,
  onLauncherTriggerRectChange,
}: DesktopProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      {children}

      {snapPreview ? <SnapPreviewOverlay zone={snapPreview} /> : null}
      <AppLauncher
        apps={launcherApps}
        appStatuses={appStatuses}
        onLaunchApp={onLaunchApp}
        onTriggerRectChange={onLauncherTriggerRectChange}
      />
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
