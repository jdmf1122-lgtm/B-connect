-- Run this in the Supabase SQL Editor for project chyayvzwsqihedopjqqh
-- Fixes: (1) anon + authenticated table/RLS access, (2) missing LGU escalation columns, (3) storage & realtime

-- 1. Ensure anon and authenticated roles have table privileges in public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.cases, public.audit_logs, public.notifications TO anon, authenticated;

-- 2. Add missing LGU escalation columns on public.cases before indexing them
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "isEscalatedToLgu" BOOLEAN DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationReason" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationSmsDelivered" BOOLEAN DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationSmsBody" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationSmsRecipient" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationSmsRecipientPhone" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "escalationElapsedStr" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "lguActionTaken" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "lguInterventionNotes" TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "lguActionDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS "lguActionPersonnel" TEXT;

CREATE INDEX IF NOT EXISTS idx_cases_barangay ON public.cases (barangay);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_date_created ON public.cases ("dateCreated" DESC);
CREATE INDEX IF NOT EXISTS idx_cases_is_escalated ON public.cases ("isEscalatedToLgu");

-- 3. Drop any legacy/conflicting RLS policies on public tables, then apply anon + authenticated policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'cases', 'audit_logs', 'notifications')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and authenticated to read users" ON public.users
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon and authenticated to insert users" ON public.users
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to update users" ON public.users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to delete users" ON public.users
  FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and authenticated to read cases" ON public.cases
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon and authenticated to insert cases" ON public.cases
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to update cases" ON public.cases
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to delete cases" ON public.cases
  FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and authenticated to read audit_logs" ON public.audit_logs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon and authenticated to insert audit_logs" ON public.audit_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and authenticated to read notifications" ON public.notifications
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon and authenticated to insert notifications" ON public.notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to update notifications" ON public.notifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon and authenticated to delete notifications" ON public.notifications
  FOR DELETE TO anon, authenticated USING (true);

-- 4. Storage bucket and policies for report-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-images', 'report-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public to read report images" ON storage.objects;
CREATE POLICY "Allow public to read report images" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-images');

DROP POLICY IF EXISTS "Allow authenticated to upload report images" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon and authenticated to upload report images" ON storage.objects;
CREATE POLICY "Allow anon and authenticated to upload report images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'report-images');

DROP POLICY IF EXISTS "Allow anon and authenticated to update report images" ON storage.objects;
CREATE POLICY "Allow anon and authenticated to update report images" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'report-images');

-- 5. Realtime publication & replica identity
ALTER TABLE public.cases REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;

-- 6. Refresh PostgREST schema cache so new columns are immediately visible
NOTIFY pgrst, 'reload schema';
