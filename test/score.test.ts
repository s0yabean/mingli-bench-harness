import assert from "node:assert/strict";
import { test } from "node:test";
import { costOf } from "../src/pricing.ts";
import { readRows } from "../src/runner.ts";
import { score } from "../src/score.ts";
import type { ResultRow } from "../src/types.ts";

const row = (id: string, c: string, round: number, ok: boolean, p: string | null = ok ? "A" : "B"): ResultRow => ({
  id, case_id: c, year: 2025, category: "婚姻", round, model: "mock",
  correct_answer: "A", predicted_answer: p, correct: ok, steps: 1, tool_calls: [],
  knowledge_chunks: 0, latency_ms: 1000,
});

test("majority vote: 3 of 5 counts, 2 of 5 does not", () => {
  const rows = [
    ...[true, true, true, false, false].map((ok, i) => row("q1", "c1", i + 1, ok)),
    ...[true, true, false, false, false].map((ok, i) => row("q2", "c1", i + 1, ok)),
  ];
  const s = score(rows, 5);
  assert.equal(s.questions, 2);
  assert.equal(s.correct, 1);
  assert.equal(s.sameAnswerAllRounds, 0);
});

test("trimmed mean drops best and worst person", () => {
  // per-person accuracy 0%, 50%, 100%, 100% -> keep 50, 100 -> 75
  const rows = [
    row("a1", "p1", 1, false), row("a2", "p1", 1, false),
    row("b1", "p2", 1, true), row("b2", "p2", 1, false),
    row("c1", "p3", 1, true), row("c2", "p3", 1, true),
    row("d1", "p4", 1, true), row("d2", "p4", 1, true),
  ];
  assert.equal(score(rows, 1).byYear[0].trimmedMean, 75);
});

test("cost uses USD per million tokens", () => {
  const r = { ...row("q", "c", 1, true), model: "moonshotai/kimi-k2.5", usage: { inputTokens: 1_000_000, outputTokens: 100_000 } };
  assert.ok(Math.abs(costOf([r]).usd - 0.9) < 1e-9);
});

// The committed results of the published study must reproduce its numbers.
test("published results reproduce the article", () => {
  const r2025 = readRows("results/published/kimi-k2.5-2025x5.jsonl");
  const all = readRows("results/published/kimi-k2.5-all.jsonl");
  const s5 = score(r2025, 5);
  assert.equal(s5.byYear[0].trimmedMean?.toFixed(1), "36.7");
  assert.equal(s5.sameAnswerAllRounds, 12);
  const s1 = score(all, 1);
  assert.equal(s1.correct, 60);
  assert.equal(score(readRows("results/published/kimi-k2.5-all-retried.jsonl"), 1).correct, 61);
  assert.equal(s1.byYear.find((y) => y.year === 2025)?.trimmedMean?.toFixed(1), "36.7");
  assert.equal(r2025.length + all.length, 360);
  assert.equal([...r2025, ...all].filter((r) => r.predicted_answer === null).length, 4);
  assert.equal(costOf([...r2025, ...all]).usd.toFixed(2), "3.55");
});
