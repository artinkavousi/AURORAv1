
# PURPOSE
- Execute **component/feature slices** end-to-end with **production-grade code**.
- Maintain **single-task focus** and **zero-shotable subtasks** that the agent can complete successfully in one pass.
- Integrate each completed task into the main app and run a fast **task-level integration check** before moving on.

# AUTONOMY & CONFIRMATIONS
<autonomy>
- Do **not** ask for confirmation mid-flow. Choose a safe, high-throughput path and proceed.
- On safe ambiguity: **assume YES**; log one line in `__AGENT__/AGENT_DECISIONS.md`.
- Pause only for clearly destructive/high-risk actions (migrations, external billing, external infra).
</autonomy>

# SINGLE-TASK DEEP BUILD (NO MASS SCAFFOLDING)
<single_task>
- Work **one task at a time**. Do **not** pre-scaffold many placeholders or unrelated files.
- For the active task, create **only** files required by its subtasks; implement fully; then integrate; then validate; then move on.
</single_task>

# ZERO-SHOTABLE SUBTASKS — DONE DEFINITION
<zero_shot_done>
A subtask is **zero-shotable** iff it satisfies **all**:
1) **Scope budget**: ≤ 5 files touched OR ≤ 150 effective LOC changed (configurable per repo).
2) **Locality**: changes are mostly within one module/feature boundary; cross-cutting edits are minimized.
3) **Determinism**: acceptance can be validated without credentials or external approvals (use local adapters or test harness only, never ship hard-coded data to prod).
4) **Contracts clear**: inputs/outputs, side-effects, and error cases specified in the subtask header.
5) **Atomicity**: compiles independently (or with feature flag) and leaves the repo in a healthy state.
6) **Traceability**: references its parent task ID, files, and acceptance in commit message and notes.
</zero_shot_done>

# SUBTASK EXECUTION LOOP (SEQUENTIAL & COMPLETE)
<subtask_loop>
- Execute subtasks in declared order; **complete each fully** before the next.
- For each subtask, enforce the zero-shot rubric above. If it fails the rubric, **split or re-sequence** inside the task before coding.
- Keep edits tightly scoped; reuse existing modules; avoid duplication and drive-by refactors.
- Record a 1–2 line note to `AGENT_NOTES.md` per subtask and mark the corresponding Cursor To-Do item done.
- Commit atomically per subtask (`feat(TASK-ID:SUB-ID): <action>`) with a short list of touched files.
</subtask_loop>

# BUILD-FIRST EXECUTION
<build_first>
- Focus on writing complete, working code and required files. Avoid repeated `tsc/test/lint/dev` loops during build.
- Per **subtask**: implement fully; ensure compiles; proceed.
- After **all subtasks** for the task finish, perform **task-level integration** and quick validation (see below).
- A single optimized **Verification Pass** runs at the end/milestones.
</build_first>

# TASK-LEVEL INTEGRATION & VALIDATION (FAST)
<task_integration>
- Integrate the finished feature slice into the main app entry points (routes, providers, registries, DI containers).
- Run a **fast, targeted** validation for the task (local typecheck of affected scope; quick build; tiny smoke run). Keep it under minutes.
- If failures persist after a short fix window, open a follow-up task and proceed.
- Append a brief **Task Report** to `__AGENT__/AGENT_METRICS.md` (acceptance satisfied, risks, next steps).
</task_integration>

# NO-STUBS + NO-MINIMAL/EXAMPLE (STRICT)
<no_stubs_no_minimal>
- Never produce placeholders, stubs, or “example/demo/toy/minimal reproduction” code unless explicitly asked.
- Enforce completeness:
  - Strongly typed public APIs; necessary validation; core logic implemented; errors/edges handled.
  - All submodules exist (types/utils/services/hooks/config).
  - Usage snippet + inline docs where non-obvious.
- **Anti-minimal scan**: After writing files, search for giveaway markers and immediately upgrade to full implementations.
</no_stubs_no_minimal>

# REDUNDANCY CONTROL
<redundancy_control>
- Before starting a subtask, check if files overlap with previous subtasks in the same task:
  - If overlap > 2 files, consolidate into one subtask or reorder to minimize back-and-forth edits.
- Avoid repo-wide formatting; limit to changed files to reduce diff noise.
</redundancy_control>

# CURSOR SETTINGS & TOOLS (PRACTICAL)
<cursor_settings>
- Prefer **Auto-Run** and **Auto-Fix** for task-level validation and final verification when available; otherwise emulate with manual scripts.
- Use Terminal/Web tools **only when necessary** to unblock; keep usage minimal and scoped.
- Respect policy for dependency changes, remote state, CI/CD edits (ask-first).
</cursor_settings>

# TODO SYNC & QUEUE
<todo_sync>
- Keep Cursor To-Do, `__AGENT__/AGENT_TASKS.yaml`, and `specs/tasks.md` in sync.
- Mark To-Do items done as subtasks finish; update statuses without pausing.
- Maintain ordered execution; do not interleave unrelated actions.
</todo_sync>

# CONTEXT DISCIPLINE
<context>
- Generate `__AGENT__/context/index.md` each session with top APIs/snippets, active tasks, and fresh decisions.
- Maintain `.cursorignore` / `.cursorindexignore` to exclude noise (node_modules, build artifacts, large datasets).
</context>

# REFLEXIVE LEARNING
<reflexion>
- After each task: write 3–6 lines to `AGENT_MEMORY.md`; distill one rule into `AGENT_DECISIONS.md`.
</reflexion>

# VERIFICATION PASS (ONE-SHOT)
<verification_pass>
- At milestone/project end: run typecheck → lint/format → unit tests → minimal e2e smoke. Fix efficiently and write the **Verification Report** to `AGENT_METRICS.md`.
</verification_pass>
