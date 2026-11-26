-- ============================================================================
-- BOLÃO & LOTERIAS — ESQUEMA COMPLETO PARA SUPABASE (PostgreSQL 15+)
-- ============================================================================
-- Inclui:
--   1. Extensões e ENUMs oficiais das 10 loterias Caixa e fluxos do app
--   2. Perfis de usuários (integrado ao Supabase Auth) e Espaço Pessoal
--      (Dezenas Favoritas, Jogos Favoritos, Meus Jogos: Elaborados/Confirmados/Realizados)
--   3. Grupos Corporativos, Bolões Gerais e Tabelas Específicas para
--      BOLÕES PARTICULARES (criados por qualquer usuário cadastrado)
--   4. Esquema Completo de LAYOUT E LOGOTIPO para Bolões + Supabase Storage
--   5. Participantes, Compras de Cotas Pix com Split (Asaas), Volantes Oficiais,
--      Sugestões com Votação Única, Auditoria Imutável e Cache de Sorteios Caixa
--   6. Triggers automáticos, Views de resumo e Row Level Security (RLS)
--
-- Como usar no Supabase:
--   SQL Editor -> New query -> cole este arquivo inteiro -> Run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_type_enum') THEN
    CREATE TYPE public.lottery_type_enum AS ENUM (
      'MEGA_SENA',
      'LOTOFACIL',
      'QUINA',
      'LOTOMANIA',
      'TIMEMANIA',
      'DUPLA_SENA',
      'DIA_DE_SORTE',
      'SUPER_SETE',
      'MAIS_MILIONARIA',
      'LOTECA'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_mode_enum') THEN
    CREATE TYPE public.contest_mode_enum AS ENUM ('REGULAR', 'SPECIAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE public.user_role_enum AS ENUM ('COLLABORATOR', 'MANAGER', 'SUPER_ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pool_category_enum') THEN
    CREATE TYPE public.pool_category_enum AS ENUM ('PRIVATE_USER', 'CORPORATE_GROUP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pool_visibility_enum') THEN
    CREATE TYPE public.pool_visibility_enum AS ENUM ('PRIVATE', 'INVITE_ONLY', 'CORPORATE', 'PUBLIC');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collection_mode_enum') THEN
    CREATE TYPE public.collection_mode_enum AS ENUM ('FIXED_QUOTA', 'MAX_TARGET');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pool_status_enum') THEN
    CREATE TYPE public.pool_status_enum AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'DRAWN', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE public.payment_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'OVERDUE', 'REFUNDED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode_enum') THEN
    CREATE TYPE public.game_mode_enum AS ENUM ('SIMPLES', 'DESDOBRAMENTO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'effective_game_status_enum') THEN
    CREATE TYPE public.effective_game_status_enum AS ENUM ('ELABORADO', 'A_FAZER', 'FEITO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_enum') THEN
    CREATE TYPE public.audit_action_enum AS ENUM (
      'COMPANY_CREATED',
      'POOL_CREATED',
      'PRIVATE_POOL_CREATED',
      'POOL_BRANDING_UPDATED',
      'PARTICIPANT_REGISTERED',
      'PIX_GENERATED',
      'PIX_SPLIT_CONCILIATED',
      'GAME_REGISTERED',
      'SUGGESTION_CREATED',
      'RESULT_AUDITED',
      'SETTINGS_UPDATED'
    );
  END IF;
END $$;

-- ============================================================================
-- 2. FUNÇÃO UTILITÁRIA DE UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. CONFIGURAÇÕES GLOBAIS DA PLATAFORMA (SPLIT / ASAAS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  default_platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3.50 CHECK (default_platform_fee_percent >= 0 AND default_platform_fee_percent <= 30),
  platform_asaas_wallet_id TEXT NOT NULL DEFAULT '',
  asaas_environment TEXT NOT NULL DEFAULT 'SANDBOX' CHECK (asaas_environment IN ('SANDBOX', 'PRODUCTION')),
  asaas_webhook_active BOOLEAN NOT NULL DEFAULT FALSE,
  master_organizer_name TEXT NOT NULL DEFAULT 'Administrador',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. USUÁRIOS / PERFIS E ESPAÇO PESSOAL (INTEGRADO AO SUPABASE AUTH)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  cpf TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  whatsapp TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  job_title TEXT NOT NULL DEFAULT 'Usuário',
  pix_key TEXT DEFAULT '',
  avatar_initials VARCHAR(4) NOT NULL DEFAULT 'US',
  avatar_url TEXT,
  role public.user_role_enum NOT NULL DEFAULT 'COLLABORATOR',
  monthly_spending_limit NUMERIC(12,2) NOT NULL DEFAULT 300.00 CHECK (monthly_spending_limit >= 0),
  favorite_lotteries public.lottery_type_enum[] NOT NULL DEFAULT ARRAY['MEGA_SENA']::public.lottery_type_enum[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dezenas favoritas por usuário e modalidade
CREATE TABLE IF NOT EXISTS public.user_favorite_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lottery_type public.lottery_type_enum NOT NULL,
  numbers SMALLINT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_fav_numbers UNIQUE (user_id, lottery_type)
);

CREATE TRIGGER trg_user_fav_numbers_updated_at
BEFORE UPDATE ON public.user_favorite_numbers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Jogos favoritos salvos pelo usuário
CREATE TABLE IF NOT EXISTS public.user_favorite_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lottery_type public.lottery_type_enum NOT NULL,
  numbers SMALLINT[] NOT NULL CHECK (cardinality(numbers) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_games_user ON public.user_favorite_games(user_id, lottery_type);

-- Meus Jogos pessoais (Elaborados, Confirmados = A_FAZER, Realizados = FEITO, Conferidor)
CREATE TABLE IF NOT EXISTS public.user_effective_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lottery_type public.lottery_type_enum NOT NULL,
  contest_mode public.contest_mode_enum NOT NULL DEFAULT 'REGULAR',
  contest_number TEXT NOT NULL,
  numbers SMALLINT[] NOT NULL CHECK (cardinality(numbers) >= 1),
  cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status public.effective_game_status_enum NOT NULL DEFAULT 'ELABORADO',
  loterica_receipt_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_effective_games_user_status
  ON public.user_effective_games(user_id, status, lottery_type);

CREATE TRIGGER trg_user_effective_games_updated_at
BEFORE UPDATE ON public.user_effective_games
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger automático ao criar conta no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_initials TEXT;
BEGIN
  v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''), split_part(NEW.email, '@', 1));
  v_initials := UPPER(LEFT(REGEXP_REPLACE(v_name, '[^a-zA-ZÀ-ÿ]', '', 'g'), 2));
  IF LENGTH(v_initials) < 2 THEN
    v_initials := 'US';
  END IF;

  INSERT INTO public.profiles (
    id, name, username, cpf, email, whatsapp, company_name, job_title, pix_key, avatar_initials
  )
  VALUES (
    NEW.id,
    v_name,
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'cpf'), ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'job_title'), ''), 'Usuário'),
    COALESCE(NEW.raw_user_meta_data ->> 'pix_key', ''),
    v_initials
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 5. GRUPOS / EMPRESAS DE BOLÃO (CORPORATIVOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cnpj TEXT DEFAULT '00.000.000/0001-00',
  segment TEXT DEFAULT '',
  logo_initials VARCHAR(4) NOT NULL DEFAULT 'BL',
  logo_color VARCHAR(20) NOT NULL DEFAULT '#005CA9',
  logo_url TEXT,
  manager_name TEXT NOT NULL,
  manager_role TEXT DEFAULT 'Organizador',
  manager_pix_key TEXT DEFAULT '',
  manager_cpf TEXT DEFAULT '',
  manager_email TEXT DEFAULT '',
  manager_whatsapp TEXT DEFAULT '',
  asaas_wallet_id TEXT DEFAULT '',
  city_state TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_user_id);

CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. BOLÕES (ENTIDADE PRINCIPAL: SUPORTA BOLÕES PARTICULARES E CORPORATIVOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  category public.pool_category_enum NOT NULL DEFAULT 'PRIVATE_USER',
  visibility public.pool_visibility_enum NOT NULL DEFAULT 'PRIVATE',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  lottery_type public.lottery_type_enum NOT NULL DEFAULT 'MEGA_SENA',
  contest_mode public.contest_mode_enum NOT NULL DEFAULT 'REGULAR',
  contest_number TEXT NOT NULL,
  collection_mode public.collection_mode_enum NOT NULL DEFAULT 'FIXED_QUOTA',
  quota_value NUMERIC(12,2) NOT NULL CHECK (quota_value > 0),
  max_target_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (max_target_amount >= 0),
  max_quotas INTEGER NOT NULL DEFAULT 9999 CHECK (max_quotas >= 1),
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3.50 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 30),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  status public.pool_status_enum NOT NULL DEFAULT 'OPEN',
  official_receipt_code TEXT,
  drawn_numbers SMALLINT[] NOT NULL DEFAULT '{}',
  prize_total_amount NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (prize_total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pools_creator ON public.pools(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_pools_company ON public.pools(company_id);
CREATE INDEX IF NOT EXISTS idx_pools_category_status ON public.pools(category, status, lottery_type);

CREATE TRIGGER trg_pools_updated_at
BEFORE UPDATE ON public.pools
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. TABELAS ESPECÍFICAS PARA BOLÕES PARTICULARES (CRIADOS POR QUALQUER USUÁRIO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.private_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL UNIQUE REFERENCES public.pools(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8)),
  invite_pin_hash TEXT, -- Opcional: hash via crypt('pin', gen_salt('bf')) para bolão com senha
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  allow_member_suggestions BOOLEAN NOT NULL DEFAULT TRUE,
  allow_member_voting BOOLEAN NOT NULL DEFAULT TRUE,
  max_participants INTEGER CHECK (max_participants IS NULL OR max_participants >= 2),
  max_quotas_per_user INTEGER CHECK (max_quotas_per_user IS NULL OR max_quotas_per_user >= 1),
  organizer_pix_key TEXT NOT NULL DEFAULT '',
  organizer_asaas_wallet_id TEXT DEFAULT '',
  custom_rules_text TEXT DEFAULT '',
  whatsapp_group_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_pools_owner ON public.private_pools(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_private_pools_invite_code ON public.private_pools(invite_code);

CREATE TRIGGER trg_private_pools_updated_at
BEFORE UPDATE ON public.private_pools
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Membros de cada bolão particular (dono, co-administradores e participantes)
CREATE TABLE IF NOT EXISTS public.private_pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_pool_id UUID NOT NULL REFERENCES public.private_pools(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (member_role IN ('OWNER', 'CO_ADMIN', 'MEMBER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'REMOVED')),
  nickname TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_private_pool_member UNIQUE (private_pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_private_pool_members_user ON public.private_pool_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_private_pool_members_pool ON public.private_pool_members(pool_id, status);

-- Convites individuais para bolões particulares (link direto, e-mail ou WhatsApp)
CREATE TABLE IF NOT EXISTS public.private_pool_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_pool_id UUID NOT NULL REFERENCES public.private_pools(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_contact TEXT, -- e-mail ou telefone/WhatsApp do convidado
  invite_token TEXT NOT NULL UNIQUE DEFAULT REPLACE(gen_random_uuid()::TEXT, '-', ''),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_pool_invites_pool ON public.private_pool_invites(private_pool_id, status);
CREATE INDEX IF NOT EXISTS idx_private_pool_invites_token ON public.private_pool_invites(invite_token);

-- Ao criar um private_pool, adiciona automaticamente o criador como OWNER em private_pool_members
CREATE OR REPLACE FUNCTION public.handle_new_private_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.private_pool_members (private_pool_id, pool_id, user_id, member_role, status)
  VALUES (NEW.id, NEW.pool_id, NEW.owner_user_id, 'OWNER', 'ACTIVE')
  ON CONFLICT (private_pool_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_private_pool_add_owner ON public.private_pools;
CREATE TRIGGER trg_private_pool_add_owner
AFTER INSERT ON public.private_pools
FOR EACH ROW EXECUTE FUNCTION public.handle_new_private_pool();

-- ============================================================================
-- 8. ESQUEMA DE LAYOUT E LOGOTIPO PARA BOLÕES (PERSONALIZAÇÃO VISUAL DO CRIADOR)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pool_branding_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL UNIQUE REFERENCES public.pools(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Logotipo personalizado do bolão (upload no Supabase Storage ou URL)
  logo_storage_path TEXT,
  logo_url TEXT,
  logo_initials VARCHAR(4) DEFAULT 'BL',
  logo_shape TEXT NOT NULL DEFAULT 'ROUNDED'
    CHECK (logo_shape IN ('CIRCLE', 'ROUNDED', 'SQUARE', 'SHIELD')),
  logo_bg_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  logo_fit TEXT NOT NULL DEFAULT 'CONTAIN'
    CHECK (logo_fit IN ('CONTAIN', 'COVER')),

  -- Capa / Banner e Arte de Fundo do Bolão
  cover_storage_path TEXT,
  cover_image_url TEXT,
  background_pattern TEXT NOT NULL DEFAULT 'GEOMETRIC'
    CHECK (background_pattern IN ('NONE', 'GEOMETRIC', 'SPHERES', 'CONFETTI', 'STRIPES', 'WAVES')),

  -- Layout e Identidade Visual do Card / Página do Bolão
  layout_template TEXT NOT NULL DEFAULT 'CLASSIC_CARD'
    CHECK (layout_template IN ('CLASSIC_CARD', 'SQUARE_HERO', 'BANNER_MODERN', 'MINIMAL_CLEAN', 'FESTIVE_SPECIAL')),
  header_style TEXT NOT NULL DEFAULT 'GRADIENT'
    CHECK (header_style IN ('SOLID', 'GRADIENT', 'WHITE_NEUTRAL', 'IMAGE_COVER')),
  primary_color VARCHAR(20) NOT NULL DEFAULT '#005CA9',
  secondary_color VARCHAR(20) NOT NULL DEFAULT '#008B47',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#F59E0B',
  surface_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  text_color VARCHAR(20) NOT NULL DEFAULT '#0F172A',
  card_border_radius SMALLINT NOT NULL DEFAULT 12 CHECK (card_border_radius BETWEEN 0 AND 32),

  -- Textos de Destaque e Opções de Exibição no Layout
  badge_text VARCHAR(40),
  tagline VARCHAR(140),
  show_prize_highlight BOOLEAN NOT NULL DEFAULT TRUE,
  show_participants_count BOOLEAN NOT NULL DEFAULT TRUE,
  show_progress_bar BOOLEAN NOT NULL DEFAULT TRUE,

  -- Campo JSONB extensível para opções futuras de layout (fontes, gradientes customizados, posições)
  custom_theme_json JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_branding_owner ON public.pool_branding_layouts(owner_user_id);

CREATE TRIGGER trg_pool_branding_updated_at
BEFORE UPDATE ON public.pool_branding_layouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Biblioteca de logotipos e imagens enviadas pelos usuários (reutilizável entre bolões)
CREATE TABLE IF NOT EXISTS public.pool_logo_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES public.pools(id) ON DELETE SET NULL,
  asset_kind TEXT NOT NULL DEFAULT 'LOGO' CHECK (asset_kind IN ('LOGO', 'COVER', 'RECEIPT')),
  storage_bucket TEXT NOT NULL DEFAULT 'pool-logos',
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880), -- Máx 5MB
  width_px INTEGER,
  height_px INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_logo_assets_owner ON public.pool_logo_assets(owner_user_id, asset_kind);

-- Ao criar qualquer bolão, cria automaticamente um registro padrão de layout/branding
CREATE OR REPLACE FUNCTION public.handle_new_pool_branding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initials TEXT;
BEGIN
  v_initials := UPPER(LEFT(REGEXP_REPLACE(NEW.title, '[^a-zA-ZÀ-ÿ]', '', 'g'), 2));
  IF LENGTH(v_initials) < 2 THEN
    v_initials := 'BL';
  END IF;

  INSERT INTO public.pool_branding_layouts (pool_id, owner_user_id, logo_initials)
  VALUES (NEW.id, NEW.creator_user_id, v_initials)
  ON CONFLICT (pool_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pool_create_default_branding ON public.pools;
CREATE TRIGGER trg_pool_create_default_branding
AFTER INSERT ON public.pools
FOR EACH ROW EXECUTE FUNCTION public.handle_new_pool_branding();

-- ============================================================================
-- 9. PARTICIPANTES, COTAS PIX + SPLIT, VOLANTES, PALPITES E AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pool_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  department TEXT DEFAULT 'Participante',
  pix_key TEXT DEFAULT '',
  registered_by TEXT NOT NULL DEFAULT 'SELF' CHECK (registered_by IN ('SELF', 'MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pool_participant_cpf UNIQUE (pool_id, cpf)
);

CREATE INDEX IF NOT EXISTS idx_pool_participants_pool ON public.pool_participants(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_participants_user ON public.pool_participants(user_id);

CREATE TABLE IF NOT EXISTS public.quota_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES public.pool_participants(id) ON DELETE SET NULL,
  buyer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Snapshot imutável dos dados do comprador no momento da compra
  participant_name TEXT NOT NULL,
  participant_cpf TEXT NOT NULL,
  participant_email TEXT DEFAULT '',
  participant_whatsapp TEXT DEFAULT '',
  participant_role TEXT DEFAULT '',
  participant_pix_key TEXT DEFAULT '',

  -- Valores financeiros e Split Asaas
  quotas_count INTEGER NOT NULL CHECK (quotas_count >= 1),
  unit_quota_value NUMERIC(12,2) NOT NULL CHECK (unit_quota_value > 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3.50,
  platform_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_pool_amount NUMERIC(14,2) NOT NULL CHECK (net_pool_amount >= 0),
  organizer_wallet_id TEXT DEFAULT '',
  asaas_payment_id TEXT UNIQUE,
  pix_qr_code_payload TEXT,
  payment_status public.payment_status_enum NOT NULL DEFAULT 'PENDING',
  coupon_hash TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quota_purchases_pool_status ON public.quota_purchases(pool_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_quota_purchases_buyer ON public.quota_purchases(buyer_user_id);

-- Volantes oficiais registrados no bolão
CREATE TABLE IF NOT EXISTS public.pool_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lottery_type public.lottery_type_enum NOT NULL,
  game_mode public.game_mode_enum NOT NULL DEFAULT 'SIMPLES',
  numbers SMALLINT[] NOT NULL CHECK (cardinality(numbers) >= 1),
  dozens_count SMALLINT NOT NULL CHECK (dozens_count >= 1),
  equivalent_simple_bets INTEGER NOT NULL DEFAULT 1 CHECK (equivalent_simple_bets >= 1),
  cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  loterica_receipt_code TEXT NOT NULL,
  author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_avatar VARCHAR(4) DEFAULT 'OR',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_games_pool ON public.pool_games(pool_id, registered_at DESC);

-- Palpites / jogos sugeridos pelos membros do bolão
CREATE TABLE IF NOT EXISTS public.pool_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lottery_type public.lottery_type_enum NOT NULL,
  author_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar VARCHAR(4) DEFAULT 'US',
  user_job_title TEXT DEFAULT 'Participante',
  numbers SMALLINT[] NOT NULL CHECK (cardinality(numbers) >= 1),
  rationale TEXT DEFAULT '',
  votes_count INTEGER NOT NULL DEFAULT 0 CHECK (votes_count >= 0),
  approved_as_official_game BOOLEAN NOT NULL DEFAULT FALSE,
  approved_game_id UUID REFERENCES public.pool_games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_suggestions_pool ON public.pool_suggestions(pool_id, votes_count DESC);

CREATE TRIGGER trg_pool_suggestions_updated_at
BEFORE UPDATE ON public.pool_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Votos únicos em sugestões (evita voto duplicado do mesmo usuário)
CREATE TABLE IF NOT EXISTS public.pool_suggestion_votes (
  suggestion_id UUID NOT NULL REFERENCES public.pool_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

CREATE OR REPLACE FUNCTION public.sync_suggestion_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pool_suggestions
       SET votes_count = votes_count + 1
     WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pool_suggestions
       SET votes_count = GREATEST(0, votes_count - 1)
     WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_suggestion_votes_sync ON public.pool_suggestion_votes;
CREATE TRIGGER trg_suggestion_votes_sync
AFTER INSERT OR DELETE ON public.pool_suggestion_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_suggestion_votes_count();

-- Trilha de auditoria imutável
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  pool_id UUID REFERENCES public.pools(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type public.audit_action_enum NOT NULL,
  actor_name TEXT NOT NULL,
  description TEXT NOT NULL,
  integrity_hash TEXT NOT NULL,
  amount NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_pool ON public.audit_logs(pool_id, created_at DESC);

-- Cache de resultados oficiais das Loterias Caixa
CREATE TABLE IF NOT EXISTS public.lottery_results_cache (
  lottery_type public.lottery_type_enum NOT NULL,
  contest_number TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  drawn_numbers SMALLINT[] NOT NULL DEFAULT '{}',
  accumulated BOOLEAN NOT NULL DEFAULT FALSE,
  next_contest_number TEXT,
  next_draw_date TEXT,
  next_estimated_prize NUMERIC(16,2),
  special_accumulated_prize NUMERIC(16,2),
  source TEXT NOT NULL DEFAULT 'API Oficial Loterias Caixa',
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lottery_type, contest_number)
);

-- ============================================================================
-- 10. VIEW DE RESUMO COMPLETO DOS BOLÕES (COM LAYOUT, LOGOTIPO E ARRECADAÇÃO)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_pools_summary
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.company_id,
  p.creator_user_id,
  p.category,
  p.visibility,
  p.title,
  p.description,
  p.lottery_type,
  p.contest_mode,
  p.contest_number,
  p.collection_mode,
  p.quota_value,
  p.max_target_amount,
  p.max_quotas,
  p.platform_fee_percent,
  p.start_date,
  p.end_date,
  p.status,
  p.prize_total_amount,
  p.created_at,
  pp.id AS private_pool_id,
  pp.invite_code,
  pp.requires_approval,
  pp.allow_member_suggestions,
  pp.allow_member_voting,
  pp.organizer_pix_key,
  bl.logo_url,
  bl.logo_initials,
  bl.logo_shape,
  bl.logo_bg_color,
  bl.cover_image_url,
  bl.background_pattern,
  bl.layout_template,
  bl.header_style,
  bl.primary_color,
  bl.secondary_color,
  bl.accent_color,
  bl.surface_color,
  bl.text_color,
  bl.card_border_radius,
  bl.badge_text,
  bl.tagline,
  COALESCE(qp.confirmed_amount, 0)::NUMERIC(14,2) AS confirmed_amount,
  COALESCE(qp.confirmed_quotas, 0)::INTEGER AS confirmed_quotas,
  COALESCE(pt.participants_count, 0)::INTEGER AS participants_count,
  COALESCE(gm.games_count, 0)::INTEGER AS games_count
FROM public.pools p
LEFT JOIN public.private_pools pp ON pp.pool_id = p.id
LEFT JOIN public.pool_branding_layouts bl ON bl.pool_id = p.id
LEFT JOIN (
  SELECT
    pool_id,
    SUM(total_amount) FILTER (WHERE payment_status = 'CONFIRMED') AS confirmed_amount,
    SUM(quotas_count) FILTER (WHERE payment_status = 'CONFIRMED') AS confirmed_quotas
  FROM public.quota_purchases
  GROUP BY pool_id
) qp ON qp.pool_id = p.id
LEFT JOIN (
  SELECT pool_id, COUNT(*) AS participants_count
  FROM public.pool_participants
  GROUP BY pool_id
) pt ON pt.pool_id = p.id
LEFT JOIN (
  SELECT pool_id, COUNT(*) AS games_count
  FROM public.pool_games
  GROUP BY pool_id
) gm ON gm.pool_id = p.id;

-- ============================================================================
-- 11. SUPABASE STORAGE BUCKET PARA LOGOTIPOS E CAPAS DOS BOLÕES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pool-logos',
  'pool-logos',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage (cada usuário envia/edita/exclui apenas dentro da própria pasta {auth.uid()}/...)
DROP POLICY IF EXISTS "pool_logos_public_read" ON storage.objects;
CREATE POLICY "pool_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pool-logos');

DROP POLICY IF EXISTS "pool_logos_owner_insert" ON storage.objects;
CREATE POLICY "pool_logos_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pool-logos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "pool_logos_owner_update" ON storage.objects;
CREATE POLICY "pool_logos_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pool-logos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'pool-logos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "pool_logos_owner_delete" ON storage.objects;
CREATE POLICY "pool_logos_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pool-logos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================================
-- 12. FUNÇÕES AUXILIARES DE SEGURANÇA E ROW LEVEL SECURITY (RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pool_manager(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pools p
    LEFT JOIN public.private_pools pp ON pp.pool_id = p.id
    LEFT JOIN public.private_pool_members pm
      ON pm.pool_id = p.id AND pm.user_id = auth.uid() AND pm.status = 'ACTIVE'
    WHERE p.id = p_pool_id
      AND (
        p.creator_user_id = auth.uid()
        OR pp.owner_user_id = auth.uid()
        OR pm.member_role IN ('OWNER', 'CO_ADMIN')
        OR public.is_super_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_pool(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pools p
    LEFT JOIN public.private_pool_members pm
      ON pm.pool_id = p.id AND pm.user_id = auth.uid() AND pm.status = 'ACTIVE'
    LEFT JOIN public.pool_participants part
      ON part.pool_id = p.id AND part.user_id = auth.uid()
    WHERE p.id = p_pool_id
      AND (
        p.visibility = 'PUBLIC'
        OR p.creator_user_id = auth.uid()
        OR pm.user_id IS NOT NULL
        OR part.user_id IS NOT NULL
        OR public.is_super_admin()
      )
  );
$$;

-- Entrada segura em bolão particular via código de convite (evita enumeração ou auto-promoção)
CREATE OR REPLACE FUNCTION public.join_private_pool_by_code(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_private_pool public.private_pools%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT *
    INTO v_private_pool
    FROM public.private_pools
   WHERE UPPER(invite_code) = UPPER(TRIM(p_invite_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de convite inválido ou inexistente.';
  END IF;

  v_status := CASE
    WHEN v_private_pool.requires_approval THEN 'PENDING_APPROVAL'
    ELSE 'ACTIVE'
  END;

  INSERT INTO public.private_pool_members (
    private_pool_id,
    pool_id,
    user_id,
    member_role,
    status
  )
  VALUES (
    v_private_pool.id,
    v_private_pool.pool_id,
    v_uid,
    'MEMBER',
    v_status
  )
  ON CONFLICT (private_pool_id, user_id) DO NOTHING;

  RETURN v_private_pool.pool_id;
END;
$$;

-- Ativa RLS em todas as tabelas
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_effective_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_pool_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_branding_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_logo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_results_cache ENABLE ROW LEVEL SECURITY;

-- platform_settings: leitura autenticada, escrita apenas SUPER_ADMIN
CREATE POLICY "platform_settings_read" ON public.platform_settings
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- profiles: cada usuário vê e edita o próprio perfil (sem escalar o próprio role)
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Espaço pessoal: dezenas favoritas, jogos favoritos e Meus Jogos
CREATE POLICY "user_fav_numbers_own" ON public.user_favorite_numbers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_fav_games_own" ON public.user_favorite_games
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_effective_games_own" ON public.user_effective_games
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- companies
CREATE POLICY "companies_read_auth" ON public.companies
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "companies_create_auth" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "companies_update_owner" ON public.companies
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_super_admin());

-- pools: qualquer usuário autenticado pode criar um bolão; acesso restrito a membros/dono/públicos
CREATE POLICY "pools_select_accessible" ON public.pools
  FOR SELECT TO authenticated USING (public.can_access_pool(id));
CREATE POLICY "pools_insert_authenticated" ON public.pools
  FOR INSERT TO authenticated WITH CHECK (creator_user_id = auth.uid());
CREATE POLICY "pools_update_manager" ON public.pools
  FOR UPDATE TO authenticated
  USING (public.is_pool_manager(id))
  WITH CHECK (public.is_pool_manager(id));
CREATE POLICY "pools_delete_creator" ON public.pools
  FOR DELETE TO authenticated
  USING (creator_user_id = auth.uid() OR public.is_super_admin());

-- private_pools: qualquer usuário autenticado pode criar e gerenciar seu bolão particular
CREATE POLICY "private_pools_select_accessible" ON public.private_pools
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id));
CREATE POLICY "private_pools_insert_owner" ON public.private_pools
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "private_pools_update_manager" ON public.private_pools
  FOR UPDATE TO authenticated
  USING (public.is_pool_manager(pool_id))
  WITH CHECK (public.is_pool_manager(pool_id));
CREATE POLICY "private_pools_delete_owner" ON public.private_pools
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin());

-- private_pool_members
CREATE POLICY "private_pool_members_select" ON public.private_pool_members
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id) OR user_id = auth.uid());
CREATE POLICY "private_pool_members_insert" ON public.private_pool_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_pool_manager(pool_id)
    OR (
      user_id = auth.uid()
      AND member_role = 'MEMBER'
      AND EXISTS (
        SELECT 1
        FROM public.private_pools pp
        JOIN public.pools p ON p.id = pp.pool_id
        WHERE pp.id = private_pool_members.private_pool_id
          AND pp.pool_id = private_pool_members.pool_id
          AND (
            p.visibility = 'PUBLIC'
            OR EXISTS (
              SELECT 1 FROM public.private_pool_invites inv
              WHERE inv.private_pool_id = pp.id
                AND inv.invited_user_id = auth.uid()
                AND inv.status = 'PENDING'
            )
          )
          AND private_pool_members.status = CASE
            WHEN pp.requires_approval THEN 'PENDING_APPROVAL'
            ELSE 'ACTIVE'
          END
      )
    )
  );
CREATE POLICY "private_pool_members_manage" ON public.private_pool_members
  FOR UPDATE TO authenticated
  USING (public.is_pool_manager(pool_id))
  WITH CHECK (public.is_pool_manager(pool_id));
CREATE POLICY "private_pool_members_delete" ON public.private_pool_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_pool_manager(pool_id));

-- private_pool_invites
CREATE POLICY "private_pool_invites_select" ON public.private_pool_invites
  FOR SELECT TO authenticated
  USING (
    invited_by_user_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.private_pools pp
      WHERE pp.id = private_pool_id AND public.is_pool_manager(pp.pool_id)
    )
  );
CREATE POLICY "private_pool_invites_insert" ON public.private_pool_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.private_pools pp
      WHERE pp.id = private_pool_id AND public.is_pool_manager(pp.pool_id)
    )
  );
CREATE POLICY "private_pool_invites_update" ON public.private_pool_invites
  FOR UPDATE TO authenticated
  USING (
    invited_user_id = auth.uid()
    OR invited_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.private_pools pp
      WHERE pp.id = private_pool_id AND public.is_pool_manager(pp.pool_id)
    )
  );

-- pool_branding_layouts: leitura por quem acessa o bolão, edição pelo dono/gestor do bolão
CREATE POLICY "pool_branding_select" ON public.pool_branding_layouts
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id));
CREATE POLICY "pool_branding_insert_owner" ON public.pool_branding_layouts
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.is_pool_manager(pool_id));
CREATE POLICY "pool_branding_update_manager" ON public.pool_branding_layouts
  FOR UPDATE TO authenticated
  USING (public.is_pool_manager(pool_id))
  WITH CHECK (public.is_pool_manager(pool_id));

-- pool_logo_assets: biblioteca privada do criador
CREATE POLICY "pool_logo_assets_own" ON public.pool_logo_assets
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_user_id = auth.uid());

-- pool_participants
CREATE POLICY "pool_participants_select" ON public.pool_participants
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id));
CREATE POLICY "pool_participants_insert" ON public.pool_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.can_access_pool(pool_id))
    OR public.is_pool_manager(pool_id)
  );
CREATE POLICY "pool_participants_update" ON public.pool_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_pool_manager(pool_id));

