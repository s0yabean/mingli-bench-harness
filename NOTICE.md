# Third-party notices

## MingLi-Bench

`data/mingli-bench/data.json` is copied unchanged from
[DestinyLinker/MingLi-Bench](https://github.com/DestinyLinker/MingLi-Bench)
at commit `b7433280fd86d7a7c27debbc47d0303c218f0bfd`, under the MIT licence
(`data/mingli-bench/LICENSE`, Copyright (c) 2026 MingLi-Bench Contributors).
The questions come from the Global Fortune Teller Competition (2022 to 2025).

The user-prompt wording in `src/benchmark.ts` (`buildUserPrompt`) and the
answer-extraction rules (`extractAnswer`) are TypeScript ports of
MingLi-Bench's `_prepare_prompt` and `_extract_answer`, under the same licence.

`scripts/download-mingli-bench.sh` re-downloads or verifies the data file
against that commit by SHA-256.

## Dependencies

The Vercel AI SDK (`ai`, Apache-2.0) and `zod` (MIT) are installed from npm
and are not vendored. No code from the Vercel chatbot template is included.
