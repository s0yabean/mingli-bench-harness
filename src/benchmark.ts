// MingLi-Bench loading, prompt wording and answer extraction.
// The prompt text and the extraction rules are ported from
// github.com/DestinyLinker/MingLi-Bench (MIT, see data/mingli-bench/LICENSE).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Question } from "./types.ts";

export const QUESTIONS_PER_YEAR = 40;
export const BASE_YEAR = 2022;

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(here, "../data/mingli-bench/data.json");

export function loadQuestions(file = DATA_FILE): Question[] {
  return (JSON.parse(readFileSync(file, "utf8")) as { questions: Question[] })
    .questions;
}

/** Competition year: questions are stored 40 per year, 2022 to 2025. */
export const yearOf = (q: Pick<Question, "question_number">) =>
  BASE_YEAR + Math.floor((q.question_number - 1) / QUESTIONS_PER_YEAR);

/** Category labels in the dataset are Chinese; these are for reports. */
export const CATEGORY_EN: Record<string, string> = {
  婚姻: "Marriage",
  事业: "Career",
  家庭: "Family",
  健康: "Health",
  性格: "Personality",
  财运: "Money",
  学业: "Education",
  子女: "Children",
  外貌: "Appearance",
  运势: "General fortune",
  灾劫: "Accidents",
  官非: "Legal trouble",
};

/**
 * Same wording as MingLi-Bench's _prepare_prompt with --cot and without
 * --astro: the system under test supplies its own chart, if it has one.
 */
export function buildUserPrompt(q: Question): string {
  const options = [...q.options]
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .map((o) => `${o.letter}. ${o.text}`)
    .join("\n");
  return `以下是一道关于中国传统命理的题目。

命主信息：
${q.birth_info.raw}
结合中国传统命理学（包括但不限于四柱八字、紫微斗数等），请先分析推理过程，然后给出答案。最后用'答案：X'的格式给出你的选择（X为A、B、C或D）。

问题：${q.question}

选项：
${options}
`;
}

/** Port of MingLi-Bench's _extract_answer. Returns null when no letter is found. */
export function extractAnswer(raw: string): string | null {
  const response = raw
    .trim()
    .replace(/[*_`]+/g, "")
    .replace(/["'“”‘’「」『』（）()[\]【】<>《》]/g, "");
  const patterns = [
    /答案[：:]\s*([A-Za-z])/gm,
    /答案是[：:]\s*([A-Za-z])/gm,
    /选择[：:]\s*([A-Za-z])/gm,
    /选[：:]\s*([A-Za-z])/gm,
    /^([A-Za-z])$/gm,
    /[。，]([A-Za-z])[。]?$/gm,
  ];
  for (const pattern of patterns) {
    const matches = [...response.matchAll(pattern)];
    if (matches.length > 0) {
      return matches.at(-1)?.[1].toUpperCase() ?? null;
    }
  }
  const letters = [...response.matchAll(/\b([A-Za-z])\b/g)]
    .map((m) => m[1].toUpperCase())
    .filter((l) => "ABCDEF".includes(l));
  return letters.at(-1) ?? null;
}
