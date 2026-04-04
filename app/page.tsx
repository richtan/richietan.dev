"use client";

import { useChat } from "@ai-sdk/react";
import { Terminal } from "@/components/terminal";
import { MacWindow } from "@/components/mac-window";
import { Desktop } from "@/components/desktop";
import { useWindowState } from "@/lib/use-window-state";

export default function Home() {
  const { messages, status, sendMessage, setMessages } = useChat();
  const win = useWindowState();

  return (
    <Desktop
      snapPreview={win.dragSnapZone}
      isMinimized={win.state.isMinimized}
      onRestore={win.restore}
      isClosed={win.state.isClosed}
      onReopen={win.reopen}
    >
      {win.ready && (
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
          <Terminal
            messages={messages}
            status={status}
            sendMessage={sendMessage}
            setMessages={setMessages}
          />
        </MacWindow>
      )}
    </Desktop>
  );
}
