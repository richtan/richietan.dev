"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

type ClaudeLauncherStatus = "open" | "minimized" | "closed";

interface AppLauncherProps {
  claudeStatus: ClaudeLauncherStatus;
  onClaudeLaunch: () => void;
}

interface LauncherApp {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

const CLAUDE_APP: LauncherApp = {
  id: "claude",
  label: "Claude",
  description: "Claude Code terminal",
  keywords: ["claude", "code", "terminal", "richie", "richietan"],
};

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

const OPEN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function AppLauncher({
  claudeStatus,
  onClaudeLaunch,
}: AppLauncherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const showResultsRegion = normalizedQuery.length > 0;

  const filteredApps = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return [CLAUDE_APP].filter((app) => {
      const haystack = [app.label, app.description, ...app.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);
  const selectedIndex =
    filteredApps.length === 0 ? 0 : Math.min(activeIndex, filteredApps.length - 1);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function closeLauncher() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function launchApp(app: LauncherApp | undefined) {
    if (!app) {
      return;
    }

    if (app.id === "claude") {
      onClaudeLaunch();
      closeLauncher();
    }
  }

  function handleTriggerClick() {
    if (open) {
      closeLauncher();
      return;
    }

    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLauncher();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      launchApp(filteredApps[selectedIndex]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredApps.length === 0) {
        return;
      }

      setActiveIndex((index) => (index + 1) % filteredApps.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredApps.length === 0) {
        return;
      }

      setActiveIndex((index) =>
        index === 0 ? filteredApps.length - 1 : index - 1,
      );
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close application launcher" : "Open application launcher"}
        aria-expanded={open}
        onClick={handleTriggerClick}
        className="absolute bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full focus:outline-none"
        style={{
          background: "rgba(28, 34, 44, 0.3)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow:
            "0 12px 28px rgba(2, 6, 14, 0.18), inset 0 1px 0 rgba(255,255,255,0.15)",
          backdropFilter: "blur(18px) saturate(1.12)",
          WebkitBackdropFilter: "blur(18px) saturate(1.12)",
          transition: `transform 140ms ${OPEN_EASE}, background 140ms ${OPEN_EASE}, box-shadow 140ms ${OPEN_EASE}`,
        }}
      >
        <TriggerSearchGlyph />
      </button>

      {open ? (
        <div className="absolute inset-0 z-50">
          <button
            type="button"
            aria-label="Close launcher"
            className="absolute inset-0 h-full w-full cursor-default bg-black/10"
            onClick={closeLauncher}
          />

          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center px-6"
            style={{ top: "19vh" }}
          >
            <div
              className="pointer-events-auto"
              style={{
                width: "min(650px, calc(100vw - 5rem))",
                animation: `windowOpen 0.22s ${OPEN_EASE} forwards`,
              }}
            >
              <div
                className="overflow-hidden px-6"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(27,29,33,0.92) 0%, rgba(22,24,28,0.9) 100%)",
                  border: "1.15px solid rgba(232, 236, 242, 0.28)",
                  boxShadow:
                    "0 1px 1.5px rgba(0,0,0,0.22), 0 14px 30px rgba(0,0,0,0.16), 0 0 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.035), inset 0 -0.5px 0 rgba(0,0,0,0.08)",
                  backdropFilter: "blur(20px) saturate(1.03)",
                  WebkitBackdropFilter: "blur(20px) saturate(1.03)",
                  borderRadius: "29px",
                  paddingTop: showResultsRegion ? "12px" : "12px",
                  paddingBottom: showResultsRegion ? "12px" : "12px",
                  transition: [
                    `padding-top 240ms ${OPEN_EASE}`,
                    `padding-bottom 240ms ${OPEN_EASE}`,
                  ].join(", "),
                }}
              >
                <div
                  className="flex items-center gap-3"
                  style={{
                    paddingBottom: showResultsRegion ? "9px" : "0px",
                    transition: `padding-bottom 240ms ${OPEN_EASE}`,
                  }}
                >
                  <SearchGlyph />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Spotlight Search"
                    className="w-full bg-transparent text-[26.5px] leading-none text-[#d9dde4] outline-none placeholder:text-[#9ea5af]"
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
                      fontWeight: 480,
                      letterSpacing: "-0.038em",
                      caretColor: "#f4f6f8",
                    }}
                  />
                </div>

                <div
                  className="overflow-hidden"
                  style={{
                    display: "grid",
                    gridTemplateRows: showResultsRegion ? "1fr" : "0fr",
                    opacity: showResultsRegion ? 1 : 0,
                    transition: [
                      `grid-template-rows 260ms ${OPEN_EASE}`,
                      `opacity 180ms ease-out`,
                    ].join(", "),
                  }}
                >
                  <div
                    className="min-h-0"
                    style={{
                      transform: showResultsRegion
                        ? "translateY(0)"
                        : "translateY(-10px)",
                      transition: `transform 260ms ${OPEN_EASE}`,
                    }}
                  >
                    <div
                      className="h-px"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(201,206,214,0.12) 14%, rgba(201,206,214,0.12) 86%, rgba(255,255,255,0) 100%)",
                        marginBottom: "11px",
                        opacity: showResultsRegion ? 1 : 0,
                        transition: "opacity 180ms ease-out",
                      }}
                    />

                    {filteredApps.length > 0 ? (
                      filteredApps.map((app, index) => {
                        return (
                          <button
                            key={app.id}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => {
                              setActiveIndex(index);
                              launchApp(app);
                            }}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left focus:outline-none"
                          >
                            <ClaudeAppIcon />
                            <div className="min-w-0 flex-1">
                              <div
                                className="truncate text-[16px] text-[#f0f3f9]"
                                style={{
                                  fontFamily:
                                    '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                                  fontWeight: 600,
                                }}
                              >
                                {app.label}
                              </div>
                              <div
                                className="truncate text-[13px] text-[#a4a9b4]"
                                style={{
                                  fontFamily:
                                    '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                                }}
                              >
                                {app.description}
                              </div>
                            </div>
                            <LauncherStatus status={claudeStatus} />
                          </button>
                        );
                      })
                    ) : (
                      <div
                        className="px-2 py-5 text-center text-[14px] text-[#a4a9b4]"
                        style={{
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                        }}
                      >
                        No applications found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TriggerSearchGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle
        cx="11.5"
        cy="11.5"
        r="6.8"
        stroke="rgba(239, 242, 246, 0.88)"
        strokeWidth="2.5"
      />
      <path
        d="M16.5 16.5 21.7 21.7"
        stroke="rgba(239, 242, 246, 0.88)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle
        cx="11.5"
        cy="11.5"
        r="7.2"
        stroke="#9ea5af"
        strokeWidth="2.45"
      />
      <path
        d="M16.8 16.8 22.2 22.2"
        stroke="#9ea5af"
        strokeWidth="2.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function LauncherStatus({ status }: { status: ClaudeLauncherStatus }) {
  const label =
    status === "open" ? "Open" : status === "minimized" ? "Minimized" : "Closed";

  return (
    <span
      className="rounded-full px-2 py-[3px] text-[11px]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        color: "#c7cad4",
        background: "rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </span>
  );
}
