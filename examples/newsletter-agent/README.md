# Example: rubric-graded Managed Agent

A second evaluation pattern, separate from the benchmark harness. MingLi-Bench
has an answer key. A research agent that writes a newsletter link digest does
not, so its output is graded against a written rubric instead: eight
criteria, each pass/fail on its own, with no overall impression score.

- `newsletter-researcher.agent.yaml`: Claude Managed Agents config (model,
  system prompt, toolset)
- `newsletter-researcher.environment.yaml`: its cloud environment
- `newsletter-rubric.md`: the grading rubric for the agent's output file

These are configuration files only; nothing in this repo runs them. Paths
under `/workspace/repo` refer to the product repository the agent reads,
which is not included here.
