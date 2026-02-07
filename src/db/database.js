// sql.js initialization with IndexedDB persistence
import { SCHEMA_SQL, INDEXEDDB_NAME, INDEXEDDB_STORE } from './schema';

let db = null;
let SQL = null;

// Initialize IndexedDB for persistence
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains(INDEXEDDB_STORE)) {
        idb.createObjectStore(INDEXEDDB_STORE);
      }
    };
  });
}

// Load database from IndexedDB
async function loadFromIndexedDB() {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(INDEXEDDB_STORE, 'readonly');
    const store = transaction.objectStore(INDEXEDDB_STORE);
    const request = store.get('database');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Save database to IndexedDB
async function saveToIndexedDB(data) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(INDEXEDDB_STORE, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_STORE);
    const request = store.put(data, 'database');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Save a backup to IndexedDB under a separate key
async function backupToIndexedDB(data) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(INDEXEDDB_STORE, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_STORE);
    const request = store.put(data, 'database_backup_v1');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Load sql.js from CDN
async function loadSqlJs() {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      resolve(window.initSqlJs);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sql.js.org/dist/sql-wasm.js';
    script.onload = () => resolve(window.initSqlJs);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Detect whether old schema (v1) exists
function isOldSchema(database) {
  try {
    const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length === 0) return false;
    const names = tables[0].values.map(r => r[0]);
    return names.includes('users') && !names.includes('profile');
  } catch {
    return false;
  }
}

// Migrate from v1 (users/contacts.company TEXT/company_relationships) to v2 (profile/companies FK/relations)
async function migrateV1toV2(database) {
  console.log('[DB Migration] Starting v1 → v2 migration...');

  // 1. Backup raw bytes
  const backupBytes = new Uint8Array(database.export());
  await backupToIndexedDB(backupBytes);
  console.log('[DB Migration] Backup saved to IndexedDB key "database_backup_v1"');

  // 2. BEGIN TRANSACTION
  database.run('BEGIN TRANSACTION');

  try {
    // 3. Rename old tables
    database.run('ALTER TABLE users RENAME TO _old_users');

    // Check which old tables exist
    const tableRows = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const existingTables = tableRows.length > 0 ? tableRows[0].values.map(r => r[0]) : [];

    const hasOldCompanies = existingTables.includes('companies');
    const hasOldContacts = existingTables.includes('contacts');
    const hasOldRels = existingTables.includes('company_relationships');

    if (hasOldCompanies) database.run('ALTER TABLE companies RENAME TO _old_companies');
    if (hasOldContacts) database.run('ALTER TABLE contacts RENAME TO _old_contacts');
    if (hasOldRels) database.run('ALTER TABLE company_relationships RENAME TO _old_rels');

    // 4. Create new tables
    database.run(`
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT,
        password_hash TEXT,
        password_salt TEXT,
        company_id INTEGER REFERENCES companies(id),
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    database.run(`
      CREATE TABLE companies (
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
      )
    `);

    database.run(`
      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES profile(id),
        external_id TEXT UNIQUE,
        name TEXT NOT NULL,
        company_id INTEGER REFERENCES companies(id),
        position TEXT,
        connected_on TEXT,
        linkedin_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    database.run(`
      CREATE TABLE relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES profile(id),
        source_company_id INTEGER NOT NULL REFERENCES companies(id),
        target_company_id INTEGER NOT NULL REFERENCES companies(id),
        type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 5. Migrate _old_users -> profile
    // Check if old users table has password columns
    let hasPasswordCols = false;
    try {
      database.exec('SELECT password_hash FROM _old_users LIMIT 0');
      hasPasswordCols = true;
    } catch { /* no password columns */ }

    if (hasPasswordCols) {
      database.run(`
        INSERT INTO profile (id, name, email, role, password_hash, password_salt, created_at)
        SELECT id, name, email, role, password_hash, password_salt, created_at FROM _old_users
      `);
    } else {
      database.run(`
        INSERT INTO profile (id, name, email, role, created_at)
        SELECT id, name, email, role, created_at FROM _old_users
      `);
    }

    // Get user id
    const userRows = database.exec('SELECT id FROM profile LIMIT 1');
    const userId = userRows.length > 0 ? userRows[0].values[0][0] : 1;

    // 6. Collect ALL unique company names (case-insensitive, first-seen casing)
    const companyNameMap = {}; // lowercase -> { canonical, enrichment }

    // From old contacts
    if (hasOldContacts) {
      const contactCompanies = database.exec('SELECT DISTINCT company FROM _old_contacts WHERE company IS NOT NULL AND company != \'\'');
      if (contactCompanies.length > 0) {
        contactCompanies[0].values.forEach(([name]) => {
          const key = name.toLowerCase().trim();
          if (key && !companyNameMap[key]) {
            companyNameMap[key] = { canonical: name.trim(), enrichment: null };
          }
        });
      }
    }

    // From old relationships
    if (hasOldRels) {
      // Strip any remaining "company_" prefix from old rels
      const relCompanies = database.exec(`
        SELECT DISTINCT source_company FROM _old_rels WHERE source_company IS NOT NULL
        UNION
        SELECT DISTINCT target_company FROM _old_rels WHERE target_company IS NOT NULL
      `);
      if (relCompanies.length > 0) {
        relCompanies[0].values.forEach(([name]) => {
          let clean = name;
          if (clean.startsWith('company_')) clean = clean.slice(8);
          const key = clean.toLowerCase().trim();
          if (key && !companyNameMap[key]) {
            companyNameMap[key] = { canonical: clean.trim(), enrichment: null };
          }
        });
      }
    }

    // From old companies (enrichment data)
    if (hasOldCompanies) {
      const oldCos = database.exec('SELECT * FROM _old_companies');
      if (oldCos.length > 0) {
        const cols = oldCos[0].columns;
        oldCos[0].values.forEach(row => {
          const obj = {};
          cols.forEach((c, i) => { obj[c] = row[i]; });
          const key = (obj.name || '').toLowerCase().trim();
          if (key) {
            if (!companyNameMap[key]) {
              companyNameMap[key] = { canonical: obj.name.trim(), enrichment: obj };
            } else {
              companyNameMap[key].enrichment = obj;
            }
          }
        });
      }
    }

    // 7. Create company rows
    // Collect custom_estimated_size from old contacts as fallback
    const contactSizeMap = {}; // lowercase company -> size
    if (hasOldContacts) {
      const sizeRows = database.exec(`
        SELECT company, custom_estimated_size FROM _old_contacts
        WHERE custom_estimated_size IS NOT NULL AND custom_estimated_size > 0
      `);
      if (sizeRows.length > 0) {
        sizeRows[0].values.forEach(([co, size]) => {
          if (co) contactSizeMap[co.toLowerCase().trim()] = size;
        });
      }
    }

    const companyIdMap = {}; // lowercase -> numeric id
    for (const [key, { canonical, enrichment }] of Object.entries(companyNameMap)) {
      const e = enrichment || {};
      const estimatedSize = e.estimated_size || contactSizeMap[key] || null;
      database.run(
        `INSERT INTO companies (user_id, name, estimated_size, industry, color, description, website, headquarters, founded_year, company_type, linkedin_url, enriched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          canonical,
          estimatedSize,
          e.industry || null,
          e.color || null,
          e.description || null,
          e.website || null,
          e.headquarters || null,
          e.founded_year || null,
          e.company_type || null,
          e.linkedin_url || null,
          e.enriched_at || null,
        ]
      );
      // Get the id (MAX fallback because last_insert_rowid is broken in CDN sql.js)
      const idRow = database.exec(`SELECT MAX(id) as id FROM companies`);
      companyIdMap[key] = idRow[0].values[0][0];
    }

    // 8. Set profile.company_id to user's own company
    if (hasOldCompanies) {
      const firstCo = database.exec('SELECT name FROM _old_companies ORDER BY id ASC LIMIT 1');
      if (firstCo.length > 0) {
        const firstCoName = firstCo[0].values[0][0];
        const coId = companyIdMap[firstCoName.toLowerCase().trim()];
        if (coId) {
          database.run('UPDATE profile SET company_id = ? WHERE id = ?', [coId, userId]);
        }
      }
    }

    // 9. Migrate contacts (skip is_company_placeholder=1)
    if (hasOldContacts) {
      // Check if old contacts have linkedin_url column
      let hasLinkedinUrl = false;
      try {
        database.exec('SELECT linkedin_url FROM _old_contacts LIMIT 0');
        hasLinkedinUrl = true;
      } catch { /* no linkedin_url */ }

      const oldContacts = database.exec(`
        SELECT * FROM _old_contacts
        WHERE is_company_placeholder = 0 OR is_company_placeholder IS NULL
      `);

      if (oldContacts.length > 0) {
        const cols = oldContacts[0].columns;
        oldContacts[0].values.forEach(row => {
          const obj = {};
          cols.forEach((c, i) => { obj[c] = row[i]; });
          const coKey = (obj.company || '').toLowerCase().trim();
          const companyId = coKey ? (companyIdMap[coKey] || null) : null;
          database.run(
            `INSERT INTO contacts (user_id, external_id, name, company_id, position, connected_on, linkedin_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              obj.external_id || null,
              obj.name,
              companyId,
              obj.position || null,
              obj.connected_on || null,
              hasLinkedinUrl ? (obj.linkedin_url || null) : null,
            ]
          );
        });
      }
    }

    // 10. Migrate relationships
    if (hasOldRels) {
      const oldRels = database.exec('SELECT * FROM _old_rels');
      if (oldRels.length > 0) {
        const cols = oldRels[0].columns;
        oldRels[0].values.forEach(row => {
          const obj = {};
          cols.forEach((c, i) => { obj[c] = row[i]; });

          let src = obj.source_company || '';
          let tgt = obj.target_company || '';
          if (src.startsWith('company_')) src = src.slice(8);
          if (tgt.startsWith('company_')) tgt = tgt.slice(8);

          const srcId = companyIdMap[src.toLowerCase().trim()];
          const tgtId = companyIdMap[tgt.toLowerCase().trim()];
          if (srcId && tgtId) {
            database.run(
              `INSERT INTO relations (user_id, source_company_id, target_company_id, type, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [userId, srcId, tgtId, obj.relationship_type || 'customer', obj.created_at || null]
            );
          }
        });
      }
    }

    // 11. Drop old tables, create indexes
    database.run('DROP TABLE IF EXISTS _old_users');
    database.run('DROP TABLE IF EXISTS _old_companies');
    database.run('DROP TABLE IF EXISTS _old_contacts');
    database.run('DROP TABLE IF EXISTS _old_rels');

    database.run('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)');
    database.run('CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id)');
    database.run('CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id)');
    database.run('CREATE INDEX IF NOT EXISTS idx_relations_user_id ON relations(user_id)');

    // 12. COMMIT
    database.run('COMMIT');
    console.log('[DB Migration] v1 → v2 migration complete');
  } catch (err) {
    console.error('[DB Migration] ROLLBACK due to error:', err);
    database.run('ROLLBACK');
    throw err;
  }
}

// Initialize the database
export async function initDatabase() {
  if (db) return db;

  // Load sql.js from CDN
  const initSqlJs = await loadSqlJs();

  // Initialize sql.js with WASM from CDN
  SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  // Try to load existing database from IndexedDB
  const savedData = await loadFromIndexedDB();

  if (savedData) {
    db = new SQL.Database(savedData);

    // Check if migration is needed
    if (isOldSchema(db)) {
      await migrateV1toV2(db);
      await persistDatabase();
    }
  } else {
    db = new SQL.Database();
    // Create tables (fresh install)
    db.run(SCHEMA_SQL);
    await persistDatabase();
  }

  return db;
}

// Persist database to IndexedDB
export async function persistDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = new Uint8Array(data);
  await saveToIndexedDB(buffer);
}

