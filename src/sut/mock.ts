// Mock system under test: no model, no network, no key.
// Picks a letter from a hash of (question id, round), so results are
// deterministic and score near random (about 25%). It exists to exercise the
// runner, scoring and report end to end. Every 7th run ends on a narration
// line with no answer, the failure mode the published study found, so the
// "no extractable answer" path is tested too.
import { createHash } from "node:crypto";
import type { SutInput, SutOutput, SystemUnderTest } from "../types.ts";

export function createMockSut(): SystemUnderTest {
  return {
    name: "mock",
    model: "mock",
    async answer({ question, userPrompt, round }: SutInput): Promise<SutOutput> {
      const h = createHash("sha256").update(`${question.id}#${round}`).digest();
      const letters = question.options.map((o) => o.letter).sort();
      const pick = letters[h[0] % letters.length];
      const cutOff = h[1] % 7 === 0;
      const text = cutOff
        ? "分析中。Now let me get the Chinese calendar data for that year:"
        : `（模拟回答，非真实推理）\n答案：${pick}`;
      await new Promise((r) => setTimeout(r, 20 + (h[2] % 30)));
      return {
        text,
        steps: cutOff ? 2 : 1,
        toolCalls: cutOff ? ["getChineseCalendarData"] : [],
        contextChunks: 0,
        // Synthetic token counts so the cost path has numbers to add up.
        usage: { inputTokens: userPrompt.length * 2, outputTokens: text.length },
      };
    },
  };
}
