-- 0015_agent_provider_model_override.sql
-- Per-agent provider + model override, settable from the admin editor.
-- Both nullable: null on `provider` defaults to 'gemini' at runtime; null
-- on `model_override` falls back to the modelTier → models mapping.
-- Idempotent — safe to re-run.

ALTER TABLE "agent_definition"
  ADD COLUMN IF NOT EXISTS "provider" text;

ALTER TABLE "agent_definition"
  ADD COLUMN IF NOT EXISTS "model_override" text;
