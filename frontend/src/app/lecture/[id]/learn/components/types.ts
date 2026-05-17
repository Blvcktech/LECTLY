// ── Shared types for the Learn Mode card flow ──

export type FlowCard =
  | { type: "concept"; index: number; subtitle: string; body: string }
  | { type: "analogy"; body: string }
  | { type: "quiz"; questionIndex: number };
