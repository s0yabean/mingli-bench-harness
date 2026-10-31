import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUserPrompt, extractAnswer, loadQuestions, yearOf } from "../src/benchmark.ts";

test("dataset has 160 questions, 40 per year", () => {
  const qs = loadQuestions();
  assert.equal(qs.length, 160);
  for (const y of [2022, 2023, 2024, 2025]) {
    assert.equal(qs.filter((q) => yearOf(q) === y).length, 40);
  }
});

test("extractAnswer follows MingLi-Bench rules", () => {
  assert.equal(extractAnswer("分析……\n答案：C"), "C");
  assert.equal(extractAnswer("**答案：** b"), "B");
  assert.equal(extractAnswer("答案：A ... 修正后 答案：D"), "D");
  assert.equal(extractAnswer("我选择：B"), "B");
  assert.equal(extractAnswer("Now let me get the Chinese calendar data for 2020:"), null);
  assert.equal(extractAnswer(""), null);
});

test("user prompt keeps the benchmark wording and sorted options", () => {
  const q = loadQuestions()[0];
  const p = buildUserPrompt(q);
  assert.match(p, /答案：X/);
  assert.ok(p.includes(q.birth_info.raw));
  assert.ok(p.indexOf("A. ") < p.indexOf("D. "));
});
