-- ============================================================
-- سجل (SAJIL) — مخطط قاعدة بيانات PostgreSQL (المزامنة السحابية الاختيارية)
-- متوافق مع Neon PostgreSQL · نموذج مطبّع ومفهرس بالكامل
-- ============================================================

-- الأدوار والصلاحيات
CREATE TABLE roles (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,          -- admin | accountant | lawyer | viewer
  name_ar     TEXT NOT NULL
);

CREATE TABLE permissions (
  id          BIGSERIAL PRIMARY KEY,
  role_id     BIGINT REFERENCES roles(id) ON DELETE CASCADE,
  resource    TEXT NOT NULL,                 -- debts | accounts | documents | reports
  can_read    BOOLEAN DEFAULT TRUE,
  can_write   BOOLEAN DEFAULT FALSE,
  can_delete  BOOLEAN DEFAULT FALSE,
  UNIQUE (role_id, resource)
);

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,               -- bcrypt/argon2
  full_name_ar  TEXT NOT NULL,
  role_id       BIGINT REFERENCES roles(id),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- الأطراف (عملاء / موردون / أفراد / جهات)
CREATE TABLE parties (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT CHECK (type IN ('individual','company','institution')),
  id_type      TEXT,
  id_number    TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  nationality  TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_parties_name ON parties (name);
CREATE INDEX idx_parties_phone ON parties (phone);

-- دليل الحسابات
CREATE TABLE accounts (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  name_ar         TEXT NOT NULL,
  type            TEXT CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id       BIGINT REFERENCES accounts(id),
  currency        TEXT DEFAULT 'YER',
  opening_balance NUMERIC(18,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_accounts_parent ON accounts (parent_id);

-- قيود اليومية (مزدوجة القيد)
CREATE TABLE journal_entries (
  id          BIGSERIAL PRIMARY KEY,
  number      TEXT UNIQUE NOT NULL,
  entry_date  DATE NOT NULL,
  description TEXT NOT NULL,
  currency    TEXT DEFAULT 'YER',
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_journal_date ON journal_entries (entry_date);

CREATE TABLE journal_lines (
  id         BIGSERIAL PRIMARY KEY,
  entry_id   BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  debit      NUMERIC(18,2) DEFAULT 0,
  credit     NUMERIC(18,2) DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0 AND (debit > 0) <> (credit > 0))
);
CREATE INDEX idx_lines_entry ON journal_lines (entry_id);
CREATE INDEX idx_lines_account ON journal_lines (account_id);

-- الديون
CREATE TABLE debts (
  id               BIGSERIAL PRIMARY KEY,
  number           TEXT UNIQUE NOT NULL,
  debt_type        TEXT CHECK (debt_type IN ('receivable','payable')),
  party_id         BIGINT REFERENCES parties(id),
  amount           NUMERIC(18,2) NOT NULL,
  currency         TEXT DEFAULT 'YER',
  interest_rate    NUMERIC(6,2) DEFAULT 0,
  start_date       DATE NOT NULL,
  due_date         DATE NOT NULL,
  installment_count INT DEFAULT 1,
  status           TEXT CHECK (status IN ('active','partial','overdue','settled','cancelled')),
  reason           TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_debts_party ON debts (party_id);
CREATE INDEX idx_debts_status ON debts (status);
CREATE INDEX idx_debts_due ON debts (due_date);

-- المدفوعات
CREATE TABLE payments (
  id         BIGSERIAL PRIMARY KEY,
  debt_id    BIGINT REFERENCES debts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount     NUMERIC(18,2) NOT NULL,
  currency   TEXT DEFAULT 'YER',
  method     TEXT CHECK (method IN ('cash','bank','transfer','check')),
  reference  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_debt ON payments (debt_id);
CREATE INDEX idx_payments_date ON payments (payment_date);

-- التسويات
CREATE TABLE settlements (
  id          BIGSERIAL PRIMARY KEY,
  debt_id     BIGINT REFERENCES debts(id),
  amount      NUMERIC(18,2) NOT NULL,
  settled_at  TIMESTAMPTZ DEFAULT now(),
  notes       TEXT
);

-- القوالب والمستندات القانونية
CREATE TABLE doc_templates (
  id         BIGSERIAL PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  doc_type   TEXT NOT NULL,
  content    TEXT NOT NULL,                  -- مع عناصر نائبة {{...}}
  is_builtin BOOLEAN DEFAULT FALSE
);

CREATE TABLE legal_documents (
  id          BIGSERIAL PRIMARY KEY,
  number      TEXT UNIQUE NOT NULL,
  doc_type    TEXT NOT NULL,
  title       TEXT NOT NULL,
  template_id BIGINT REFERENCES doc_templates(id),
  party_id    BIGINT REFERENCES parties(id),
  amount      NUMERIC(18,2),
  currency    TEXT DEFAULT 'YER',
  doc_date    DATE DEFAULT CURRENT_DATE,
  body        TEXT NOT NULL,
  status      TEXT CHECK (status IN ('draft','final')),
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_docs_number ON legal_documents (number);
CREATE INDEX idx_docs_type ON legal_documents (doc_type);

CREATE TABLE document_parties (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     BIGINT REFERENCES legal_documents(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,                  -- الطرف الأول/الثاني/الشاهد/المحامي
  name       TEXT NOT NULL,
  id_type    TEXT,
  id_number  TEXT,
  address    TEXT,
  phone      TEXT
);

-- المرفقات
CREATE TABLE attachments (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     BIGINT REFERENCES legal_documents(id) ON DELETE CASCADE,
  file_name  TEXT NOT NULL,
  mime_type  TEXT,
  size_bytes BIGINT,
  checksum   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- سجل التدقيق
CREATE TABLE audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  BIGINT,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs (entity, entity_id);
CREATE INDEX idx_audit_at ON audit_logs (created_at);

-- المزامنة والنسخ الاحتياطي
CREATE TABLE sync_queue (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_key  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  operation   TEXT CHECK (operation IN ('upsert','delete')),
  synced_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, entity, entity_key)
);

CREATE TABLE backups (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  size_bytes  BIGINT,
  checksum    TEXT,
  storage_ref TEXT
);

-- الإعدادات
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
