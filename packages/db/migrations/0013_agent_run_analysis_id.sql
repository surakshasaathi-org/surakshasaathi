-- 0013_agent_run_analysis_id.sql
-- Adds policy_analysis.id linkage to agent_run so the admin UI can list
-- every run that contributed to a given analysis without time-window
-- heuristics. Nullable for cases-only / eval-lab runs.

ALTER TABLE "agent_run"
  ADD COLUMN IF NOT EXISTS "analysis_id" uuid;

CREATE INDEX IF NOT EXISTS "agent_run_analysis_idx"
  ON "agent_run" ("analysis_id", "started_at");
