"use client";

import { useState } from "react";
import { Desktop } from "@/components/desktop";
import { DesktopWindowHost } from "@/components/desktop-window-host";
import {
  APP_REGISTRY,
  APP_REGISTRY_BY_ID,
  LAUNCHER_APPS,
} from "@/lib/app-registry";
import { useDesktopManager, type Rect } from "@/lib/desktop-manager";

export function HomeShell() {
  const desktop = useDesktopManager(APP_REGISTRY);
  const [launcherRect, setLauncherRect] = useState<Rect | null>(null);

  return (
    <Desktop
      snapPreview={desktop.dragSnapZone}
      launcherApps={LAUNCHER_APPS}
      appStatuses={desktop.launcherStatuses}
      onLauncherTriggerRectChange={setLauncherRect}
      onLaunchApp={desktop.launchApp}
    >
      {desktop.windows.map((window) => {
        const app = APP_REGISTRY_BY_ID[window.appId];

        return (
          <DesktopWindowHost
            key={window.id}
            app={app}
            window={window}
            viewport={desktop.viewport}
            launcherRect={launcherRect}
            onFocusWindow={desktop.focusWindow}
            onMoveWindowToRaw={desktop.moveWindowToRaw}
            onResizeWindowToRaw={desktop.resizeWindowToRaw}
            onStartDrag={desktop.startDrag}
            onUpdateDragPreview={desktop.updateDragPreview}
            onEndDrag={desktop.endDrag}
            onMaximizeWindow={desktop.maximizeWindow}
            onMinimizeWindow={desktop.minimizeWindow}
            onMinimizeWindowImmediately={desktop.minimizeWindowImmediately}
            onCloseWindow={desktop.closeWindow}
            onClearAnimation={desktop.clearAnimation}
            onFinishWindowTransition={desktop.finishWindowTransition}
          />
        );
      })}
    </Desktop>
  );
}
