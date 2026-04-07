"use client";

import hljs from "highlight.js";
import { Fragment, useMemo } from "react";
import { marked, type Token, type Tokens } from "marked";

type MarkdownProps = {
  content: string;
  streaming?: boolean;
  dimColor?: boolean;
};

type SemanticTone =
  | "text"
  | "subtle"
  | "permission"
  | "suggestion"
  | "success"
  | "error"
  | "warning";

type SegmentStyle = {
  tone?: SemanticTone;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
};

type Segment = {
  type: "text";
  text: string;
  style: SegmentStyle;
  href?: string;
};

type Newline = {
  type: "newline";
};

type Piece = Segment | Newline;

type RenderBlock =
  | {
      type: "segments";
      pieces: Piece[];
    }
  | {
      type: "code";
      html: string;
    }
  | {
      type: "table";
      token: Tokens.Table;
    };

const EOL = "\n";
const BLOCKQUOTE_BAR = "▎";
const TOKEN_CACHE_MAX = 500;
const ISSUE_REF_PATTERN =
  /(^|[^\w./-])([A-Za-z0-9][\w-]*\/[A-Za-z0-9][\w.-]*)#(\d+)\b/g;
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;
const NEWLINE: Newline = { type: "newline" };
const DEFAULT_STYLE: SegmentStyle = { tone: "text" };
const tokenCache = new Map<string, Token[]>();
const streamingPrefixCache = new Map<string, string>();

let markedConfigured = false;

function configureMarked() {
  if (markedConfigured) {
    return;
  }

  markedConfigured = true;
  marked.use({
    tokenizer: {
      del() {
        return undefined;
      },
    },
  });
}

function stripPromptXMLTags(content: string) {
  return content
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<system-reminder\s*\/>/g, "")
    .trim();
}

function hasMarkdownSyntax(value: string) {
  return MD_SYNTAX_RE.test(value.length > 500 ? value.slice(0, 500) : value);
}

function hashContent(content: string) {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 33) ^ content.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function cacheStreamingPrefix(content: string, stablePrefix: string) {
  const key = hashContent(content);
  if (streamingPrefixCache.size >= TOKEN_CACHE_MAX) {
    const firstKey = streamingPrefixCache.keys().next().value;
    if (firstKey !== undefined) {
      streamingPrefixCache.delete(firstKey);
    }
  }
  streamingPrefixCache.set(key, stablePrefix);
}

function getCachedStreamingPrefix(content: string) {
  let best = "";

  for (const stablePrefix of streamingPrefixCache.values()) {
    if (!stablePrefix || stablePrefix.length <= best.length) {
      continue;
    }

    if (!content.startsWith(stablePrefix)) {
      continue;
    }

    best = stablePrefix;
  }

  return best;
}

function cachedLexer(content: string) {
  if (!hasMarkdownSyntax(content)) {
    return [
      {
        type: "paragraph",
        raw: content,
        text: content,
        tokens: [
          {
            type: "text",
            raw: content,
            text: content,
          },
        ],
      } satisfies Token,
    ];
  }

  const key = hashContent(content);
  const hit = tokenCache.get(key);
  if (hit) {
    tokenCache.delete(key);
    tokenCache.set(key, hit);
    return hit;
  }

  const tokens = marked.lexer(content);
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) {
      tokenCache.delete(firstKey);
    }
  }
  tokenCache.set(key, tokens);
  return tokens;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringWidth(text: string) {
  return Array.from(text).length;
}

function stylesEqual(a: SegmentStyle, b: SegmentStyle) {
  return (
    a.tone === b.tone &&
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.dim) === Boolean(b.dim)
  );
}

function appendText(
  target: Piece[],
  text: string,
  style: SegmentStyle = DEFAULT_STYLE,
  href?: string,
) {
  if (!text) {
    return;
  }

  const nextStyle = { ...DEFAULT_STYLE, ...style };
  const previous = target[target.length - 1];

  if (
    previous?.type === "text" &&
    previous.href === href &&
    stylesEqual(previous.style, nextStyle)
  ) {
    previous.text += text;
    return;
  }

  target.push({
    type: "text",
    text,
    style: nextStyle,
    href,
  });
}

function appendPieces(target: Piece[], pieces: Piece[]) {
  pieces.forEach((piece) => {
    if (piece.type === "newline") {
      target.push(piece);
      return;
    }

    appendText(target, piece.text, piece.style, piece.href);
  });
}

function applyStyle(pieces: Piece[], patch: SegmentStyle): Piece[] {
  return pieces.map((piece) =>
    piece.type === "text"
      ? {
          ...piece,
          style: {
            ...piece.style,
            ...patch,
          },
        }
      : piece,
  );
}

