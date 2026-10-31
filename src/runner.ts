// Runs a system under test over benchmark questions and appends one JSON row
// per run to a .jsonl file. Rerunning with the same file resumes: rows that
// already succeeded are skipped.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildUserPrompt, extractAnswer, yearOf } from "./benchmark.ts";
import { costOf, type Price } from "./pricing.ts";
import type { Question, ResultRow, SystemUnderTest } from "./types.ts";

export function readRows(file: string): ResultRow[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ResultRow);
}

export async function runOne(
  sut: SystemUnderTest,
  q: Question,
  round: number,
  keepResponse = true
): Promise<ResultRow> {
  const started = Date.now();
  const base = {
    id: q.id,
    case_id: q.case_id,
    year: yearOf(q),
    category: q.category,
    round,
    model: sut.model,
    correct_answer: q.answer,
  };
  try {
    const out = await sut.answer({ question: q, userPrompt: buildUserPrompt(q), round });
    const predicted = extractAnswer(out.text);
    return {
      ...base,
      predicted_answer: predicted,
      correct: predicted === q.answer,
      steps: out.steps,
      tool_calls: out.toolCalls,
      knowledge_chunks: out.contextChunks,
      latency_ms: Date.now() - started,
      usage: out.usage,
      response_chars: out.text.length,
      ...(keepResponse && { response: out.text }),
    };
  } catch (error) {
    return {
      ...base,
      predicted_answer: null,
      correct: false,
      steps: 0,
      tool_calls: [],
      knowledge_chunks: 0,
      latency_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type RunOptions = {
  sut: SystemUnderTest;
  questions: Question[];
  rounds: number;
  concurrency: number;
  outFile: string;
  /** Stop starting new runs once estimated spend reaches this (USD). */
  maxUsd?: number;
  price?: Price;
  keepResponses?: boolean;
  log?: (line: string) => void;
};

export async function runBenchmark(o: RunOptions) {
  const log = o.log ?? console.log;
  const previous = readRows(o.outFile);
  const done = new Set(previous.filter((r) => !r.error).map((r) => `${r.id}#${r.round}`));
  const jobs = o.questions
    .flatMap((q) => Array.from({ length: o.rounds }, (_, i) => ({ q, round: i + 1 })))
    .filter(({ q, round }) => !done.has(`${q.id}#${round}`));

  log(
    `${o.sut.name} | ${o.questions.length} questions x ${o.rounds} round(s) | ${jobs.length} to run -> ${path.relative(process.cwd(), o.outFile)}`
  );

  const fresh: ResultRow[] = [];
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (next < jobs.length && !stopped) {
      if (o.maxUsd !== undefined && costOf(fresh, o.price).usd >= o.maxUsd) {
        stopped = true;
        log(`Spend cap $${o.maxUsd} reached; stopping. Rerun to resume.`);
        break;
      }
      const { q, round } = jobs[next++];
      const row = await runOne(o.sut, q, round, o.keepResponses ?? true);
      appendFileSync(o.outFile, `${JSON.stringify(row)}\n`);
      fresh.push(row);
      const mark = row.error ? `ERROR ${row.error.slice(0, 80)}` : row.correct ? "ok" : "wrong";
      log(
        `[${fresh.length}/${jobs.length}] ${q.id} r${round} ${row.predicted_answer ?? "-"}/${q.answer} ${mark} ${(row.latency_ms / 1000).toFixed(1)}s tools=${row.tool_calls.length}`
      );
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency) }, worker));
  return readRows(o.outFile);
}
