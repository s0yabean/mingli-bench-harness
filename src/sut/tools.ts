// Stub tools for the reference agent. They have the same names and input
// shapes as the production agent's tools, so the agent loop behaves the same
// way (tool calls, step counting), but the logic is deliberately simple.
// Replace them with your own services for a real evaluation.
import { tool } from "ai";
import { z } from "zod";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const ZODIAC = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];

/**
 * Year pillar for a Gregorian date. Approximate: it treats 4 February as the
 * start of the solar year (立春 falls on 3 to 5 February). A real chart
 * service computes the exact solar term.
 */
export function yearPillar(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const solarYear = m < 2 || (m === 2 && d < 4) ? y - 1 : y;
  const i = (((solarYear - 4) % 60) + 60) % 60;
  return {
    solarYear,
    pillar: `${STEMS[i % 10]}${BRANCHES[i % 12]}`,
    zodiac: ZODIAC[i % 12],
  };
}

export const getChineseCalendarData = tool({
  description:
    "Get the Chinese calendar year pillar (stem-branch) and zodiac animal for a Gregorian date. Stub: year level only, approximate at the 立春 boundary.",
  inputSchema: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Gregorian date, YYYY-MM-DD"),
  }),
  execute: async ({ date }) => ({ date, ...yearPillar(date), stub: true }),
});

/** Whole years and months between two dates given as YYYY, YYYY-MM or YYYY-MM-DD. */
export function elapsed(from: string, to: string) {
  const parse = (s: string) => {
    const [y, m = 7, d = 15] = s.split("-").map(Number);
    return { y, m, d };
  };
  const a = parse(from);
  const b = parse(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return { from, to, years: Math.trunc(months / 12), months: months % 12, totalMonths: months };
}

export function createCalculateElapsedTimeTool(asOfDate: string) {
  return tool({
    description: `Calculate elapsed calendar time between two dates. Do not do date arithmetic in your head. "Today" is ${asOfDate}. Accepts YYYY, YYYY-MM or YYYY-MM-DD.`,
    inputSchema: z.object({
      from: z.string().min(4).max(10),
      to: z.string().min(4).max(10).optional(),
    }),
    execute: async ({ from, to }) => elapsed(from, to ?? asOfDate),
  });
}
