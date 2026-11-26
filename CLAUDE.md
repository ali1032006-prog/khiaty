# Khiaty

See README.md for the stack and how to run it.

## Verification (required on every PR)

Prove every user-facing change with the `verify-khiaty` skill (`.claude/skills/verify-khiaty/SKILL.md`):
run `launch.sh`, `doctor.sh`, `drive.sh <journey>`, then `cleanup.sh`, from
`.claude/skills/verify-khiaty/scripts/`, with the repo root as the working directory. It runs on a throwaway local Postgres and a local Supabase Auth stand-in, never the live
Supabase project. List each scenario with PASS/FAIL and its `.verify-evidence/` screenshots in the PR.
If you add or change a screen, update the journey in `scripts/drive.mjs` and its file in `features/` in
the same PR. Storage, Realtime and RLS are not covered: see "What this cannot prove" in the skill.
