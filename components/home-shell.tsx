"use client";

import { Desktop } from "@/components/desktop";
import { MacWindow } from "@/components/mac-window";
import { Terminal } from "@/components/terminal";
import { useWindowState } from "@/lib/use-window-state";

export function HomeShell() {
  const win = useWindowState();

  return (
    <Desktop
      snapPreview={win.dragSnapZone}
      claudeStatus={
        win.state.isClosed
          ? "closed"
          : win.state.isMinimized
            ? "minimized"
            : "open"
      }
      onClaudeLaunch={() => {
        if (win.state.isClosed) {
          win.reopen();
          return;
        }

        if (win.state.isMinimized) {
          win.restore();
        }
      }}
    >
      <MacWindow
        x={win.state.x}
        y={win.state.y}
        width={win.state.width}
        height={win.state.height}
        isAnimating={win.state.isAnimating}
        isMinimized={win.state.isMinimized}
        isClosed={win.state.isClosed}
        showOpenAnim={win.showOpenAnim}
        onDragStart={win.startDrag}
        onDragMove={(newX, newY, cursorX, cursorY) => {
          win.moveToRaw(newX, newY);
          win.onDragMove(cursorX, cursorY);
        }}
        onDragEnd={win.endDrag}
        onResize={win.resizeToRaw}
        onMaximize={win.maximize}
        onMinimize={win.minimize}
        onClose={win.close}
        onAnimationEnd={win.clearAnimation}
      >
        <Terminal />
      </MacWindow>
    </Desktop>
  );
}
