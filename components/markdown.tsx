"use client";

import { useMemo, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";

type MarkdownProps = {
  content: string;
  streaming?: boolean;
  dimColor?: boolean;
};

type SemanticTone = "text" | "subtle" | "permission" | "suggestion";

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

const EOL = "\n";
const BLOCKQUOTE_BAR = "▎";
const TOKEN_CACHE_MAX = 500;
const ISSUE_REF_PATTERN =
  /(^|[^\w./-])([A-Za-z0-9][\w-]*\/[A-Za-z0-9][\w.-]*)#(\d+)\b/g;
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;
const NEWLINE: Newline = { type: "newline" };
const DEFAULT_STYLE: SegmentStyle = { tone: "text" };
const tokenCache = new Map<string, Token[]>();

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

function stripSystemMessages(content: string) {
  return content
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<system-reminder\s*\/>/g, "")
    .trim();
}

function hasMarkdownSyntax(value: string) {
  return MD_SYNTAX_RE.test(value.length > 500 ? value.slice(0, 500) : value);
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

  const hit = tokenCache.get(content);
  if (hit) {
    tokenCache.delete(content);
    tokenCache.set(content, hit);
    return hit;
  }

  const tokens = marked.lexer(content);
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) {
      tokenCache.delete(firstKey);
    }
  }
  tokenCache.set(content, tokens);
  return tokens;
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
      const previous = target[target.length - 1];
      if (previous?.type === "newline") {
        target.push(piece);
        return;
      }

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

function piecesToPlainText(pieces: Piece[]) {
  return pieces
    .map((piece) => (piece.type === "text" ? piece.text : EOL))
    .join("");
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

function prefixLines(pieces: Piece[], prefix: string) {
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
      appendText(result, prefix);
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
          {
            ...style,
            tone: "suggestion",
          },
          `https://github.com/${repo}/issues/${issueNumber}`,
        );
      } else {
        appendText(pieces, fullMatch, style);
      }

      cursor = start + fullMatch.length;
    }

    appendText(pieces, line.slice(cursor), style);
  });

  return pieces;
}

