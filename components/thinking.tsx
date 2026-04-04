"use client";

import { useState, useEffect } from "react";

const SPINNER_CHARS = ["·", "✢", "✳", "∗", "✻", "✽"];
const SPINNER_SEQUENCE = [...SPINNER_CHARS, ...[...SPINNER_CHARS].reverse()];

const VERBS = [
  "Thinking",
  "Clauding",
  "Noodling",
  "Vibing",
  "Brewing",
  "Pondering",
  "Musing",
  "Mulling",
  "Considering",
  "Reflecting",
  "Contemplating",
  "Ruminating",
  "Processing",
  "Analyzing",
  "Computing",
  "Synthesizing",
  "Connecting dots",
  "Loading thoughts",
];

export function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [verb] = useState(
    () => VERBS[Math.floor(Math.random() * VERBS.length)],
  );

  useEffect(() => {
    const spinnerInterval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_SEQUENCE.length);
    }, 120);
    const timerInterval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      clearInterval(spinnerInterval);
      clearInterval(timerInterval);
    };
  }, []);

  const char = SPINNER_SEQUENCE[frame];

  return (
    <div className="mt-4 flex items-baseline">
      <span className="w-5 shrink-0 text-cc-claude select-none">{char}</span>
      <span>
        <span className="text-cc-claude">{verb}...</span>
        <span className="text-cc-secondary">
          {" "}
          ({elapsed}s)
        </span>
      </span>
    </div>
  );
}
