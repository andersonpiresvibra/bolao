-- =============================================================================
-- MIGRAÇÃO INCREMENTAL OPCIONAL — PRODUÇÃO ASAAS & HARDENING
-- Seguro para rodar no SQL Editor do Supabase sobre as 19 tabelas existentes.
-- Totalmente idempotente (usa IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
-- =============================================================================

-- 1. Cache do ID de cliente Asaas no perfil (evita consultas GET /customers repetidas)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer
  ON public.profiles (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- 2. Campos extras de QR Code Pix na tabela quota_purchases
ALTER TABLE public.quota_purchases
  ADD COLUMN IF NOT EXISTS pix_encoded_image TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ;

-- 3. Tabela de idempotência e trilha de auditoria para webhooks do Asaas
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id      TEXT UNIQUE NOT NULL,
  event_type          TEXT NOT NULL,
  asaas_payment_id    TEXT,
  external_reference  TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL DEFAULT 'PROCESSED'
                      CHECK (status IN ('PROCESSED', 'IGNORED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_payment
  ON public.asaas_webhook_events (asaas_payment_id);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Apenas service_role / SUPER_ADMIN acessam eventos brutos de webhook
DROP POLICY IF EXISTS "asaas_webhook_events_admin_read" ON public.asaas_webhook_events;
CREATE POLICY "asaas_webhook_events_admin_read"
  ON public.asaas_webhook_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN'
    )
  );

-- 4. Tabela de rateio/pagamento de prêmios por participante (pool_payouts)
CREATE TABLE IF NOT EXISTS public.pool_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id             UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  participant_id      UUID REFERENCES public.pool_participants(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_name    TEXT NOT NULL,
  participant_pix_key TEXT NOT NULL DEFAULT '',
  quotas_count        INTEGER NOT NULL CHECK (quotas_count > 0),
  share_percent       NUMERIC(7,4) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  gross_prize_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  payout_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  payout_status       TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (payout_status IN ('PENDING', 'TRANSFERRED', 'CANCELLED')),
  asaas_transfer_id   TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_payouts_pool
  ON public.pool_payouts (pool_id, payout_status);

ALTER TABLE public.pool_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pool_payouts_member_read" ON public.pool_payouts;
CREATE POLICY "pool_payouts_member_read"
  ON public.pool_payouts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = pool_payouts.company_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools pl
      WHERE pl.id = pool_payouts.pool_id AND pl.creator_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN'
    )
  );

-- 5. Hardening de upload de logos: bloquear SVG (apenas PNG, JPEG e WEBP)
ALTER TABLE public.pool_logo_assets
  DROP CONSTRAINT IF EXISTS pool_logo_assets_mime_type_check;

ALTER TABLE public.pool_logo_assets
  ADD CONSTRAINT pool_logo_assets_mime_type_check
  CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp'));

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'pool-logos';

-- 6. Tabela de assinaturas Web Push (notificações em segundo plano por dispositivo)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT NOT NULL,
  auth_key    TEXT NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_self_manage" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_self_manage"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

