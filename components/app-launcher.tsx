"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AppDefinition, AppId } from "@/lib/app-registry";
import type { LauncherAppStatus, Rect } from "@/lib/desktop-manager";

interface AppLauncherProps {
  apps: readonly AppDefinition[];
  appStatuses: Record<string, LauncherAppStatus>;
  onLaunchApp: (appId: AppId) => void;
  onTriggerRectChange?: (rect: Rect | null) => void;
}

const OPEN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SPOTLIGHT_ANIMATION_MS = 340;
const SPOTLIGHT_OPEN_SCALE_TIMING =
  "linear(0, 0.0258 2.5%, 0.0933 5%, 0.1892 7.5%, 0.3019 10%, 0.4219 12.5%, 0.5413 15%, 0.6546 17.5%, 0.7575 20%, 0.8476 22.5%, 0.9234 25%, 0.9847 27.5%, 1.032 30%, 1.0663 32.5%, 1.089 35%, 1.1019 37.5%, 1.1067 40%, 1.105 42.5%, 1.0986 45%, 1.0889 47.5%, 1.0771 50%, 1.0644 52.5%, 1.0516 55%, 1.0393 57.5%, 1.028 60%, 1.0181 62.5%, 1.0097 65%, 1.0028 67.5%, 0.9975 70%, 0.9936 72.5%, 0.9909 75%, 0.9893 77.5%, 0.9886 80%, 0.9887 82.5%, 0.9893 85%, 0.9903 87.5%, 0.9915 90%, 0.9928 92.5%, 0.9942 95%, 0.9955 97.5%, 1)";

export function AppLauncher({
  apps,
  appStatuses,
  onLaunchApp,
  onTriggerRectChange,
}: AppLauncherProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const showResultsRegion = normalizedQuery.length > 0;
  const open = isVisible && !isClosing;

  const searchableApps = useMemo(() => {
    return apps.map((app) => ({
      app,
      haystack: [app.label, app.description, ...app.keywords].join(" ").toLowerCase(),
    }));
  }, [apps]);

  const filteredApps = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return searchableApps
      .filter((entry) => entry.haystack.includes(normalizedQuery))
      .map((entry) => entry.app);
  }, [normalizedQuery, searchableApps]);

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

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function resetLauncherState() {
    setIsVisible(false);
    setIsClosing(false);
    setQuery("");
    setActiveIndex(0);
  }

  useLayoutEffect(() => {
    if (!onTriggerRectChange || !triggerRef.current) {
      return;
    }

    const updateRect = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        onTriggerRectChange(null);
        return;
      }

      onTriggerRectChange({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    updateRect();

    const observer = new ResizeObserver(updateRect);
    observer.observe(triggerRef.current);
    window.addEventListener("resize", updateRect);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateRect);
      onTriggerRectChange(null);
    };
  }, [onTriggerRectChange]);

  function closeLauncher(immediate = false) {
    if (!isVisible || isClosing) {
      return;
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (immediate) {
      resetLauncherState();
      return;
    }

    setIsClosing(true);

    closeTimerRef.current = setTimeout(() => {
      resetLauncherState();
      closeTimerRef.current = null;
    }, SPOTLIGHT_ANIMATION_MS);
  }

  function launchApp(app: AppDefinition | undefined) {
    if (!app) {
      return;
    }

    closeLauncher(true);
    onLaunchApp(app.id as AppId);
  }

  function handleTriggerClick() {
    if (open) {
      closeLauncher();
      return;
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsVisible(true);
    setIsClosing(false);
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
        ref={triggerRef}
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
          opacity: isVisible && !isClosing ? 0 : 1,
          transition: `transform 140ms ${OPEN_EASE}, background 140ms ${OPEN_EASE}, box-shadow 140ms ${OPEN_EASE}`,
          animation: isClosing
            ? `spotlightCloseScale ${SPOTLIGHT_ANIMATION_MS}ms ${OPEN_EASE} reverse forwards, spotlightFadeIn ${SPOTLIGHT_ANIMATION_MS}ms ease-out forwards`
            : isVisible
              ? `spotlightOpenScale ${SPOTLIGHT_ANIMATION_MS}ms ${SPOTLIGHT_OPEN_SCALE_TIMING} reverse forwards, spotlightFadeOut ${SPOTLIGHT_ANIMATION_MS}ms ease-out forwards`
              : undefined,
        }}
      >
        <TriggerSearchGlyph />
      </button>

      {isVisible ? (
        <div className="absolute inset-0 z-50">
          <button
            type="button"
            aria-label="Close launcher"
            className="absolute inset-0 h-full w-full cursor-default bg-transparent"
            onClick={() => closeLauncher()}
          />

          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center px-6"
            style={{ top: "19vh" }}
          >
            <div
              className="pointer-events-auto overflow-hidden"
              style={{
                width: "min(643px, calc(100vw - 5rem))",
                background: "rgba(25, 27, 31, 0.76)",
                border: "1.15px solid rgba(232, 236, 242, 0.34)",
                boxShadow:
                  "0 1px 1.5px rgba(0,0,0,0.22), 0 14px 30px rgba(0,0,0,0.16), 0 0 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.035), inset 0 -0.5px 0 rgba(0,0,0,0.08)",
                backdropFilter: "blur(12px) saturate(1.1) brightness(1.03)",
                WebkitBackdropFilter: "blur(12px) saturate(1.1) brightness(1.03)",
                borderRadius: "29px",
                animation: isClosing
                  ? `spotlightCloseScale ${SPOTLIGHT_ANIMATION_MS}ms ${OPEN_EASE} forwards, spotlightFadeOut ${SPOTLIGHT_ANIMATION_MS}ms ease-out forwards`
                  : `spotlightOpenScale ${SPOTLIGHT_ANIMATION_MS}ms ${SPOTLIGHT_OPEN_SCALE_TIMING} forwards, spotlightFadeIn ${SPOTLIGHT_ANIMATION_MS}ms ease-out forwards`,
              }}
            >
              <div
                className="relative px-6"
                style={{
                  paddingTop: "12px",
                  paddingBottom: "12px",
                  transition: [
                    `padding-top 240ms ${OPEN_EASE}`,
                    `padding-bottom 240ms ${OPEN_EASE}`,
                  ].join(", "),
                }}
              >
                <div className="relative z-10">
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
                          const Icon = app.Icon;

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
                              <Icon active={selectedIndex === index} />
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
                              <LauncherStatus
                                status={appStatuses[app.id] ?? "closed"}
                              />
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

function LauncherStatus({ status }: { status: LauncherAppStatus }) {
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
