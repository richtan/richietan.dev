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
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return (
        <code className={`block overflow-x-auto py-2 text-sm ${className}`}>
          {children}
        </code>
      );
    }
    // Inline code: blue, matching Claude Code CLI
    return (
      <code className="text-blue-400">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto">{children}</pre>
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
  ul: ({ children }) => <ul className="mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex">
      <span className="mr-2 shrink-0 text-cc-secondary select-none">-</span>
      <span>{children}</span>
    </li>
  ),
  // h1: bold + italic + underline (matches CLI)
  h1: ({ children }) => (
    <h1 className="mb-2 font-bold italic underline">{children}</h1>
  ),
  // h2: bold
  h2: ({ children }) => (
    <h2 className="mb-2 font-bold">{children}</h2>
  ),
  // h3+: bold + dim
  h3: ({ children }) => (
    <h3 className="mb-2 font-bold text-cc-secondary">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 font-bold text-cc-secondary">{children}</h4>
  ),
  hr: () => <div className="my-2 text-cc-secondary">---</div>,
  // Blockquote: dim + italic (matches CLI)
  blockquote: ({ children }) => (
    <blockquote className="text-cc-secondary italic">{children}</blockquote>
  ),
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
