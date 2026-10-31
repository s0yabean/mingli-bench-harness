// Reference system under test: system prompt + model + tools, run through the
// Vercel AI SDK and AI Gateway. It has the same shape as the production agent
// the published study measured (system prompt, injected chart and retrieved
// context, tools, an 8-step cap, a pinned provider order) with the private
// parts replaced:
//
//   production                         here
//   ---------------------------------  ------------------------------------
//   full production system prompt      prompts/example-system-prompt.md
//   chart service snapshot             ContextProvider hook (none by default)
//   knowledge-base retrieval (RAG)     ContextProvider hook (none by default)
//   chart + calendar tools             stub tools in ./tools.ts
//
// Needs AI_GATEWAY_API_KEY (see .env.example).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gateway, generateText, stepCountIs } from "ai";
import type { Question, SutInput, SutOutput, SystemUnderTest } from "../types.ts";
import { createCalculateElapsedTimeTool, getChineseCalendarData } from "./tools.ts";

/**
 * Supplies per-question context that goes into the system prompt: a computed
 * chart, retrieved passages, anything the real product would inject.
 */
export interface ContextProvider {
  name: string;
  build(question: Question, userPrompt: string): Promise<{ blocks: string[]; chunks: number }>;
}

export const noContext: ContextProvider = {
  name: "none",
  build: async () => ({ blocks: [], chunks: 0 }),
};

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPT = path.join(here, "../../prompts/example-system-prompt.md");

export type ReferenceAgentOptions = {
  model: string;
  systemPromptFile?: string;
  context?: ContextProvider;
  /** AI Gateway provider order, e.g. ["fireworks", "bedrock"]. */
  gatewayOrder?: string[];
  maxSteps?: number;
  /** "Today" for the date tool. Fixed so runs are comparable. */
  asOfDate?: string;
};

export function createReferenceAgent(opts: ReferenceAgentOptions): SystemUnderTest {
  const basePrompt = readFileSync(opts.systemPromptFile ?? DEFAULT_PROMPT, "utf8");
  const context = opts.context ?? noContext;
  const asOfDate = opts.asOfDate ?? "2026-01-15";

  return {
    name: `reference:${opts.model}`,
    model: opts.model,
    async answer({ question, userPrompt }: SutInput): Promise<SutOutput> {
      const ctx = await context.build(question, userPrompt);
      const result = await generateText({
        model: gateway.languageModel(opts.model),
        system: [basePrompt, ...ctx.blocks].join("\n\n"),
        messages: [{ role: "user", content: userPrompt }],
        stopWhen: stepCountIs(opts.maxSteps ?? 8),
        tools: {
          getChineseCalendarData,
          calculateElapsedTime: createCalculateElapsedTimeTool(asOfDate),
        },
        providerOptions: {
          gateway: {
            ...(opts.gatewayOrder?.length && { order: opts.gatewayOrder }),
            tags: ["feature:eval-mingli-bench"],
          },
        },
      });
      return {
        text: result.text,
        steps: result.steps.length,
        toolCalls: result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName)),
        contextChunks: ctx.chunks,
        usage: {
          inputTokens: result.totalUsage.inputTokens ?? 0,
          outputTokens: result.totalUsage.outputTokens ?? 0,
        },
      };
    },
  };
}
