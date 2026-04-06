function stripInlineMarkdown(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 <$2>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripInlineMarkdown(cell.trim()));
}

function isTableSeparator(line: string) {
  const trimmed = line.trim();
  return /^(?:\|?\s*:?-+:?\s*)+\|?$/.test(trimmed) && trimmed.includes("-");
}

function formatTable(rows: string[][]) {
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

  return [
    border,
    formatRow(rows[0] ?? []),
    border,
    ...rows.slice(1).map(formatRow),
    border,
  ].join("\n");
}

function renderMarkdownToText(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      output.push(codeLines.join("\n"));
      continue;
    }

    const nextLine = lines[index + 1] ?? "";
    if (line.includes("|") && isTableSeparator(nextLine)) {
      const rows: string[][] = [];
      rows.push(splitTableRow(line));
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }
      index -= 1;
      output.push(formatTable(rows));
      continue;
    }

    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      output.push("────────────────────────────────────────────────");
      continue;
    }

    if (/^\s*#{1,6}\s+/.test(line)) {
      output.push(stripInlineMarkdown(line.replace(/^\s*#{1,6}\s+/, "")));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      output.push(`> ${stripInlineMarkdown(line.replace(/^\s*>\s?/, ""))}`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      output.push(`- ${stripInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ""))}`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      output.push(stripInlineMarkdown(line));
      continue;
    }

    output.push(stripInlineMarkdown(line));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function Markdown({ content }: { content: string }) {
  return (
    <pre className="m-0 min-w-0 whitespace-pre-wrap break-words text-[15px] leading-[1.25] text-cc-text">
      {renderMarkdownToText(content)}
    </pre>
  );
}
