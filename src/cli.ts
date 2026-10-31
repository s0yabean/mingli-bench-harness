/**
 * MingLi-Bench harness CLI.
 *
 *   npm run quickstart                       5 questions, mock model, no key
 *   npx tsx src/cli.ts --sut reference --model moonshotai/kimi-k2.5 --year 2025 --rounds 5
 *   npx tsx src/cli.ts --score --in results/published/kimi-k2.5-2025x5.jsonl --rounds 5
 *
 * Flags:
 *   --sut <mock|reference>   system under test (default mock)
 *   --model <id>             AI Gateway model id for --sut reference
 *   --gateway-order <a,b>    AI Gateway provider order, e.g. fireworks,bedrock
 *   --prompt <file>          system prompt file (default prompts/example-system-prompt.md)
 *   --year <yyyy>            2022 | 2023 | 2024 | 2025 (default all)
 *   --sample <n>             first n questions after filtering
 *   --rounds <n>             independent runs per question (the study used 5)
 *   --concurrency <n>        parallel runs (default 4)
 *   --max-usd <n>            stop starting runs at this estimated spend (default 5)
 *   --price-in/--price-out   override USD per million tokens
 *   --out <stem>             results/<stem>.jsonl (default <sut>-<year|all>)
 *   --fresh                  delete the results file first instead of resuming
 *   --no-responses           do not store response text
 *   --score                  score an existing file only (with --in or --out)
 *   --in <file>              results file to score
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadQuestions, yearOf } from "./benchmark.ts";
import type { Price } from "./pricing.ts";
import { readRows, runBenchmark } from "./runner.ts";
import { renderReport, score } from "./score.ts";
import { createMockSut } from "./sut/mock.ts";
import { createReferenceAgent } from "./sut/reference-agent.ts";
import type { SystemUnderTest } from "./types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(here, "../results");

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const num = (flag: string) => (get(flag) === undefined ? undefined : Number(get(flag)));
  const sut = get("--sut") ?? "mock";
  const year = num("--year");
  const priceIn = num("--price-in");
  const priceOut = num("--price-out");
  return {
    sut,
    model: get("--model") ?? process.env.MODEL ?? "moonshotai/kimi-k2.5",
    gatewayOrder: (get("--gateway-order") ?? process.env.GATEWAY_ORDER ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    prompt: get("--prompt"),
    year,
    sample: num("--sample"),
    rounds: num("--rounds") ?? 1,
    concurrency: num("--concurrency") ?? 4,
    maxUsd: num("--max-usd") ?? 5,
    price:
      priceIn !== undefined || priceOut !== undefined
        ? ({ input: priceIn ?? 0, output: priceOut ?? 0 } satisfies Price)
        : undefined,
    out: get("--out") ?? `${sut}-${year ?? "all"}`,
    in: get("--in"),
    fresh: argv.includes("--fresh"),
    keepResponses: !argv.includes("--no-responses"),
    scoreOnly: argv.includes("--score"),
  };
}

function makeSut(o: ReturnType<typeof parseArgs>): SystemUnderTest {
  if (o.sut === "mock") return createMockSut();
  if (o.sut === "reference") {
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new Error("--sut reference needs AI_GATEWAY_API_KEY (copy .env.example to .env).");
    }
    return createReferenceAgent({
      model: o.model,
      systemPromptFile: o.prompt,
      gatewayOrder: o.gatewayOrder,
    });
  }
  throw new Error(`Unknown --sut ${o.sut}. Use mock or reference, or add yours in src/cli.ts.`);
}

function report(file: string, rounds: number, label: string, price?: Price) {
  const text = renderReport(score(readRows(file), rounds, { label, price }));
  const reportFile = file.replace(/\.jsonl$/, "") + ".report.md";
  // Published results are committed; write their reports to results/ instead.
  const target = file.includes(`${path.sep}published${path.sep}`)
    ? path.join(RESULTS, path.basename(reportFile))
    : reportFile;
  writeFileSync(target, text);
  console.log(`\n${text}\nReport written to ${path.relative(process.cwd(), target)}`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  mkdirSync(RESULTS, { recursive: true });
  const outFile = o.in ? path.resolve(o.in) : path.join(RESULTS, `${o.out}.jsonl`);

  if (o.scoreOnly) {
    if (!existsSync(outFile)) throw new Error(`No results file at ${outFile}`);
    const rows = readRows(outFile);
    report(outFile, o.rounds, rows[0]?.model ?? o.out, o.price);
    return;
  }

  const sut = makeSut(o);
  let questions = loadQuestions();
  if (o.year) questions = questions.filter((q) => yearOf(q) === o.year);
  if (o.sample) questions = questions.slice(0, o.sample);
  if (o.fresh) rmSync(outFile, { force: true });

  await runBenchmark({
    sut,
    questions,
    rounds: o.rounds,
    concurrency: o.concurrency,
    outFile,
    maxUsd: o.maxUsd,
    price: o.price,
    keepResponses: o.keepResponses,
  });
  report(outFile, o.rounds, sut.name, o.price);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
