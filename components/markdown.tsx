import type { ReactNode } from "react";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

type MarkdownProps = {
  content: string;
};

type MarkdownNode = {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  title?: string | null;
  alt?: string;
  ordered?: boolean;
  start?: number;
  children?: MarkdownNode[];
};

type RenderContext = {
  key: () => string;
};

type BlockKind =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "list"
  | "thematic-break"
  | "code"
  | "table"
  | "html"
  | "other";

type RenderedBlock = {
  kind: BlockKind;
  content: ReactNode[];
};

const DEPTH_1_LIST_NUMBERS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "aa",
  "ab",
  "ac",
  "ad",
  "ae",
  "af",
  "ag",
  "ah",
  "ai",
  "aj",
  "ak",
  "al",
  "am",
  "an",
  "ao",
  "ap",
  "aq",
  "ar",
  "as",
  "at",
  "au",
  "av",
  "aw",
  "ax",
  "ay",
  "az",
];

const DEPTH_2_LIST_NUMBERS = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx",
  "xxi",
  "xxii",
  "xxiii",
  "xxiv",
  "xxv",
  "xxvi",
  "xxvii",
  "xxviii",
  "xxix",
  "xxx",
  "xxxi",
  "xxxii",
  "xxxiii",
  "xxxiv",
  "xxxv",
  "xxxvi",
  "xxxvii",
  "xxxviii",
  "xxxix",
  "xl",
];

function stripSystemMessages(content: string) {
  return content
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<system-reminder\s*\/>/g, "")
    .trim();
}

function getListNumber(listDepth: number, orderedListNumber: number): string {
  switch (listDepth) {
    case 0:
    case 1:
      return orderedListNumber.toString();
    case 2:
      return DEPTH_1_LIST_NUMBERS[orderedListNumber - 1] ?? orderedListNumber.toString();
    case 3:
      return DEPTH_2_LIST_NUMBERS[orderedListNumber - 1] ?? orderedListNumber.toString();
    default:
      return orderedListNumber.toString();
  }
}

function trimTrailingNewlines(parts: ReactNode[]) {
  while (typeof parts[parts.length - 1] === "string") {
    const value = parts[parts.length - 1] as string;
    if (!value.endsWith("\n")) {
      break;
    }

    const nextValue = value.replace(/\n+$/g, "");
    if (nextValue) {
      parts[parts.length - 1] = nextValue;
      break;
    }

    parts.pop();
  }
}

function trimTrailingNewlinesCopy(parts: ReactNode[]) {
  const next = [...parts];
  trimTrailingNewlines(next);
  return next;
}

function renderInline(nodes: MarkdownNode[] | undefined, context: RenderContext): ReactNode[] {
  if (!nodes?.length) {
    return [];
  }

  return nodes.flatMap((node) => {
    switch (node.type) {
      case "text":
        return node.value ?? "";
      case "strong":
        return (
          <strong key={context.key()} className="font-bold text-cc-text">
            {renderInline(node.children, context)}
          </strong>
        );
      case "emphasis":
        return (
          <em key={context.key()} className="italic text-cc-text">
            {renderInline(node.children, context)}
          </em>
        );
      case "delete":
        return (
          <del key={context.key()} className="line-through text-cc-secondary">
            {renderInline(node.children, context)}
          </del>
        );
      case "inlineCode":
        return (
          <code key={context.key()} className="text-cc-suggestion">
            {node.value ?? ""}
          </code>
        );
      case "link":
        return (
          <a
            key={context.key()}
            className="text-cc-suggestion underline decoration-current underline-offset-2"
            href={node.url}
            rel="noreferrer"
            target="_blank"
          >
            {node.url ?? renderPlainText(node.children)}
          </a>
        );
      case "image":
        return `[Image: ${node.title ?? node.alt ?? ""}: ${node.url ?? ""}]`;
      case "break":
        return "\n";
      default:
        return renderInline(node.children, context);
    }
  });
}

function renderPlainText(nodes: MarkdownNode[] | undefined): string {
  if (!nodes?.length) {
    return "";
  }

  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "inlineCode":
          return node.value ?? "";
        case "link":
          return node.url ?? renderPlainText(node.children);
        case "image":
          return `[Image: ${node.title ?? node.alt ?? ""}: ${node.url ?? ""}]`;
        case "break":
          return "\n";
        default:
          return renderPlainText(node.children);
      }
    })
    .join("");
}

function formatAsciiTable(node: MarkdownNode): string {
  const rows = (node.children ?? []).map((row) =>
    (row.children ?? []).map((cell) => renderPlainText(cell.children).trim()),
  );

  if (!rows.length) {
    return "";
  }

  const widths = rows.reduce<number[]>((current, row) => {
    row.forEach((cell, index) => {
      current[index] = Math.max(current[index] ?? 0, cell.length);
    });
    return current;
  }, []);

  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const formatRow = (row: string[]) =>
    `|${row
      .map((cell, index) => ` ${cell.padEnd(widths[index] ?? cell.length)} `)
      .join("|")}|`;

  return [border, formatRow(rows[0] ?? []), border, ...rows.slice(1).map(formatRow), border].join(
    "\n",
  );
}

