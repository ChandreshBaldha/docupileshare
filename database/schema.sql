-- =============================================================
-- DOCUPILE SHARE — PostgreSQL Database Schema
-- Version: 1.0.0
-- Compatible: PostgreSQL 14+
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text search

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER');

CREATE TYPE otp_channel AS ENUM ('EMAIL', 'PHONE');

CREATE TYPE share_batch_status AS ENUM ('DRAFT', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');

CREATE TYPE share_link_status AS ENUM ('ACTIVE', 'ACCESSED', 'EXPIRED', 'REVOKED');

CREATE TYPE file_match_status AS ENUM ('MATCHED', 'UNMATCHED', 'MANUAL', 'SKIPPED');

CREATE TYPE notification_type AS ENUM ('SHARE_SENT', 'SHARE_ACCESSED', 'SHARE_EXPIRED', 'OTP_SENT', 'BATCH_COMPLETE');

-- =============================================================
-- UTILITY: auto-update updated_at trigger function
-- =============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- TABLE: users
-- =============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(320) NOT NULL,
  password_hash TEXT,                          -- NULL if using SSO
  role          user_role NOT NULL DEFAULT 'MANAGER',
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: sessions (NextAuth)
-- =============================================================

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  expires       TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sessions_token_unique UNIQUE (session_token)
);

CREATE INDEX idx_sessions_user_id      ON sessions (user_id);
CREATE INDEX idx_sessions_session_token ON sessions (session_token);

-- =============================================================
-- TABLE: accounts (NextAuth OAuth)
-- =============================================================

CREATE TABLE accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                VARCHAR(100) NOT NULL,
  provider            VARCHAR(100) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          VARCHAR(100),
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT accounts_provider_unique UNIQUE (provider, provider_account_id)
);