-- quota_purchases (criação começa PENDING; confirmação financeira via webhook/service_role ou gestor)
CREATE POLICY "quota_purchases_select" ON public.quota_purchases
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR public.is_pool_manager(pool_id));
CREATE POLICY "quota_purchases_insert_pending" ON public.quota_purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND payment_status = 'PENDING'
    AND public.can_access_pool(pool_id)
  );
CREATE POLICY "quota_purchases_update_manager" ON public.quota_purchases
  FOR UPDATE TO authenticated
  USING (public.is_pool_manager(pool_id))
  WITH CHECK (public.is_pool_manager(pool_id));

-- pool_games
CREATE POLICY "pool_games_select" ON public.pool_games
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id));
CREATE POLICY "pool_games_insert_manager" ON public.pool_games
  FOR INSERT TO authenticated WITH CHECK (public.is_pool_manager(pool_id));

-- pool_suggestions
CREATE POLICY "pool_suggestions_select" ON public.pool_suggestions
  FOR SELECT TO authenticated USING (public.can_access_pool(pool_id));
CREATE POLICY "pool_suggestions_insert_member" ON public.pool_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid() AND public.can_access_pool(pool_id));
CREATE POLICY "pool_suggestions_update_author_or_manager" ON public.pool_suggestions
  FOR UPDATE TO authenticated
  USING (
    (author_user_id = auth.uid() AND approved_as_official_game = FALSE)
    OR public.is_pool_manager(pool_id)
  )
  WITH CHECK (
    public.is_pool_manager(pool_id)
    OR (
      author_user_id = auth.uid()
      AND approved_as_official_game = FALSE
      AND approved_game_id IS NULL
    )
  );

-- pool_suggestion_votes
CREATE POLICY "pool_suggestion_votes_select" ON public.pool_suggestion_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_suggestions s
      WHERE s.id = suggestion_id AND public.can_access_pool(s.pool_id)
    )
  );
CREATE POLICY "pool_suggestion_votes_insert_own" ON public.pool_suggestion_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pool_suggestions s
      WHERE s.id = suggestion_id AND public.can_access_pool(s.pool_id)
    )
  );
CREATE POLICY "pool_suggestion_votes_delete_own" ON public.pool_suggestion_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- audit_logs (somente leitura para membros/gestores; inserção permitida; sem update/delete)
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (pool_id IS NULL AND public.is_super_admin())
    OR (pool_id IS NOT NULL AND public.can_access_pool(pool_id))
  );
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (pool_id IS NULL OR public.can_access_pool(pool_id))
  );

-- lottery_results_cache: leitura pública/autenticada; escrita via service_role no backend
CREATE POLICY "lottery_results_cache_read" ON public.lottery_results_cache
  FOR SELECT USING (TRUE);
