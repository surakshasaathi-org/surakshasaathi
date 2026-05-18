CREATE TYPE "public"."agent_run_outcome" AS ENUM('success', 'low_confidence', 'tool_error', 'timeout', 'refused');--> statement-breakpoint
CREATE TYPE "public"."auth_level" AS ENUM('anonymous', 'registered', 'paid', 'aadhaar_ekyc', 'b2b_admin');--> statement-breakpoint
CREATE TYPE "public"."case_kind" AS ENUM('claim_rejection', 'mis_selling', 'unclaimed_recovery', 'scheme_refusal', 'advisory');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('draft', 'intake', 'triaged', 'docs_needed', 'drafting', 'awaiting_review', 'filed', 'awaiting_insurer', 'escalated_ombudsman', 'escalated_consumer_court', 'resolved_in_favour', 'resolved_against', 'withdrawn', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."cluster" AS ENUM('claims', 'advisory', 'new_segment');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('policy_document', 'rejection_letter', 'hospital_bill', 'discharge_summary', 'bank_statement', 'proposal_form', 'kyc_document', 'ombudsman_filing', 'grievance_letter', 'scheme_card', 'death_certificate', 'nominee_document', 'other');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'hi', 'kn', 'ta', 'te', 'bn', 'mr', 'gu', 'ml', 'pa', 'or', 'as', 'ur');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('opus', 'sonnet', 'haiku');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('concept', 'skeleton', 'beta', 'live', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'refunded', 'failed', 'cancelled', 'held_in_escrow', 'released_from_escrow');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('free', 'freemium', 'subscription', 'success_fee', 'affiliate', 'b2b');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'admin', 'case_manager', 'content_editor', 'cx_agent', 'viewer', 'reviewer', 'member', 'partner_admin');--> statement-breakpoint
CREATE TYPE "public"."scheme_level" AS ENUM('central', 'state');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tenant_kind" AS ENUM('b2c', 'ngo', 'hr', 'csc', 'broker', 'state_gov', 'partner');--> statement-breakpoint
CREATE TYPE "public"."analysis_status" AS ENUM('queued', 'ocr_running', 'intake_running', 'extracting', 'analysing', 'translating', 'reviewing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text,
	"email" text,
	"display_name" text,
	"preferred_locale" "locale",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" "tenant_kind" DEFAULT 'b2c' NOT NULL,
	"default_locale" "locale" DEFAULT 'en' NOT NULL,
	"enabled_modules" text[] DEFAULT '{}' NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insurance_line" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name_i18n" jsonb NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_flow" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"version" integer NOT NULL,
	"steps" jsonb NOT NULL,
	"routing_agent_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locale_meta" (
	"code" "locale" PRIMARY KEY NOT NULL,
	"native_name" text NOT NULL,
	"english_name" text NOT NULL,
	"script_family" text NOT NULL,
	"rtl" boolean DEFAULT false NOT NULL,
	"launch_phase" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_module" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" "cluster" NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"tagline_i18n" jsonb NOT NULL,
	"hero_headline_i18n" jsonb NOT NULL,
	"hero_subhead_i18n" jsonb NOT NULL,
	"landing_route" text NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"auth_required" "auth_level" NOT NULL,
	"launch_locales" text[] DEFAULT '{}' NOT NULL,
	"status" "module_status" DEFAULT 'concept' NOT NULL,
	"intake_flow_id" text,
	"agent_definition_ids" text[] DEFAULT '{}' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"icon_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheme" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"level" "scheme_level" NOT NULL,
	"state_code" text,
	"name_i18n" jsonb NOT NULL,
	"summary_i18n" jsonb NOT NULL,
	"eligibility_rules" jsonb NOT NULL,
	"coverage_paise" integer,
	"line_ids" text[] DEFAULT '{}' NOT NULL,
	"application_channels" text[] DEFAULT '{}' NOT NULL,
	"version" integer NOT NULL,
	"effective_from" date NOT NULL,
	"deprecated_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_kind" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_visible" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"kind" "case_kind" NOT NULL,
	"status" "case_status" DEFAULT 'intake' NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"amount_claimed_paise" integer,
	"amount_recovered_paise" integer,
	"insurer_name" text,
	"policy_id" uuid,
	"assigned_to" uuid,
	"deadline_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"uploader_user_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"storage_path" text NOT NULL,
	"content_sha256" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"ocr_status" "ocr_status" DEFAULT 'pending' NOT NULL,
	"ocr_text" text,
	"extracted" jsonb,
	"case_id" uuid,
	"policy_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"line_id" text NOT NULL,
	"insurer_name" text NOT NULL,
	"policy_number" text NOT NULL,
	"sum_assured" integer,
	"premium" integer,
	"start_date" date,
	"end_date" date,
	"nominee_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_definition" (
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"display_name" text NOT NULL,
	"purpose" text NOT NULL,
	"model_tier" "model_tier" NOT NULL,
	"system_prompt" text NOT NULL,
	"tools" text[] DEFAULT '{}' NOT NULL,
	"temperature" real DEFAULT 0.2 NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"locales_supported" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid,
	"case_id" uuid,
	"agent_slug" text NOT NULL,
	"agent_version" integer NOT NULL,
	"parent_run_id" uuid,
	"input_summary" text NOT NULL,
	"attached_document_ids" uuid[] DEFAULT '{}' NOT NULL,
	"output_json" jsonb,
	"confidence" real,
	"outcome" "agent_run_outcome" NOT NULL,
	"model_used" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"cost_paise" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"user_visible_summary" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"case_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"decision" jsonb,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_click" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid,
	"partner_slug" text NOT NULL,
	"source_module_id" text,
	"source_url" text,
	"destination_url" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_at" timestamp with time zone,
	"conversion_value_paise" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_partner" (
	"slug" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"destination_url_template" text NOT NULL,
	"commission_model" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"line_ids" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"tier" "pricing_model" NOT NULL,
	"auth" "auth_level" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"source_payment_id" uuid,
	"source_subscription_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flag" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"enabled_for_all" boolean DEFAULT false NOT NULL,
	"enabled_tenants" text[] DEFAULT '{}' NOT NULL,
	"enabled_roles" "role"[] DEFAULT '{}' NOT NULL,
	"enabled_user_ids" uuid[] DEFAULT '{}' NOT NULL,
	"variants" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"scope" text NOT NULL,
	"case_id" uuid,
	"subscription_id" uuid,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_slug" text NOT NULL,
	"razorpay_subscription_id" text NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'created' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"source_ip" text,
	"user_agent" text,
	"policy_version" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpdp_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"assigned_to" uuid,
	"rejection_reason" text,
	"fulfilled_payload_path" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"locale" text NOT NULL,
	"status" "analysis_status" DEFAULT 'queued' NOT NULL,
	"progress_step" text,
	"report_json" jsonb,
	"readiness_score" integer,
	"readiness_components" jsonb,
	"red_flags_count" integer,
	"confidence_overall" real,
	"agent_run_ids" uuid[] DEFAULT '{}' NOT NULL,
	"cost_paise" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"content_sha256" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer,
	"ocr_status" "ocr_status" DEFAULT 'pending' NOT NULL,
	"ocr_text" text,
	"ocr_pages" jsonb,
	"extracted" jsonb,
	"extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership" ADD CONSTRAINT "membership_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_flow" ADD CONSTRAINT "intake_flow_module_id_product_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."product_module"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case" ADD CONSTRAINT "case_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case" ADD CONSTRAINT "case_module_id_product_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."product_module"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document" ADD CONSTRAINT "document_uploader_user_id_app_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy" ADD CONSTRAINT "policy_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy" ADD CONSTRAINT "policy_line_id_insurance_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."insurance_line"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_task" ADD CONSTRAINT "review_task_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click" ADD CONSTRAINT "affiliate_click_partner_slug_affiliate_partner_slug_fk" FOREIGN KEY ("partner_slug") REFERENCES "public"."affiliate_partner"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_analysis" ADD CONSTRAINT "policy_analysis_document_id_policy_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."policy_document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_user_phone_idx" ON "app_user" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_user_email_idx" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "membership_tenant_user_idx" ON "membership" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_tenant_idx" ON "membership" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_user_idx" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "intake_flow_module_version_idx" ON "intake_flow" USING btree ("module_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_module_status_idx" ON "product_module" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_module_order_idx" ON "product_module" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheme_slug_idx" ON "scheme" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheme_state_idx" ON "scheme" USING btree ("state_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheme_slug_version_idx" ON "scheme" USING btree ("slug","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_event_case_idx" ON "case_event" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_user_idx" ON "case" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_tenant_idx" ON "case" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_status_idx" ON "case" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_deadline_idx" ON "case" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_assigned_idx" ON "case" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_case_idx" ON "document" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_user_idx" ON "document" USING btree ("uploader_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_sha_idx" ON "document" USING btree ("content_sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_user_idx" ON "policy" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_tenant_idx" ON "policy" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_line_idx" ON "policy" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_definition_slug_version_idx" ON "agent_definition" USING btree ("slug","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_definition_default_idx" ON "agent_definition" USING btree ("slug","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_case_idx" ON "agent_run" USING btree ("case_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_tenant_idx" ON "agent_run" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_agent_idx" ON "agent_run" USING btree ("agent_slug","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_task_status_idx" ON "review_task" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_task_assignee_idx" ON "review_task" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_click_partner_idx" ON "affiliate_click" USING btree ("partner_slug","clicked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_user_idx" ON "entitlement" USING btree ("user_id","active","scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_tenant_idx" ON "entitlement" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_user_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_case_idx" ON "payment" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_razorpay_order_idx" ON "payment" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_user_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_user_idx" ON "consent" USING btree ("user_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpdp_request_status_idx" ON "dpdp_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpdp_request_user_idx" ON "dpdp_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_analysis_status_idx" ON "policy_analysis" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_analysis_expiry_idx" ON "policy_analysis" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_analysis_token_idx" ON "policy_analysis" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_document_expiry_idx" ON "policy_document" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_document_sha_idx" ON "policy_document" USING btree ("content_sha256");