CREATE INDEX idx_accounts_user_id ON accounts (user_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: folders
-- =============================================================

CREATE TABLE folders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(500) NOT NULL,
  description     TEXT,
  created_by_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  file_count      INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_folders_created_by ON folders (created_by_id);
CREATE INDEX idx_folders_name       ON folders USING gin (name gin_trgm_ops);
CREATE INDEX idx_folders_archived   ON folders (is_archived);

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: files
-- =============================================================

CREATE TABLE files (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id        UUID NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
  original_name    VARCHAR(1000) NOT NULL,     -- preserves original filename
  normalized_name  VARCHAR(1000) NOT NULL,     -- lowercased, stripped extension
  storage_key      TEXT NOT NULL,              -- S3 object key
  storage_bucket   VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(255) NOT NULL DEFAULT 'application/pdf',
  size_bytes       BIGINT NOT NULL DEFAULT 0,
  checksum_md5     VARCHAR(32),
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT files_original_name_folder_unique UNIQUE (folder_id, original_name)
);

CREATE INDEX idx_files_folder_id      ON files (folder_id);
CREATE INDEX idx_files_normalized_name ON files USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_files_uploaded_by    ON files (uploaded_by_id);
CREATE INDEX idx_files_not_deleted    ON files (folder_id) WHERE is_deleted = FALSE;

CREATE TRIGGER trg_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Update folder file_count and total_size_bytes automatically
CREATE OR REPLACE FUNCTION sync_folder_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
    UPDATE folders
    SET file_count = file_count + 1,
        total_size_bytes = total_size_bytes + NEW.size_bytes
    WHERE id = NEW.folder_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      UPDATE folders
      SET file_count = GREATEST(file_count - 1, 0),
          total_size_bytes = GREATEST(total_size_bytes - OLD.size_bytes, 0)
      WHERE id = NEW.folder_id;
    ELSIF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      UPDATE folders
      SET file_count = file_count + 1,
          total_size_bytes = total_size_bytes + NEW.size_bytes
      WHERE id = NEW.folder_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.is_deleted = FALSE THEN
    UPDATE folders
    SET file_count = GREATEST(file_count - 1, 0),
        total_size_bytes = GREATEST(total_size_bytes - OLD.size_bytes, 0)
    WHERE id = OLD.folder_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_files_sync_folder_stats
  AFTER INSERT OR UPDATE OR DELETE ON files
  FOR EACH ROW EXECUTE FUNCTION sync_folder_stats();

-- =============================================================
-- TABLE: csv_uploads
-- =============================================================

CREATE TABLE csv_uploads (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id      UUID NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
  file_name      VARCHAR(500) NOT NULL,
  storage_key    TEXT NOT NULL,
  storage_bucket VARCHAR(255) NOT NULL,
  size_bytes     BIGINT NOT NULL DEFAULT 0,
  row_count      INTEGER,                      -- set after parsing
  parsed_at      TIMESTAMPTZ,
  mapping_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING | MAPPED | SHARED
  uploaded_by_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_csv_uploads_folder_id ON csv_uploads (folder_id);
CREATE INDEX idx_csv_uploads_uploaded_by ON csv_uploads (uploaded_by_id);

CREATE TRIGGER trg_csv_uploads_updated_at
  BEFORE UPDATE ON csv_uploads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: recipients
-- =============================================================

CREATE TABLE recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  csv_upload_id   UUID NOT NULL REFERENCES csv_uploads (id) ON DELETE CASCADE,
  name            VARCHAR(500) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL,       -- for matching
  email           VARCHAR(320) NOT NULL,
  phone           VARCHAR(30),
  extra_data      JSONB,                        -- any additional CSV columns
  matched_file_id UUID REFERENCES files (id) ON DELETE SET NULL,
  match_score     NUMERIC(5,2),                 -- 0-100 fuzzy match confidence
  match_status    file_match_status NOT NULL DEFAULT 'UNMATCHED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recipients_email_format CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_recipients_csv_upload_id   ON recipients (csv_upload_id);
CREATE INDEX idx_recipients_matched_file_id  ON recipients (matched_file_id);
CREATE INDEX idx_recipients_email            ON recipients (email);
CREATE INDEX idx_recipients_normalized_name  ON recipients USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_recipients_match_status     ON recipients (match_status);

CREATE TRIGGER trg_recipients_updated_at
  BEFORE UPDATE ON recipients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: branding_assets
-- =============================================================

CREATE TABLE branding_assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  storage_key     TEXT NOT NULL,
  storage_bucket  VARCHAR(255) NOT NULL,
  public_url      TEXT,                        -- cached public URL
  file_type       VARCHAR(50),                 -- png, svg, jpg
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  uploaded_by_id  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branding_assets_uploaded_by ON branding_assets (uploaded_by_id);

CREATE TRIGGER trg_branding_assets_updated_at
  BEFORE UPDATE ON branding_assets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: email_templates
-- =============================================================

CREATE TABLE email_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,               -- HTML with {{variables}}
  body_text       TEXT,                        -- plain text fallback
  variables_used  TEXT[],                      -- e.g. {name, shareLink, expiryDate}
  created_by_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_templates_created_by ON email_templates (created_by_id);

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: share_batches
-- =============================================================

CREATE TABLE share_batches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id             UUID NOT NULL REFERENCES folders (id) ON DELETE RESTRICT,
  csv_upload_id         UUID NOT NULL REFERENCES csv_uploads (id) ON DELETE RESTRICT,
  created_by_id         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  -- Email configuration
  email_template_id     UUID REFERENCES email_templates (id) ON DELETE SET NULL,
  email_subject         TEXT NOT NULL,
  email_body_html       TEXT NOT NULL,
  email_body_text       TEXT,
  branding_asset_id     UUID REFERENCES branding_assets (id) ON DELETE SET NULL,
  branding_logo_url     TEXT,                  -- cached at time of send

  -- OTP configuration
  otp_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  otp_channel           otp_channel,           -- EMAIL | PHONE (NULL if otp_enabled=false)

  -- Link expiry
  link_expiry_hours     INTEGER,               -- NULL = never expires
  link_expiry_label     VARCHAR(100),          -- e.g. "2 days"

  -- Status tracking
  status                share_batch_status NOT NULL DEFAULT 'DRAFT',
  total_recipients      INTEGER NOT NULL DEFAULT 0,
  sent_count            INTEGER NOT NULL DEFAULT 0,
  failed_count          INTEGER NOT NULL DEFAULT 0,
  accessed_count        INTEGER NOT NULL DEFAULT 0,

  -- Timing
  scheduled_at          TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_batches_folder_id      ON share_batches (folder_id);
CREATE INDEX idx_share_batches_csv_upload_id  ON share_batches (csv_upload_id);
CREATE INDEX idx_share_batches_created_by     ON share_batches (created_by_id);
CREATE INDEX idx_share_batches_status         ON share_batches (status);

CREATE TRIGGER trg_share_batches_updated_at
  BEFORE UPDATE ON share_batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: share_links
-- =============================================================

CREATE TABLE share_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_batch_id    UUID NOT NULL REFERENCES share_batches (id) ON DELETE CASCADE,
  recipient_id      UUID NOT NULL REFERENCES recipients (id) ON DELETE CASCADE,
  file_id           UUID NOT NULL REFERENCES files (id) ON DELETE RESTRICT,

  -- Unique access token
  token             VARCHAR(64) NOT NULL,

  -- Status
  status            share_link_status NOT NULL DEFAULT 'ACTIVE',

  -- OTP
  otp_code_hash     TEXT,                      -- bcrypt hash of OTP
  otp_sent_at       TIMESTAMPTZ,
  otp_verified_at   TIMESTAMPTZ,
  otp_attempts      INTEGER NOT NULL DEFAULT 0,

  -- Expiry
  expires_at        TIMESTAMPTZ,               -- NULL = never expires

  -- Access tracking
  access_count      INTEGER NOT NULL DEFAULT 0,
  last_accessed_at  TIMESTAMPTZ,
  first_accessed_at TIMESTAMPTZ,
  last_accessed_ip  INET,
  last_user_agent   TEXT,

  -- Send status
  email_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at     TIMESTAMPTZ,
  email_error       TEXT,                      -- error message if send failed
  send_attempts     INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT share_links_token_unique UNIQUE (token)
);

CREATE INDEX idx_share_links_token          ON share_links (token);
CREATE INDEX idx_share_links_share_batch_id ON share_links (share_batch_id);
CREATE INDEX idx_share_links_recipient_id   ON share_links (recipient_id);
CREATE INDEX idx_share_links_file_id        ON share_links (file_id);
CREATE INDEX idx_share_links_status         ON share_links (status);
CREATE INDEX idx_share_links_expires_at     ON share_links (expires_at) WHERE expires_at IS NOT NULL;

CREATE TRIGGER trg_share_links_updated_at
  BEFORE UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-update batch sent_count / failed_count
CREATE OR REPLACE FUNCTION sync_batch_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- When email_sent changes to TRUE
    IF OLD.email_sent = FALSE AND NEW.email_sent = TRUE THEN
      UPDATE share_batches SET sent_count = sent_count + 1 WHERE id = NEW.share_batch_id;
    END IF;
    -- When email_error is set (failed)
    IF OLD.email_error IS NULL AND NEW.email_error IS NOT NULL THEN
      UPDATE share_batches SET failed_count = failed_count + 1 WHERE id = NEW.share_batch_id;
    END IF;
    -- When accessed for first time
    IF OLD.access_count = 0 AND NEW.access_count > 0 THEN
      UPDATE share_batches SET accessed_count = accessed_count + 1 WHERE id = NEW.share_batch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_share_links_sync_batch_counts
  AFTER UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION sync_batch_counts();

-- =============================================================
-- TABLE: share_access_logs  (detailed access audit trail)
-- =============================================================

CREATE TABLE share_access_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_link_id   UUID NOT NULL REFERENCES share_links (id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,         -- LINK_OPENED | OTP_REQUESTED | OTP_VERIFIED | OTP_FAILED | FILE_DOWNLOADED
  ip_address      INET,
  user_agent      TEXT,
  country         VARCHAR(100),
  city            VARCHAR(100),
  metadata        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_logs_share_link_id ON share_access_logs (share_link_id);
CREATE INDEX idx_access_logs_event_type    ON share_access_logs (event_type);
CREATE INDEX idx_access_logs_occurred_at   ON share_access_logs (occurred_at);

-- =============================================================
-- TABLE: audit_logs  (system-wide audit trail)
-- =============================================================

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,           -- FOLDER_CREATED | FILE_UPLOADED | SHARE_SENT | etc.
  entity_type   VARCHAR(100),                    -- folder | file | share_batch | recipient
  entity_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity      ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_occurred_at ON audit_logs (occurred_at);

-- =============================================================
-- TABLE: notifications
-- =============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           VARCHAR(500) NOT NULL,
  message         TEXT,
  entity_type     VARCHAR(100),
  entity_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_unread     ON notifications (user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

-- =============================================================
-- TABLE: share_export_logs  (track Excel export downloads)
-- =============================================================

CREATE TABLE share_export_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_batch_id  UUID NOT NULL REFERENCES share_batches (id) ON DELETE CASCADE,
  exported_by_id  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  file_name       VARCHAR(500) NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_export_logs_batch_id ON share_export_logs (share_batch_id);

-- =============================================================
-- TABLE: job_queue_logs  (BullMQ job tracking mirror)
-- =============================================================

CREATE TABLE job_queue_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_batch_id  UUID NOT NULL REFERENCES share_batches (id) ON DELETE CASCADE,
  share_link_id   UUID REFERENCES share_links (id) ON DELETE SET NULL,
  job_id          VARCHAR(255),                 -- BullMQ job id
  queue_name      VARCHAR(100) NOT NULL,
  status          VARCHAR(50) NOT NULL,          -- queued | processing | completed | failed
  attempt         INTEGER NOT NULL DEFAULT 1,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_queue_logs_batch_id ON job_queue_logs (share_batch_id);
CREATE INDEX idx_job_queue_logs_status   ON job_queue_logs (status);

-- =============================================================
-- VIEWS
-- =============================================================

-- Comprehensive share log view (used for Excel export)
CREATE VIEW v_share_log AS
SELECT
  sl.id                     AS share_link_id,
  sb.id                     AS share_batch_id,
  f.name                    AS folder_name,
  r.name                    AS recipient_name,
  r.email                   AS recipient_email,
  r.phone                   AS recipient_phone,
  fi.original_name          AS file_name,
  (fi.size_bytes / 1024.0)  AS file_size_kb,
  sl.token                  AS share_token,
  CONCAT(
    current_setting('app.base_url', TRUE),
    '/share/', sl.token
  )                         AS share_link_url,
  sl.status                 AS link_status,
  sl.email_sent,
  sl.email_sent_at,
  sl.email_error,
  sb.otp_enabled,
  sb.otp_channel,
  sl.otp_sent_at,
  sl.otp_verified_at,
  sl.otp_attempts,
  sl.expires_at,
  CASE
    WHEN sl.expires_at IS NULL THEN 'Never'
    WHEN sl.expires_at < NOW() THEN 'Expired'
    ELSE 'Active'
  END                       AS expiry_status,
  sl.access_count,
  sl.first_accessed_at,
  sl.last_accessed_at,
  sl.last_accessed_ip::TEXT AS last_ip,
  u.name                    AS sent_by,
  sl.created_at             AS shared_at
FROM share_links sl
JOIN share_batches sb   ON sb.id = sl.share_batch_id
JOIN folders f          ON f.id  = sb.folder_id
JOIN recipients r       ON r.id  = sl.recipient_id
JOIN files fi           ON fi.id = sl.file_id
JOIN users u            ON u.id  = sb.created_by_id;

-- Folder summary view
CREATE VIEW v_folder_summary AS
SELECT
  f.id,
  f.name,
  f.description,
  f.file_count,
  ROUND(f.total_size_bytes / 1048576.0, 2) AS total_size_mb,
  f.is_archived,
  u.name                                    AS created_by,
  f.created_at,
  f.updated_at,
  COUNT(DISTINCT cu.id)                     AS csv_upload_count,
  COUNT(DISTINCT sb.id)                     AS share_batch_count,
  MAX(sb.created_at)                        AS last_shared_at
FROM folders f
JOIN users u                   ON u.id  = f.created_by_id
LEFT JOIN csv_uploads cu       ON cu.folder_id = f.id
LEFT JOIN share_batches sb     ON sb.folder_id = f.id
GROUP BY f.id, f.name, f.description, f.file_count, f.total_size_bytes,
         f.is_archived, u.name, f.created_at, f.updated_at;

-- =============================================================
-- SEED: Default email template
-- =============================================================

INSERT INTO users (id, name, email, password_hash, role)
VALUES (
  uuid_generate_v4(),
  'System Admin',
  'admin@docupile.com',
  -- bcrypt hash of 'Admin@123' (change on first login)
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniLFhEJJSIDG9J0Oz1K6nCpWi',
  'SUPER_ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- =============================================================
-- PERMISSIONS / ROW LEVEL SECURITY (optional, enable per table)
-- =============================================================

-- ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE files   ENABLE ROW LEVEL SECURITY;
-- (Add policies based on your auth strategy)

-- =============================================================
-- GRANT STATEMENTS (adjust role name as needed)
-- =============================================================

-- GRANT CONNECT ON DATABASE docupile_share TO docupile_app;
-- GRANT USAGE ON SCHEMA public TO docupile_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO docupile_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO docupile_app;

-- =============================================================
-- END OF SCHEMA
-- =============================================================
