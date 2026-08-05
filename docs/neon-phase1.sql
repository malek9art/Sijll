-- سجل — Neon Auth / Data API (المرحلة الأولى)
-- نفّذ هذا الملف يدوياً في Neon SQL Editor بعد تفعيل Neon Auth وData API.
-- لا يحتوي على بيانات المستخدمين أو العمليات؛ تلك تبقى محلية في IndexedDB في هذا الإصدار.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sijll_user_crypto_keys (
  user_id TEXT PRIMARY KEY DEFAULT auth.user_id(),
  key_material TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sijll_backup_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT auth.user_id(),
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  checksum TEXT,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_restored_at TIMESTAMPTZ
);

ALTER TABLE public.sijll_user_crypto_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sijll_backup_catalog ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sijll_user_crypto_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sijll_backup_catalog TO authenticated;

DROP POLICY IF EXISTS sijll_crypto_key_owner ON public.sijll_user_crypto_keys;
CREATE POLICY sijll_crypto_key_owner ON public.sijll_user_crypto_keys
  FOR ALL TO authenticated
  USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

DROP POLICY IF EXISTS sijll_backup_catalog_owner ON public.sijll_backup_catalog;
CREATE POLICY sijll_backup_catalog_owner ON public.sijll_backup_catalog
  FOR ALL TO authenticated
  USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE INDEX IF NOT EXISTS idx_sijll_backup_catalog_user_created
  ON public.sijll_backup_catalog (user_id, created_at DESC);

-- بعد تعديل المخطط: حدّث Schema Cache من صفحة Data API في Neon Console.
