-- Phase 9: Production Tracking
-- Add tracking fields to production_plans for real-time execution tracking

ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS actual_start timestamptz;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS actual_end timestamptz;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS actual_batch integer;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS line_number integer;
