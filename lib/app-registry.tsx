import type { ComponentType } from "react";
import { Terminal } from "@/components/terminal";
import { getClaudeOpeningWindowSnapshotDataUrl } from "@/lib/opening-window-snapshot";

export type AppWindowContentProps = {
  windowId: string;
  appId: string;
  isFocused: boolean;
  requestFocus: () => void;
};

export type AppIconProps = {
  active?: boolean;
};

export interface AppDefinition {
  id: AppId;
  label: string;
  description: string;
  keywords: string[];
  launcherVisible: boolean;
  startup: "open" | "closed";
  windowTitle: string;
  defaultWindow: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    placement?: "viewport" | "centered";
  };
  Icon: ComponentType<AppIconProps>;
  Content: ComponentType<AppWindowContentProps>;
  snapshotRenderer?: (rect: { width: number; height: number }) => string | null;
}

export const APP_REGISTRY = [
  {
    id: "claude",
    label: "Claude",
    description: "Claude Code terminal",
    keywords: ["claude", "code", "terminal", "richie", "richietan", "resume"],
    launcherVisible: true,
    startup: "open",
    windowTitle: "richie — richietan.dev — zsh",
    defaultWindow: {
      width: 800,
      height: 600,
      minWidth: 450,
      minHeight: 300,
      placement: "viewport",
    },
    Icon: ClaudeAppIcon,
    Content: ClaudeWindowContent,
    snapshotRenderer: getClaudeOpeningWindowSnapshotDataUrl,
  },
] as const satisfies readonly AppDefinition[];

export type AppId = string;

export const APP_REGISTRY_BY_ID = APP_REGISTRY.reduce<Record<string, AppDefinition>>(
  (registry, app) => {
    registry[app.id] = app;
    return registry;
  },
  {},
);

export const LAUNCHER_APPS = APP_REGISTRY.filter((app) => app.launcherVisible);

const BURST_RAYS = [
  { x1: 0, y1: -13.5, x2: 0, y2: -3.8 },
  { x1: 0, y1: 13.5, x2: 0, y2: 3.8 },
  { x1: -13.5, y1: 0, x2: -3.8, y2: 0 },
  { x1: 13.5, y1: 0, x2: 3.8, y2: 0 },
  { x1: -9.5, y1: -9.5, x2: -2.9, y2: -2.9 },
  { x1: 9.5, y1: 9.5, x2: 2.9, y2: 2.9 },
  { x1: 9.5, y1: -9.5, x2: 2.9, y2: -2.9 },
  { x1: -9.5, y1: 9.5, x2: -2.9, y2: 2.9 },
  { x1: -12.8, y1: -3.7, x2: -4.1, y2: -1.2 },
  { x1: 12.8, y1: 3.7, x2: 4.1, y2: 1.2 },
  { x1: 12.8, y1: -3.7, x2: 4.1, y2: -1.2 },
  { x1: -12.8, y1: 3.7, x2: -4.1, y2: 1.2 },
];

function ClaudeAppIcon() {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
      style={{
        background: "linear-gradient(180deg, #DD8E67 0%, #D9835B 100%)",
        boxShadow:
          "0 10px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
    >
      <svg width="30" height="30" viewBox="-15 -15 30 30" fill="none" aria-hidden="true">
        {BURST_RAYS.map((ray, index) => (
          <line
            key={index}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke="#FAF7F2"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ))}
        <circle cx="0" cy="0" r="2.4" fill="#FAF7F2" />
      </svg>
    </div>
  );
}

function ClaudeWindowContent(props: AppWindowContentProps) {
  void props;
  return <Terminal />;
}