function numberToLetter(n: number): string {
  let result = "";
  let value = n;

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(97 + (value % 26)) + result;
    value = Math.floor(value / 26);
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

function numberToRoman(n: number) {
  let result = "";
  let value = n;

  for (const [romanValue, numeral] of ROMAN_VALUES) {
    while (value >= romanValue) {
      result += numeral;
      value -= romanValue;
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

function displayWidth(text: string) {
  return Array.from(text).length;
}

function formatTableText(token: Tokens.Table): string {
  const getDisplayText = (tokens: Token[] | undefined) =>
    piecesToPlainText(formatTokens(tokens ?? [])).replace(/\n+$/g, "");

  const columnWidths = token.header.map((header, index) => {
    let maxWidth = displayWidth(getDisplayText(header.tokens));
    for (const row of token.rows) {
      maxWidth = Math.max(maxWidth, displayWidth(getDisplayText(row[index]?.tokens)));
    }
    return Math.max(maxWidth, 3);
  });

  let output = "┌";
  columnWidths.forEach((width, index) => {
    output += "─".repeat(width + 2);
    output += index < columnWidths.length - 1 ? "┬" : "┐";
  });
  output += EOL;

  output += "│ ";
  token.header.forEach((header, index) => {
    const text = getDisplayText(header.tokens);
    output += padAligned(text, displayWidth(text), columnWidths[index]!, "center") + " │ ";
  });
  output = output.trimEnd() + EOL;

  output += "├";
  columnWidths.forEach((width, index) => {
    output += "─".repeat(width + 2);
    output += index < columnWidths.length - 1 ? "┼" : "┤";
  });
  output += EOL;

  token.rows.forEach((row) => {
    output += "│ ";
    row.forEach((cell, index) => {
      const text = getDisplayText(cell.tokens);
      output +=
        padAligned(
          text,
          displayWidth(text),
          columnWidths[index]!,
          token.align?.[index],
        ) + " │ ";
    });
    output = output.trimEnd() + EOL;
  });

  output += "└";
  columnWidths.forEach((width, index) => {
    output += "─".repeat(width + 2);
    output += index < columnWidths.length - 1 ? "┴" : "┘";
  });

  return output;
}

function prefixBlockquote(pieces: Piece[]) {
  const result: Piece[] = [];
  const lines = splitPiecesIntoLines(pieces);

  lines.forEach((line, index) => {
    if (index > 0) {
      result.push(NEWLINE);
    }

    const visible = piecesToPlainText(line).trim();
    if (!visible) {
      return;
    }

    appendText(result, BLOCKQUOTE_BAR, { tone: "subtle", dim: true });
    appendText(result, " ", { tone: "subtle", dim: true });
    appendPieces(result, applyStyle(line, { italic: true }));
  });

  return result;
}

function formatInlineTokens(
  tokens: Token[],
  parent: Token | null,
  listDepth = 0,
  orderedListNumber: number | null = null,
) {
  const pieces: Piece[] = [];

  tokens.forEach((token) => {
    appendPieces(
      pieces,
      formatToken(token, listDepth, orderedListNumber, parent),
    );
  });

  return pieces;
}

function formatToken(
  token: Token,
  listDepth = 0,
  orderedListNumber: number | null = null,
  parent: Token | null = null,
): Piece[] {
  switch (token.type) {
    case "blockquote": {
      const inner = formatInlineTokens(token.tokens ?? [], null);
      return prefixBlockquote(inner);
    }

    case "code":
      return [...renderTextRuns(token.text), NEWLINE];

    case "codespan":
      return renderTextRuns(token.text, { tone: "permission" });

    case "em":
      return applyStyle(
        formatInlineTokens(token.tokens ?? [], parent, listDepth, orderedListNumber),
        { italic: true },
      );

    case "strong":
      return applyStyle(
        formatInlineTokens(token.tokens ?? [], parent, listDepth, orderedListNumber),
        { bold: true },
      );

    case "heading": {
      const headingPieces = formatInlineTokens(token.tokens ?? [], null);
      const styled = applyStyle(
        headingPieces,
        token.depth === 1
          ? { bold: true, italic: true, underline: true }
          : { bold: true },
      );
      return [...styled, NEWLINE, NEWLINE];
    }

    case "hr":
      return renderTextRuns("---");

    case "image":
      return renderTextRuns(token.href ?? "");

    case "link": {
      if (token.href.startsWith("mailto:")) {
        return renderTextRuns(token.href.replace(/^mailto:/, ""));
      }

      const linkPieces = formatInlineTokens(token.tokens ?? [], token);
      const plainLinkText = piecesToPlainText(linkPieces);

      if (plainLinkText && plainLinkText !== token.href) {
        return wrapLinkPieces(linkPieces, token.href);
      }

      return [
        {
          type: "text",
          text: token.href,
          href: token.href,
          style: {
            tone: "suggestion",
          },
        },
      ];
    }

    case "list":
      return token.items.flatMap((item: Token, index: number) =>
        formatToken(
          item,
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
      return [...formatInlineTokens(token.tokens ?? [], null), NEWLINE];

    case "space":
    case "br":
      return [NEWLINE];

    case "text":
      if (parent?.type === "link") {
        return renderTextRuns(token.text);
      }

      if (parent?.type === "list_item") {
        const content = token.tokens?.length
          ? formatInlineTokens(token.tokens, token, listDepth, orderedListNumber)
          : renderTextRuns(token.text);

        return [
          ...renderTextRuns(
            `${orderedListNumber === null ? "-" : `${getListNumber(listDepth, orderedListNumber)}.`} `,
          ),
          ...content,
          NEWLINE,
        ];
      }

      return token.tokens?.length
        ? formatInlineTokens(token.tokens, token, listDepth, orderedListNumber)
        : renderTextRuns(token.text);

    case "table":
      return [...renderTextRuns(formatTableText(token as Tokens.Table)), NEWLINE];

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

function formatTokens(tokens: Token[]) {
  const pieces: Piece[] = [];

  tokens.forEach((token) => {
    appendPieces(pieces, formatToken(token));
  });

  while (pieces[pieces.length - 1]?.type === "newline") {
    pieces.pop();
  }

  return pieces;
}

function pieceClassName(piece: Segment, dimColor: boolean) {
  const classes = [];
  const tone = piece.href ? "suggestion" : piece.style.tone ?? "text";

  if (tone === "suggestion") {
    classes.push("text-cc-suggestion");
  } else if (tone === "permission") {
    classes.push("text-cc-permission");
  } else if (tone === "subtle") {
    classes.push("text-cc-secondary");
  } else {
    classes.push("text-cc-text");
  }

  if (piece.style.bold) {
    classes.push("font-bold");
  }
  if (piece.style.italic) {
    classes.push("italic");
  }
  if (piece.style.underline) {
    classes.push("underline decoration-current underline-offset-2");
  }
  if (piece.style.dim || dimColor) {
    classes.push("opacity-75");
  }
  if (piece.href) {
    classes.push("hover:underline");
  }

  return classes.join(" ");
}

function renderPieces(pieces: Piece[], dimColor = false) {
  return pieces.map((piece, index) => {
    if (piece.type === "newline") {
      return <br key={`newline-${index}`} />;
    }

    if (piece.href) {
      return (
        <a
          key={`piece-${index}`}
          href={piece.href}
          rel="noreferrer"
          target="_blank"
          className={pieceClassName(piece, dimColor)}
        >
          {piece.text}
        </a>
      );
    }

    return (
      <span key={`piece-${index}`} className={pieceClassName(piece, dimColor)}>
        {piece.text}
      </span>
    );
  });
}

function flushNonTablePieces(
  elements: ReactNode[],
  pieces: Piece[],
  dimColor: boolean,
) {
  if (pieces.length === 0) {
    return [];
  }

  elements.push(
    <div key={`markdown-block-${elements.length}`}>
      {renderPieces(pieces, dimColor)}
    </div>,
  );

  return [];
}

function MarkdownTable({ token }: { token: Tokens.Table }) {
  const text = useMemo(() => formatTableText(token), [token]);
  return <pre className="m-0 whitespace-pre-wrap break-words">{text}</pre>;
}

function MarkdownBody({
  content,
  dimColor = false,
}: {
  content: string;
  dimColor?: boolean;
}) {
  const elements = useMemo(() => {
    configureMarked();
    const tokens = cachedLexer(stripSystemMessages(content));
    const nextElements: ReactNode[] = [];
    let nonTablePieces: Piece[] = [];

    tokens.forEach((token, index) => {
      if (token.type === "table") {
        nonTablePieces = flushNonTablePieces(nextElements, nonTablePieces, dimColor);
        nextElements.push(
          <MarkdownTable
            key={`markdown-table-${index}`}
            token={token as Tokens.Table}
          />,
        );
        return;
      }

      appendPieces(nonTablePieces, formatToken(token));
    });

    flushNonTablePieces(nextElements, nonTablePieces, dimColor);
    return nextElements;
  }, [content, dimColor]);

  return <>{elements}</>;
}

function StreamingMarkdown({
  content,
  dimColor = false,
}: {
  content: string;
  dimColor?: boolean;
}) {
  configureMarked();

  const stripped = stripSystemMessages(content);
  const tokens = marked.lexer(stripped);

  let lastContentIndex = tokens.length - 1;
  while (lastContentIndex >= 0 && tokens[lastContentIndex]!.type === "space") {
    lastContentIndex -= 1;
  }

  let advance = 0;
  for (let index = 0; index < lastContentIndex; index += 1) {
    advance += tokens[index]!.raw.length;
  }

  const stablePrefix = stripped.substring(0, advance);
  const unstableSuffix = stripped.substring(stablePrefix.length);

  return (
    <div className="flex flex-col gap-[1.2em]">
      {stablePrefix ? (
        <MarkdownBody content={stablePrefix} dimColor={dimColor} />
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
  return (
    <div className="m-0 min-w-0 max-w-full whitespace-pre-wrap break-words text-cc-text">
      {streaming ? (
        <StreamingMarkdown content={content} dimColor={dimColor} />
      ) : (
        <MarkdownBody content={content} dimColor={dimColor} />
      )}
    </div>
  );
}