function splitPiecesIntoLines(pieces: Piece[]) {
  const lines: Piece[][] = [[]];

  pieces.forEach((piece) => {
    if (piece.type === "newline") {
      lines.push([]);
      return;
    }

    lines[lines.length - 1]!.push(piece);
  });

  return lines;
}

function prefixLines(pieces: Piece[], prefix: string, style: SegmentStyle = DEFAULT_STYLE) {
  if (!prefix) {
    return pieces;
  }

  const result: Piece[] = [];
  const lines = splitPiecesIntoLines(pieces);

  lines.forEach((line, index) => {
    if (index > 0) {
      result.push(NEWLINE);
    }

    if (line.length > 0) {
      appendText(result, prefix, style);
    }

    appendPieces(result, line);
  });

  return result;
}

function wrapLinkPieces(pieces: Piece[], href: string) {
  return pieces.map((piece) =>
    piece.type === "text"
      ? {
          ...piece,
          href,
          style: {
            ...piece.style,
            tone: "suggestion" as const,
          },
        }
      : piece,
  );
}

function renderTextRuns(text: string, style: SegmentStyle = DEFAULT_STYLE): Piece[] {
  const pieces: Piece[] = [];
  const lines = text.split(EOL);

  lines.forEach((line, index) => {
    if (index > 0) {
      pieces.push(NEWLINE);
    }

    let cursor = 0;
    for (const match of line.matchAll(ISSUE_REF_PATTERN)) {
      const fullMatch = match[0];
      const prefix = match[1] ?? "";
      const repo = match[2];
      const issueNumber = match[3];
      const start = match.index ?? 0;

      appendText(pieces, line.slice(cursor, start), style);
      appendText(pieces, prefix, style);

      if (repo && issueNumber) {
        appendText(
          pieces,
          `${repo}#${issueNumber}`,
          { ...style, tone: "suggestion" },
          `https://github.com/${repo}/issues/${issueNumber}`,
        );
      } else {
        appendText(pieces, fullMatch.slice(prefix.length), style);
      }

      cursor = start + fullMatch.length;
    }

    appendText(pieces, line.slice(cursor), style);
  });

  return pieces;
}

