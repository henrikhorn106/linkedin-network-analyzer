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
    // Repair: fix user_id=0 from broken lastInsertRowId in older sessions
    try {
      const users = db.exec('SELECT id FROM users LIMIT 1');
      if (users.length > 0) {
        const realUserId = users[0].values[0][0];
        const companies = db.exec('SELECT user_id FROM companies LIMIT 1');
        if (companies.length > 0 && companies[0].values[0][0] === 0 && realUserId !== 0) {
          db.run('UPDATE companies SET user_id = ' + realUserId + ' WHERE user_id = 0');
          db.run('UPDATE contacts SET user_id = ' + realUserId + ' WHERE user_id = 0');
          await persistDatabase();
        }
      }
    } catch (e) {
      console.warn('[DB Repair] Skipped:', e.message);
    }
    // Migration: add password columns to users if missing
    try {
      db.exec('SELECT password_hash FROM users LIMIT 0');
    } catch (e) {
      db.run('ALTER TABLE users ADD COLUMN password_hash TEXT');
      db.run('ALTER TABLE users ADD COLUMN password_salt TEXT');
      await persistDatabase();
    }
    // Migration: add linkedin_url column if missing
    try {
      db.exec('SELECT linkedin_url FROM contacts LIMIT 0');
    } catch (e) {
      db.run('ALTER TABLE contacts ADD COLUMN linkedin_url TEXT');
      await persistDatabase();
    }
    // Migration: add color column to companies if missing
    try {
      db.exec('SELECT color FROM companies LIMIT 0');
    } catch (e) {
      db.run('ALTER TABLE companies ADD COLUMN color TEXT');
      await persistDatabase();
    }
    // Migration: add enrichment columns to companies if missing
    try {
      db.exec('SELECT description FROM companies LIMIT 0');
    } catch (e) {
      db.run('ALTER TABLE companies ADD COLUMN description TEXT');
      db.run('ALTER TABLE companies ADD COLUMN website TEXT');
      db.run('ALTER TABLE companies ADD COLUMN headquarters TEXT');
      db.run('ALTER TABLE companies ADD COLUMN founded_year INTEGER');
      db.run('ALTER TABLE companies ADD COLUMN company_type TEXT');
      db.run('ALTER TABLE companies ADD COLUMN linkedin_url TEXT');
      db.run('ALTER TABLE companies ADD COLUMN enriched_at TEXT');
      await persistDatabase();
    }
    // Migration: add created_at column to company_relationships if missing
    try {
      db.exec('SELECT created_at FROM company_relationships LIMIT 0');
    } catch (e) {
      db.run('ALTER TABLE company_relationships ADD COLUMN created_at TEXT');
      await persistDatabase();
    }
    // Migration: strip "company_" prefix from source_company / target_company
    try {
      db.run("UPDATE company_relationships SET source_company = SUBSTR(source_company, 9) WHERE source_company LIKE 'company_%'");
      db.run("UPDATE company_relationships SET target_company = SUBSTR(target_company, 9) WHERE target_company LIKE 'company_%'");
      await persistDatabase();
    } catch (e) {
      console.warn('[DB Migration] Strip company_ prefix skipped:', e.message);
    }
    // Migration: convert supplier relationships to customer with swapped direction
    try {
      db.run(`UPDATE company_relationships
        SET source_company = target_company,
            target_company = source_company,
            relationship_type = 'customer'
        WHERE relationship_type = 'supplier'`);
      await persistDatabase();
    } catch (e) {
      console.warn('[DB Migration] Supplier→customer conversion skipped:', e.message);
    }
  } else {
    db = new SQL.Database();
    // Create tables
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
  database.run('DELETE FROM company_relationships');
  database.run('DELETE FROM contacts');
  database.run('DELETE FROM companies');
  database.run('DELETE FROM users');
  await persistDatabase();
}

// Check if database has any users (for onboarding check)
export function hasUser() {
  const result = query('SELECT COUNT(*) as count FROM users');
  return result[0]?.count > 0;
}

// Get the first user record (for login)
export function getUser() {
  const result = query('SELECT * FROM users LIMIT 1');
  return result[0] || null;
}
