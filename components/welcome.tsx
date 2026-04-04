"use client";

export function Welcome() {
  const cwd = "~/richietan.dev";
  const width = Math.max(46, cwd.length + 12);
  const inner = width - 2;
  const pad = (s: string) => s + " ".repeat(Math.max(0, inner - s.length));

  return (
    <div className="mb-2 select-none">
      <pre className="text-sm leading-snug">
        <span className="text-cc-border">{"╭" + "─".repeat(inner) + "╮"}</span>
        {"\n"}
        <span className="text-cc-border">│</span>
        <span>
          {" "}
          <span className="text-cc-claude">✻</span> Welcome to{" "}
          <span className="font-bold">richietan.dev</span>!
          {" ".repeat(
            Math.max(0, inner - " ✻ Welcome to richietan.dev!".length),
          )}
        </span>
        <span className="text-cc-border">│</span>
        {"\n"}
        <span className="text-cc-border">│</span>
        <span>{" ".repeat(inner)}</span>
        <span className="text-cc-border">│</span>
        {"\n"}
        <span className="text-cc-border">│</span>
        <span className="text-cc-secondary italic">
          {pad("   /help for help")}
        </span>
        <span className="text-cc-border">│</span>
        {"\n"}
        <span className="text-cc-border">│</span>
        <span>{" ".repeat(inner)}</span>
        <span className="text-cc-border">│</span>
        {"\n"}
        <span className="text-cc-border">│</span>
        <span className="text-cc-secondary">{pad("   cwd: " + cwd)}</span>
        <span className="text-cc-border">│</span>
        {"\n"}
        <span className="text-cc-border">{"╰" + "─".repeat(inner) + "╯"}</span>
      </pre>
    </div>
  );
}
