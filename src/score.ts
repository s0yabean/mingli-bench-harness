// Scoring and the results report.
//
// Scoring follows the Tianfu Agent report:
//  - a question counts as correct when a majority of rounds got it right
//    (at least 3 of 5 with --rounds 5)
//  - trimmed mean: accuracy per person (case), drop the best and the worst
//    person, average the rest
import { CATEGORY_EN } from "./benchmark.ts";
import { costOf, type Price } from "./pricing.ts";
import type { ResultRow } from "./types.ts";

/** Published 2025 trimmed means from the Tianfu Agent report. */
export const BASELINES_2025: [string, number][] = [
  ["Top 20 human practitioners", 53.5],
  ["Tianfu Agent", 50.0],
  ["Claude Opus 4.6, no tools", 40.0],
  ["Random guessing", 25.0],
];

const pct = (n: number, d: number) => (d === 0 ? 0 : (100 * n) / d);

type Group = { n: number; ok: number };

export type Summary = {
  label: string;
  rounds: number;
  need: number;
  runs: number;
  questions: number;
  correct: number;
  errors: number;
  unparsed: number;
  /** Questions where every round gave the same answer (rounds > 1 only). */
  sameAnswerAllRounds: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  byYear: { year: number; n: number; ok: number; trimmedMean: number | null }[];
  byCategory: { category: string; n: number; ok: number }[];
  cost: ReturnType<typeof costOf>;
};

function trimmedMean(perCase: Group[]): number | null {
  const accs = perCase.map((g) => pct(g.ok, g.n)).sort((a, b) => a - b);
  if (accs.length < 3) return null;
  const kept = accs.slice(1, -1);
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

export function score(
  rows: ResultRow[],
  rounds: number,
  opts: { label?: string; price?: Price } = {}
): Summary {
  const byQuestion = new Map<string, ResultRow[]>();
  for (const row of rows.filter((r) => !r.error)) {
    byQuestion.set(row.id, [...(byQuestion.get(row.id) ?? []), row]);
  }
  const need = Math.floor(rounds / 2) + 1;
  const complete = [...byQuestion.values()]
    .filter((rs) => rs.length >= rounds)
    .map((rs) => [...rs].sort((a, b) => a.round - b.round).slice(0, rounds));

  const questions = complete.map((rs) => ({
    ...rs[0],
    correct: rs.filter((r) => r.correct).length >= need,
  }));

  const sameAnswerAllRounds =
    rounds > 1
      ? complete.filter((rs) =>
          rs.every((r) => r.predicted_answer === rs[0].predicted_answer)
        ).length
      : null;

  const groupBy = (key: (q: (typeof questions)[number]) => string) => {
    const out = new Map<string, Group>();
    for (const q of questions) {
      const g = out.get(key(q)) ?? { n: 0, ok: 0 };
      g.n += 1;
      g.ok += q.correct ? 1 : 0;
      out.set(key(q), g);
    }
    return out;
  };

  const years = groupBy((q) => String(q.year));
  const cases = groupBy((q) => `${q.year}|${q.case_id}`);
  const byYear = [...years.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, g]) => ({
      year: Number(year),
      ...g,
      trimmedMean: trimmedMean(
        [...cases.entries()]
          .filter(([k]) => k.startsWith(`${year}|`))
          .map(([, v]) => v)
      ),
    }));

  const byCategory = [...groupBy((q) => q.category).entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([category, g]) => ({ category, ...g }));

  const latencies = rows
    .filter((r) => !r.error)
    .map((r) => r.latency_ms)
    .sort((a, b) => a - b);
  const at = (p: number) =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : null;

  return {
    label: opts.label ?? rows[0]?.model ?? "unknown",
    rounds,
    need,
    runs: rows.length,
    questions: questions.length,
    correct: questions.filter((q) => q.correct).length,
    errors: rows.filter((r) => r.error).length,
    unparsed: rows.filter((r) => !r.error && r.predicted_answer === null).length,
    sameAnswerAllRounds,
    latencyP50: at(0.5),
    latencyP95: at(0.95),
    byYear,
    byCategory,
    cost: costOf(rows, opts.price),
  };
}

const f1 = (n: number) => n.toFixed(1);

/** Markdown report. Printed to the console and saved next to the results. */
export function renderReport(s: Summary): string {
  const lines: string[] = [];
  lines.push(`# MingLi-Bench results: ${s.label}`, "");
  lines.push(
    `- Runs: ${s.runs} (${s.rounds} round(s) per question, correct when at least ${s.need} of ${s.rounds} agree with the key)`,
    `- Questions scored: ${s.questions}`,
    `- Accuracy: ${s.correct}/${s.questions} = ${f1(pct(s.correct, s.questions))}%`,
    `- Errors: ${s.errors} · runs with no extractable answer: ${s.unparsed}`
  );
  if (s.sameAnswerAllRounds !== null) {
    lines.push(
      `- Same answer on all ${s.rounds} rounds: ${s.sameAnswerAllRounds} of ${s.questions} questions`
    );
  }
  if (s.latencyP50 !== null && s.latencyP95 !== null) {
    lines.push(
      `- Latency: p50 ${f1(s.latencyP50 / 1000)}s · p95 ${f1(s.latencyP95 / 1000)}s`
    );
  }
  const c = s.cost;
  lines.push(
    `- Tokens: ${c.inputTokens.toLocaleString("en-US")} in · ${c.outputTokens.toLocaleString("en-US")} out · cost $${c.usd.toFixed(2)}${c.unpriced.length ? ` (no price for: ${c.unpriced.join(", ")})` : ""}`,
    ""
  );

  lines.push("## By year", "", "| Year | Correct | Accuracy | Trimmed mean |", "|---|---|---|---|");
  for (const y of s.byYear) {
    lines.push(
      `| ${y.year} | ${y.ok}/${y.n} | ${f1(pct(y.ok, y.n))}% | ${y.trimmedMean === null ? "-" : `${f1(y.trimmedMean)}%`} |`
    );
  }

  lines.push("", "## By topic", "", "| Topic | Correct | Accuracy |", "|---|---|---|");
  for (const g of s.byCategory) {
    const name = CATEGORY_EN[g.category] ?? g.category;
    lines.push(`| ${name} (${g.category}) | ${g.ok}/${g.n} | ${f1(pct(g.ok, g.n))}% |`);
  }

  const y2025 = s.byYear.find((y) => y.year === 2025);
  if (y2025?.trimmedMean != null) {
    lines.push(
      "",
      "## 2025 trimmed mean vs published baselines",
      "",
      "| System | Trimmed mean |",
      "|---|---|"
    );
    const table: [string, number][] = [
      ...BASELINES_2025,
      [`**This run (${s.label})**`, y2025.trimmedMean],
    ];
    table.sort((a, b) => b[1] - a[1]);
    for (const [name, v] of table) lines.push(`| ${name} | ${f1(v)}% |`);
    lines.push(
      "",
      "Baselines are published numbers from the Tianfu Agent report, not re-run here."
    );
  }
  return `${lines.join("\n")}\n`;
}
