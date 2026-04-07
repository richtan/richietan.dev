"use client";

const BURST_RAYS = [
  { x1: 0, y1: -15.5, x2: 0, y2: -4.5 },
  { x1: 0, y1: 15.5, x2: 0, y2: 4.5 },
  { x1: -15.5, y1: 0, x2: -4.5, y2: 0 },
  { x1: 15.5, y1: 0, x2: 4.5, y2: 0 },
  { x1: -10.9, y1: -10.9, x2: -3.6, y2: -3.6 },
  { x1: 10.9, y1: 10.9, x2: 3.6, y2: 3.6 },
  { x1: 10.9, y1: -10.9, x2: 3.6, y2: -3.6 },
  { x1: -10.9, y1: 10.9, x2: -3.6, y2: 3.6 },
  { x1: -14.8, y1: -4.2, x2: -4.6, y2: -1.3 },
  { x1: 14.8, y1: 4.2, x2: 4.6, y2: 1.3 },
  { x1: 14.8, y1: -4.2, x2: 4.6, y2: -1.3 },
  { x1: -14.8, y1: 4.2, x2: -4.6, y2: 1.3 },
  { x1: -4.2, y1: -14.8, x2: -1.3, y2: -4.6 },
  { x1: 4.2, y1: 14.8, x2: 1.3, y2: 4.6 },
  { x1: 4.2, y1: -14.8, x2: 1.3, y2: -4.6 },
  { x1: -4.2, y1: 14.8, x2: -1.3, y2: 4.6 },
];

interface ClaudeDesktopIconProps {
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function ClaudeDesktopIcon({
  selected,
  onSelect,
  onOpen,
}: ClaudeDesktopIconProps) {
  return (
    <button
      type="button"
      data-desktop-icon
      aria-label="Claude"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onSelect();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect();
          onOpen();
        }
      }}
      className="absolute left-5 top-4 z-20 flex w-[92px] flex-col items-center gap-[8px] px-2 py-2 focus:outline-none"
    >
      <div className="relative flex h-[74px] w-[74px] items-center justify-center">
        <div
          className="absolute inset-0 rounded-[12px]"
          style={{
            opacity: selected ? 1 : 0,
            background: "rgba(25, 28, 36, 0.52)",
            border: "1px solid rgba(165, 172, 186, 0.5)",
            boxShadow:
              "0 6px 18px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
            backdropFilter: "blur(2px)",
            transition: "opacity 140ms ease-out",
          }}
        />
        <div
          className="relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[15px]"
          style={{
            background: "linear-gradient(180deg, #DD8E67 0%, #D9835B 100%)",
            boxShadow:
              "0 10px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.16)",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="-18 -18 36 36"
            fill="none"
            aria-hidden="true"
          >
            {BURST_RAYS.map((ray, index) => (
              <line
                key={index}
                x1={ray.x1}
                y1={ray.y1}
                x2={ray.x2}
                y2={ray.y2}
                stroke="#FAF7F2"
                strokeWidth="3.9"
                strokeLinecap="round"
              />
            ))}
            <circle cx="0" cy="0" r="3" fill="#FAF7F2" />
          </svg>
        </div>
      </div>

      <span
        className="max-w-full rounded-[7px] px-[6px] py-[1px] text-center text-[12px] leading-[1.25]"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          fontWeight: 600,
          color: "#F7F7FA",
          textShadow: selected ? "none" : "0 1px 2px rgba(0,0,0,0.48)",
          background: selected ? "#2F73F6" : "transparent",
        }}
      >
        Claude
      </span>
    </button>
  );
}
