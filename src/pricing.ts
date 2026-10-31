// Cost tracking. Prices are USD per million tokens, list price.
// Check your provider before relying on these: prices change.
import type { ResultRow } from "./types.ts";

export type Price = { input: number; output: number };

export const PRICES: Record<string, Price> = {
  // List price used for the published study (October 2026).
  "moonshotai/kimi-k2.5": { input: 0.6, output: 3.0 },
  mock: { input: 0, output: 0 },
};

export function costOf(rows: ResultRow[], override?: Price) {
  let inputTokens = 0;
  let outputTokens = 0;
  let usd = 0;
  const unpriced = new Set<string>();
  for (const r of rows) {
    const i = r.usage?.inputTokens ?? 0;
    const o = r.usage?.outputTokens ?? 0;
    inputTokens += i;
    outputTokens += o;
    const price = override ?? PRICES[r.model];
    if (!price) {
      unpriced.add(r.model);
      continue;
    }
    usd += (i * price.input + o * price.output) / 1_000_000;
  }
  return { inputTokens, outputTokens, usd, unpriced: [...unpriced] };
}
