import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  PROMPT_PLACEHOLDER,
  TERMINAL_WINDOW_TITLE,
  WELCOME_NAME,
  WELCOME_ROLE,
} from "@/lib/constants";

export const alt = `${WELCOME_NAME} — ${WELCOME_ROLE}. A Claude Code-inspired personal website.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  claude: "rgb(215, 119, 87)",
  text: "rgb(248, 248, 248)",
  secondary: "rgb(153, 153, 153)",
  border: "rgb(136, 136, 136)",
  userMessage: "rgb(55, 55, 55)",
  titleBar: "#323232",
  titleText: "#EBEBEB",
};

const BACKGROUND =
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 52%, #0f3460 100%)";

const TRAFFIC_LIGHTS = ["#FF5F57", "#FEBC2E", "#28C840"];

function Clawd() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        color: COLORS.claude,
        fontSize: 44,
        lineHeight: 1,
        whiteSpace: "pre",
      }}
    >
      <div style={{ display: "flex" }}>
        <span> ▐</span>
        <span style={{ background: "black" }}>▛███▜</span>
        <span>▌</span>
      </div>
      <div style={{ display: "flex" }}>
        <span>▝▜</span>
        <span style={{ background: "black" }}>█████</span>
        <span>▛▘</span>
      </div>
      <div style={{ display: "flex" }}>{"  ▘▘ ▝▝  "}</div>
    </div>
  );
}

function PromptBorder() {
  return <div style={{ display: "flex", height: 2, background: COLORS.border }} />;
}

export default async function Image() {
  const fontDir = join(process.cwd(), "app/fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(fontDir, "HackNerdFontMono-Regular.ttf")),
    readFile(join(fontDir, "HackNerdFontMono-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BACKGROUND,
          fontFamily: "Hack",
        }}
      >
        <div
          style={{
            width: 1080,
            height: 530,
            display: "flex",
            flexDirection: "column",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              position: "relative",
              padding: "0 20px",
              background: COLORS.titleBar,
            }}
          >
            <div style={{ display: "flex", gap: 13 }}>
              {TRAFFIC_LIGHTS.map((color) => (
                <div
                  key={color}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: color,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                fontSize: 20,
                color: COLORS.titleText,
              }}
            >
              {TERMINAL_WINDOW_TITLE}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "40px 44px 36px",
              background: "black",
              fontSize: 30,
              color: COLORS.text,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <Clawd />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1 }}>
                  {WELCOME_NAME}
                </div>
                <div style={{ fontSize: 34, color: COLORS.secondary }}>
                  {WELCOME_ROLE}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 40,
                padding: "8px 14px",
                background: COLORS.userMessage,
                whiteSpace: "pre",
              }}
            >
              {"❯ who is richie?"}
            </div>

            <div style={{ display: "flex", marginTop: 18, padding: "0 14px" }}>
              <span style={{ width: 36 }}>●</span>
              <span>CS @ Purdue (Dec 2026), based in Los Gatos, CA.</span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: "auto",
              }}
            >
              <PromptBorder />
              <div style={{ display: "flex", padding: "0 14px", whiteSpace: "pre" }}>
                <span>{"❯ "}</span>
                <span style={{ color: COLORS.secondary }}>{PROMPT_PLACEHOLDER}</span>
              </div>
              <PromptBorder />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Hack", data: regular, style: "normal", weight: 400 },
        { name: "Hack", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
