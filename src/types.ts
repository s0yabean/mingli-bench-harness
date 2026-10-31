// Shared types for the harness.

export type BirthInfo = {
  raw: string;
  gender: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  country: string;
};

export type Question = {
  id: string;
  question_number: number;
  case_id: string;
  birth_info: BirthInfo;
  question: string;
  options: { letter: string; text: string }[];
  answer: string;
  category: string;
};

export type Usage = { inputTokens: number; outputTokens: number };

/** What the runner hands to a system under test for one run. */
export type SutInput = {
  question: Question;
  /** The benchmark's own user prompt, built by buildUserPrompt(). */
  userPrompt: string;
  round: number;
};

/** What a system under test hands back. The runner extracts the answer. */
export type SutOutput = {
  text: string;
  steps: number;
  toolCalls: string[];
  /** Retrieved context chunks (RAG), 0 if the system has none. */
  contextChunks: number;
  usage: Usage;
};

/**
 * Anything that can answer a benchmark question: a production agent, a
 * prompt + model, or a mock. Implement this to put your own agent under test.
 */
export interface SystemUnderTest {
  /** Short label used in result rows and file names. */
  name: string;
  /** Model id used for cost lookup (see src/pricing.ts). */
  model: string;
  answer(input: SutInput): Promise<SutOutput>;
}

/** One line of a results .jsonl file. */
export type ResultRow = {
  id: string;
  case_id: string;
  year: number;
  category: string;
  round: number;
  model: string;
  correct_answer: string;
  predicted_answer: string | null;
  correct: boolean;
  steps: number;
  tool_calls: string[];
  knowledge_chunks: number;
  latency_ms: number;
  usage?: Usage;
  response_chars?: number;
  response?: string;
  error?: string;
};
