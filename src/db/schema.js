// SQL schema definitions for LinkedIn Network Analyzer

export const SCHEMA_SQL = `
-- User profile (single user, local-only)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Companies (user's own + enriched external)
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
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
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Contacts from LinkedIn / manual entry
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  company TEXT,
  position TEXT,
  connected_on TEXT,
  is_company_placeholder INTEGER DEFAULT 0,
  custom_estimated_size INTEGER,
  linkedin_url TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Company-to-company relationships
CREATE TABLE IF NOT EXISTS company_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_company TEXT NOT NULL,
  target_company TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_company_relationships_user_id ON company_relationships(user_id);
`;

// Database version for migrations
export const DB_VERSION = 1;

// IndexedDB configuration
export const INDEXEDDB_NAME = 'linkedin-network-analyzer';
export const INDEXEDDB_STORE = 'sqlitedb';