function renderListItem(
  node: MarkdownNode,
  context: RenderContext,
  listDepth: number,
  orderedListNumber: number | null,
): ReactNode[] {
  const indent = "  ".repeat(listDepth);
  const prefix =
    orderedListNumber === null
      ? "- "
      : `${getListNumber(listDepth + 1, orderedListNumber)}. `;
  const lines: ReactNode[] = [];
  let emittedMainLine = false;

  for (const child of node.children ?? []) {
    if (child.type === "paragraph") {
      lines.push(
        indent,
        emittedMainLine ? "  " : prefix,
        ...renderInline(child.children, context),
        "\n",
      );
      emittedMainLine = true;
      continue;
    }

    if (child.type === "list") {
      lines.push(...renderList(child, context, listDepth + 1));
      continue;
    }

    if (child.type === "code") {
      lines.push(indent, emittedMainLine ? "  " : prefix, child.value ?? "", "\n");
      emittedMainLine = true;
      continue;
    }

    const renderedChild = trimTrailingNewlinesCopy(
      renderBlock(child, context).flatMap((block) => block.content),
    );
    lines.push(indent, emittedMainLine ? "  " : prefix, ...renderedChild, "\n");
    emittedMainLine = true;
  }

  return lines;
}

function renderList(node: MarkdownNode, context: RenderContext, listDepth: number): ReactNode[] {
  const start = node.start ?? 1;
  return (node.children ?? []).flatMap((child, index) =>
    renderListItem(child, context, listDepth, node.ordered ? start + index : null),
  );
}

function renderBlock(
  node: MarkdownNode,
  context: RenderContext,
): RenderedBlock[] {
  switch (node.type) {
    case "paragraph":
      return [
        {
          kind: "paragraph",
          content: renderInline(node.children, context),
        },
      ];

    case "heading": {
      const className =
        node.depth === 1
          ? "font-bold italic underline"
          : node.depth === 2
            ? "font-bold"
            : "font-bold text-cc-secondary";

      return [
        {
          kind: "heading",
          content: [
            <span key={context.key()} className={className}>
              {renderInline(node.children, context)}
            </span>,
          ],
        },
      ];
    }

    case "blockquote":
      return [
        {
          kind: "blockquote",
          content: [
            <span key={context.key()} className="text-cc-secondary italic">
              {renderChildren(node.children, context)}
            </span>,
          ],
        },
      ];

    case "list":
      return [
        {
          kind: "list",
          content: trimTrailingNewlinesCopy(renderList(node, context, 0)),
        },
      ];

    case "thematicBreak":
      return [
        {
          kind: "thematic-break",
          content: ["---"],
        },
      ];

    case "code":
      return [
        {
          kind: "code",
          content: [
            <span key={context.key()} className="text-cc-text">
              {node.value ?? ""}
            </span>,
          ],
        },
      ];

    case "table":
      return [
        {
          kind: "table",
          content: [formatAsciiTable(node)],
        },
      ];

    case "html":
      return [
        {
          kind: "html",
          content: [node.value ?? ""],
        },
      ];

    default:
      return [
        {
          kind: "other",
          content: renderInline(node.children, context),
        },
      ];
  }
}

function getBlockSeparator(previous: RenderedBlock, next: RenderedBlock) {
  if (previous.kind === "heading") {
    return "\n\n";
  }

  if (previous.kind === "thematic-break" || next.kind === "thematic-break") {
    return "\n\n";
  }

  if (previous.kind === "paragraph" && next.kind === "list") {
    return "\n";
  }

  if (previous.kind === "list" && next.kind === "list") {
    return "\n";
  }

  if (previous.kind === "list" && next.kind === "paragraph") {
    return "\n\n";
  }

  if (previous.kind === "code" || previous.kind === "table" || previous.kind === "blockquote") {
    return "\n\n";
  }

  if (next.kind === "code" || next.kind === "table" || next.kind === "blockquote") {
    return "\n\n";
  }

  if (previous.kind === "paragraph" && next.kind === "paragraph") {
    return "\n\n";
  }

  return "\n";
}

function renderChildren(nodes: MarkdownNode[] | undefined, context: RenderContext): ReactNode[] {
  if (!nodes?.length) {
    return [];
  }

  const blocks = nodes.flatMap((node) => renderBlock(node, context));
  const parts: ReactNode[] = [];

  blocks.forEach((block, index) => {
    if (index > 0) {
      parts.push(getBlockSeparator(blocks[index - 1]!, block));
    }

    parts.push(...block.content);
  });

  trimTrailingNewlines(parts);
  return parts;
}

export function Markdown({ content }: MarkdownProps) {
  let keyIndex = 0;
  const context: RenderContext = {
    key: () => `markdown-${keyIndex++}`,
  };

  const root = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(stripSystemMessages(content)) as MarkdownNode;

  return (
    <div className="m-0 min-w-0 max-w-full whitespace-pre-wrap break-words text-cc-text">
      {renderChildren(root.children, context)}
    </div>
  );
}
