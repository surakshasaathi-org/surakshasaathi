-- 0014_analysis_status_digitizing.sql
-- Adds 'digitizing' to analysis_status enum for the new Stage-0
-- policy-digitizer agent. Inserted before 'ocr_running' to reflect actual
-- pipeline order. Idempotent — safe to re-run.

ALTER TYPE "analysis_status" ADD VALUE IF NOT EXISTS 'digitizing' BEFORE 'ocr_running';
