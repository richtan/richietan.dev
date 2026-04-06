import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * Markdown rendering that matches Claude Code CLI style:
 * - h1: bold + italic + underline
 * - h2: bold
 * - h3+: bold + dim
 * - inline code: blue
 * - blockquote: dim + italic
 * - links: blue
 * - lists: `- ` with 2-space indent per depth
 */
const components: Components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return (
        <code className={`block overflow-x-auto py-1 text-[13px] text-cc-text ${className}`}>
          {children}
        </code>
      );
    }
    return (
      <code className="text-blue-400">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto whitespace-pre-wrap break-words">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-400"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex min-w-0">
      <span className="mr-2 shrink-0 text-cc-secondary select-none">-</span>
      <span className="min-w-0">{children}</span>
    </li>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 font-bold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 font-bold text-cc-secondary">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 font-bold text-cc-secondary">{children}</h4>
  ),
  hr: () => <div className="my-2 border-t border-cc-border/60" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l border-cc-border/50 pl-3 text-cc-secondary italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-max min-w-[38rem] border-collapse text-[13px] leading-5">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-cc-border/80 px-3 py-1.5 text-left font-semibold text-cc-text">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-cc-border/80 px-3 py-1.5 align-top text-cc-text">
      {children}
    </td>
  ),
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-[15px] leading-[1.25]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