// Get the database instance
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Execute a query and return results as array of objects
export function query(sql, params = []) {
  const database = getDatabase();

  // Build SQL with inline params (safe for internal queries)
  let finalSql = sql;
  if (params.length > 0) {
    let idx = 0;
    finalSql = sql.replace(/\?/g, () => {
      const val = params[idx++];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val.toString();
      // Escape single quotes for string values
      return `'${String(val).replace(/'/g, "''")}'`;
    });
  }

  const rawResults = database.exec(finalSql);
  if (rawResults.length === 0) return [];

  const { columns, values } = rawResults[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}


// Execute a query that modifies data
export async function execute(sql, params = []) {
  const database = getDatabase();
  database.run(sql, params);
  await persistDatabase();
  return database.getRowsModified();
}

// Get the last inserted row ID
// Note: last_insert_rowid() is unreliable with some sql.js CDN versions,
// so we query the table directly as a fallback
export function lastInsertRowId(table = null) {
  // Try last_insert_rowid() first
  const result = query('SELECT last_insert_rowid() as id');
  const rowId = result[0]?.id;

  // If we got 0 and a table name was provided, query the table for the max id
  if ((!rowId || rowId === 0) && table) {
    const fallback = query(`SELECT MAX(id) as id FROM ${table}`);
    return fallback[0]?.id || 0;
  }

  return rowId;
}

// Clear all data (for testing/reset)
export async function clearDatabase() {
  const database = getDatabase();
  database.run('DELETE FROM relations');
  database.run('DELETE FROM contacts');
  database.run('DELETE FROM companies');
  database.run('DELETE FROM profile');
  await persistDatabase();
}

// Check if database has any users (for onboarding check)
export function hasProfile() {
  const result = query('SELECT COUNT(*) as count FROM profile');
  return result[0]?.count > 0;
}

// Get the first user record (for login)
export function getProfile() {
  const result = query('SELECT * FROM profile LIMIT 1');
  return result[0] || null;
}

// Backward-compat aliases
export const hasUser = hasProfile;
export const getUser = getProfile;

// Export the database as a downloadable .db file
export function exportDatabase() {
  const database = getDatabase();
  const data = database.export();
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `netzwerk-backup-${date}.db`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Import a .db file, validate it, replace the current database, and persist
export async function importDatabase(file) {
  try {
    const buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    // Validate SQLite magic bytes
    const header = new Uint8Array(buffer, 0, 16);
    const magic = String.fromCharCode(...header);
    if (magic !== 'SQLite format 3\0') {
      return { success: false, message: 'Ungültige Datei — kein SQLite-Backup.' };
    }

    // Backup current DB before overwriting
    if (db) {
      const backupData = new Uint8Array(db.export());
      await backupToIndexedDB(backupData);
    }

    // Replace in-memory database
    const newDb = new SQL.Database(new Uint8Array(buffer));

    // Auto-migrate if old schema
    if (isOldSchema(newDb)) {
      await migrateV1toV2(newDb);
    }

    db = newDb;
    await persistDatabase();
    return { success: true, message: 'Backup erfolgreich wiederhergestellt.' };
  } catch (err) {
    console.error('[Import] Failed:', err);
    return { success: false, message: `Import fehlgeschlagen: ${err.message}` };
  }
}

// Get or create a company by name (case-insensitive)
// Returns the company_id
export async function getOrCreateCompany(userId, name) {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  const existing = query(
    'SELECT id FROM companies WHERE user_id = ? AND LOWER(name) = LOWER(?)',
    [userId, trimmed]
  );
  if (existing.length > 0) return existing[0].id;

  await execute(
    'INSERT INTO companies (user_id, name) VALUES (?, ?)',
    [userId, trimmed]
  );
  return lastInsertRowId('companies');
}
