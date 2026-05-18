-- 0010 — Readiness score schema + admin audit log
-- Adds three new tables and one column to app_user. All DDL is idempotent so
-- this migration is safe to re-run against a partially-applied DB.

CREATE TABLE IF NOT EXISTS "readiness_rule" (
  "slug"       text    NOT NULL,
  "version"    integer NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "rules_json" jsonb   NOT NULL,
  "notes"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "readiness_rule_slug_version_idx"
  ON "readiness_rule" USING btree ("slug", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readiness_rule_default_idx"
  ON "readiness_rule" USING btree ("slug", "is_default");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "policy_score" (
  "id"               uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"        text         NOT NULL,
  "analysis_id"      uuid         NOT NULL,
  "user_id"          uuid,
  "rules_slug"       text         NOT NULL,
  "rules_version"    integer      NOT NULL,
  "total_score"      integer      NOT NULL,
  "denominator"      integer      NOT NULL,
  "band"             text         NOT NULL,
  "out_of_pocket_pct" numeric(4, 1) NOT NULL,
  "gap_count"        integer      NOT NULL,
  "components"       jsonb        NOT NULL,
  "is_internal"      boolean      NOT NULL DEFAULT true,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "policy_score_analysis_idx"
  ON "policy_score" USING btree ("analysis_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_score_user_idx"
  ON "policy_score" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_score_rules_idx"
  ON "policy_score" USING btree ("rules_slug", "rules_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_score_band_idx"
  ON "policy_score" USING btree ("band");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id"           uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id"     uuid,
  "entity"       text    NOT NULL,
  "entity_id"    text    NOT NULL,
  "action"       text    NOT NULL,
  "from_version" integer,
  "to_version"   integer,
  "metadata"     jsonb,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_entity_idx"
  ON "admin_audit_log" USING btree ("entity", "entity_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_idx"
  ON "admin_audit_log" USING btree ("actor_id", "created_at");
--> statement-breakpoint

-- App user personalisation signal for readiness score. Defaults to empty
-- object so the scorer can always dereference without null-check.
ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "scoring_profile_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