function numberToLetter(n: number): string {
  let result = "";
  let current = n;
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(97 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
}

const ROMAN_VALUES: ReadonlyArray<[number, string]> = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

function numberToRoman(n: number): string {
  let result = "";
  let current = n;

  for (const [value, numeral] of ROMAN_VALUES) {
    while (current >= value) {
      result += numeral;
      current -= value;
    }
  }

  return result;
}

function getListNumber(listDepth: number, orderedListNumber: number): string {
  switch (listDepth) {
    case 0:
    case 1:
      return orderedListNumber.toString();
    case 2:
      return numberToLetter(orderedListNumber);
    case 3:
      return numberToRoman(orderedListNumber);
    default:
      return orderedListNumber.toString();
  }
}

function piecesToPlainText(pieces: Piece[]) {
  return pieces
    .map((piece) => (piece.type === "text" ? piece.text : EOL))
    .join("");
}

function formatToken(
  token: Token,
  listDepth = 0,
  orderedListNumber: number | null = null,
  parent: Token | null = null,
): Piece[] {
  switch (token.type) {
    case "blockquote": {
      const inner = (token.tokens ?? [])
        .flatMap((child) => formatToken(child, 0, null, null));
      const prefixed = prefixLines(inner, `${BLOCKQUOTE_BAR} `, {
        tone: "subtle",
      });
      return applyStyle(prefixed, { italic: true });
    }

    case "codespan":
      return renderTextRuns(token.text, { tone: "permission" });

    case "em":
      return applyStyle(
        (token.tokens ?? []).flatMap((child) =>
          formatToken(child, listDepth, orderedListNumber, parent),
        ),
        { italic: true },
      );

    case "strong":
      return applyStyle(
        (token.tokens ?? []).flatMap((child) =>
          formatToken(child, listDepth, orderedListNumber, parent),
        ),
        { bold: true },
      );

    case "heading":
      return [
        ...applyStyle(
          (token.tokens ?? []).flatMap((child) => formatToken(child, 0, null, null)),
          {
            bold: true,
            italic: token.depth === 1,
            underline: token.depth === 1,
          },
        ),
        NEWLINE,
        NEWLINE,
      ];

    case "hr":
      return [...renderTextRuns("---"), NEWLINE];

    case "image":
      return renderTextRuns(token.href, { tone: "suggestion" });

    case "link": {
      if (token.href.startsWith("mailto:")) {
        return renderTextRuns(token.href.replace(/^mailto:/, ""));
      }

      const linkPieces = (token.tokens ?? []).flatMap((child) =>
        formatToken(child, listDepth, orderedListNumber, token),
      );
      const linkText = piecesToPlainText(linkPieces);

      if (linkText && linkText !== token.href) {
        return wrapLinkPieces(linkPieces, token.href);
      }

      return [
        {
          type: "text",
          text: token.href,
          href: token.href,
          style: { tone: "suggestion" },
        },
      ];
    }

    case "list":
      return token.items.flatMap((child: Token, index: number) =>
        formatToken(
          child,
          listDepth,
          token.ordered ? token.start + index : null,
          token,
        ),
      );

    case "list_item":
      return (token.tokens ?? []).flatMap((child) =>
        prefixLines(
          formatToken(child, listDepth + 1, orderedListNumber, token),
          "  ".repeat(listDepth),
        ),
      );

    case "paragraph":
      return [
        ...(token.tokens ?? []).flatMap((child) =>
          formatToken(child, 0, null, null),
        ),
        NEWLINE,
      ];

    case "space":
    case "br":
      return [NEWLINE];

    case "text":
      if (parent?.type === "link") {
        return renderTextRuns(token.text);
      }

      if (parent?.type === "list_item") {
        const prefix =
          orderedListNumber === null
            ? "- "
            : `${getListNumber(listDepth, orderedListNumber)}. `;
        return [
          ...renderTextRuns(
            `${prefix}${
              token.tokens
                ? piecesToPlainText(
                    token.tokens.flatMap((child) =>
                      formatToken(child, listDepth, orderedListNumber, token),
                    ),
                  )
                : token.text
            }`,
          ),
          NEWLINE,
        ];
      }

      if (token.tokens) {
        return token.tokens.flatMap((child) =>
          formatToken(child, listDepth, orderedListNumber, token),
        );
      }

      return renderTextRuns(token.text);

    case "escape":
      return renderTextRuns(token.text);

    case "def":
    case "del":
    case "html":
      return [];

    default:
      return [];
  }
}

function trimPieces(pieces: Piece[]) {
  const next = pieces
    .map((piece) =>
      piece.type === "text"
        ? {
            ...piece,
            text: piece.text,
          }
        : piece,
    )
    .filter((piece) => piece.type === "newline" || piece.text.length > 0);

  while (next[0]?.type === "newline") {
    next.shift();
  }

  while (next[next.length - 1]?.type === "newline") {
    next.pop();
  }

  const first = next[0];
  if (first?.type === "text") {
    first.text = first.text.trimStart();
  }

  const last = next[next.length - 1];
  if (last?.type === "text") {
    last.text = last.text.trimEnd();
  }

  return next.filter((piece) => piece.type === "newline" || piece.text.length > 0);
}

function padAligned(
  content: string,
  displayWidth: number,
  targetWidth: number,
  align: "left" | "center" | "right" | null | undefined,
) {
  const padding = Math.max(0, targetWidth - displayWidth);
  if (align === "center") {
    const leftPad = Math.floor(padding / 2);
    return " ".repeat(leftPad) + content + " ".repeat(padding - leftPad);
  }
  if (align === "right") {
    return " ".repeat(padding) + content;
  }
  return content + " ".repeat(padding);
}

function getCellText(tokens: Token[] | undefined) {
  return piecesToPlainText(
    (tokens ?? []).flatMap((token) => formatToken(token, 0, null, null)),
  );
}

function formatTableText(token: Tokens.Table) {
  const columnWidths = token.header.map((header, index) => {
    let maxWidth = stringWidth(getCellText(header.tokens));
    for (const row of token.rows) {
      maxWidth = Math.max(maxWidth, stringWidth(getCellText(row[index]?.tokens)));
    }
    return Math.max(maxWidth, 3);
  });

  let output = "| ";
  token.header.forEach((header, index) => {
    const content = getCellText(header.tokens);
    output +=
      padAligned(
        content,
        stringWidth(content),
        columnWidths[index]!,
        token.align?.[index],
      ) + " | ";
  });
  output = output.trimEnd() + EOL;

  output += "|";
  columnWidths.forEach((width) => {
    output += `${"-".repeat(width + 2)}|`;
  });
  output += EOL;

  token.rows.forEach((row) => {
    output += "| ";
    row.forEach((cell, index) => {
      const content = getCellText(cell.tokens);
      output +=
        padAligned(
          content,
          stringWidth(content),
          columnWidths[index]!,
          token.align?.[index],
        ) + " | ";
    });
    output = output.trimEnd() + EOL;
  });

  return output.trimEnd();
}

function createCodeMarkup(text: string, language?: string) {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(text, { language }).value;
  }

  return escapeHtml(text);
}

