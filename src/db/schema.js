// SQL schema definitions for LinkedIn Network Analyzer — v2

export const SCHEMA_SQL = `
-- User profile (single user, local-only)
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  password_hash TEXT,
  password_salt TEXT,
  company_id INTEGER REFERENCES companies(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Companies (first-class entities)
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES profile(id),
  name TEXT NOT NULL,
  estimated_size INTEGER,
  industry TEXT,
  color TEXT,
  description TEXT,
  website TEXT,
  headquarters TEXT,
  founded_year INTEGER,
  company_type TEXT,
  linkedin_url TEXT,
  enriched_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Contacts from LinkedIn / manual entry
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES profile(id),
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  position TEXT,
  connected_on TEXT,
  linkedin_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Company-to-company relationships
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES profile(id),
  source_company_id INTEGER NOT NULL REFERENCES companies(id),
  target_company_id INTEGER NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_relations_user_id ON relations(user_id);
`;

// Database version for migrations
export const DB_VERSION = 2;

// IndexedDB configuration
export const INDEXEDDB_NAME = 'linkedin-network-analyzer';
export const INDEXEDDB_STORE = 'sqlitedb';