function buildBlocks(content: string): RenderBlock[] {
  configureMarked();

  const tokens = cachedLexer(stripPromptXMLTags(content));
  const blocks: RenderBlock[] = [];
  let currentPieces: Piece[] = [];

  const flushPieces = () => {
    const trimmed = trimPieces(currentPieces);
    currentPieces = [];

    if (trimmed.length > 0) {
      blocks.push({ type: "segments", pieces: trimmed });
    }
  };

  for (const token of tokens) {
    if (token.type === "table") {
      flushPieces();
      blocks.push({ type: "table", token: token as Tokens.Table });
      continue;
    }

    if (token.type === "code") {
      flushPieces();
      blocks.push({
        type: "code",
        html: createCodeMarkup(token.text, token.lang ?? undefined),
      });
      continue;
    }

    appendPieces(currentPieces, formatToken(token));
  }

  flushPieces();
  return blocks;
}

function toneClass(tone: SemanticTone | undefined) {
  switch (tone) {
    case "subtle":
      return "text-cc-secondary";
    case "permission":
      return "text-cc-permission";
    case "suggestion":
      return "text-cc-suggestion";
    case "success":
      return "text-cc-success";
    case "error":
      return "text-cc-error";
    case "warning":
      return "text-cc-warning";
    default:
      return "text-cc-text";
  }
}

function pieceClassName(style: SegmentStyle, dimColor: boolean) {
  return [
    toneClass(style.tone),
    style.bold ? "font-semibold" : "",
    style.italic ? "italic" : "",
    style.underline ? "underline underline-offset-2" : "",
    style.dim || dimColor ? "opacity-[0.85]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderPieceBlock(pieces: Piece[], dimColor: boolean) {
  let key = 0;

  return (
    <div className="m-0 min-w-0 whitespace-pre-wrap break-words">
      {pieces.map((piece) => {
        if (piece.type === "newline") {
          key += 1;
          return <br key={`br-${key}`} />;
        }

        key += 1;
        const className = pieceClassName(piece.style, dimColor);

        if (piece.href) {
          return (
            <a
              key={`seg-${key}`}
              href={piece.href}
              target="_blank"
              rel="noreferrer"
              className={className}
            >
              {piece.text}
            </a>
          );
        }

        return (
          <span key={`seg-${key}`} className={className}>
            {piece.text}
          </span>
        );
      })}
    </div>
  );
}

function MarkdownCodeBlock({ html }: { html: string }) {
  return (
    <pre className="cc-code-block m-0 min-w-0 whitespace-pre-wrap break-words">
      <code
        className="hljs bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}

function MarkdownTableBlock({ token }: { token: Tokens.Table }) {
  return (
    <pre className="m-0 min-w-0 whitespace-pre-wrap break-words">
      {formatTableText(token)}
    </pre>
  );
}

function MarkdownBody({
  content,
  dimColor = false,
}: {
  content: string;
  dimColor?: boolean;
}) {
  const blocks = useMemo(() => buildBlocks(content), [content]);

  return (
    <div className="flex min-w-0 flex-col gap-[1.2em]">
      {blocks.map((block, index) => {
        if (block.type === "segments") {
          return <Fragment key={`segments-${index}`}>{renderPieceBlock(block.pieces, dimColor)}</Fragment>;
        }

        if (block.type === "code") {
          return <MarkdownCodeBlock key={`code-${index}`} html={block.html} />;
        }

        return <MarkdownTableBlock key={`table-${index}`} token={block.token} />;
      })}
    </div>
  );
}

function StreamingMarkdown({
  content,
  dimColor = false,
}: {
  content: string;
  dimColor?: boolean;
}) {
  configureMarked();

  const stripped = stripPromptXMLTags(content);
  const effectiveStablePrefix = useMemo(() => {
    let stablePrefix = getCachedStreamingPrefix(stripped);
    const boundary = stablePrefix.length;
    const tokens = marked.lexer(stripped.substring(boundary));

    let lastContentIdx = tokens.length - 1;
    while (lastContentIdx >= 0 && tokens[lastContentIdx]!.type === "space") {
      lastContentIdx -= 1;
    }

    let advance = 0;
    for (let index = 0; index < lastContentIdx; index += 1) {
      advance += tokens[index]!.raw.length;
    }

    if (advance > 0) {
      stablePrefix = stripped.substring(0, boundary + advance);
    }

    cacheStreamingPrefix(stripped, stablePrefix);
    return stablePrefix;
  }, [stripped]);
  const unstableSuffix = stripped.substring(effectiveStablePrefix.length);

  return (
    <div className="flex min-w-0 flex-col gap-[1.2em]">
      {effectiveStablePrefix ? (
        <MarkdownBody content={effectiveStablePrefix} dimColor={dimColor} />
      ) : null}
      {unstableSuffix ? (
        <MarkdownBody content={unstableSuffix} dimColor={dimColor} />
      ) : null}
    </div>
  );
}

export function Markdown({
  content,
  streaming = false,
  dimColor = false,
}: MarkdownProps) {
  return streaming ? (
    <StreamingMarkdown content={content} dimColor={dimColor} />
  ) : (
    <MarkdownBody content={content} dimColor={dimColor} />
  );
}
