import { useState, useCallback, useMemo, useEffect } from 'react';
import { calculateSeniority } from '../utils/networkBuilder';
import { query, execute, lastInsertRowId, getDatabase, persistDatabase, getOrCreateCompany } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

/**
 * Hook for managing contacts state with SQLite persistence.
 * Contacts JOIN with companies to provide company_name for backward compat.
 */
export function useContacts(userId) {
  const { isInitialized } = useDatabase();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContacts = useCallback(() => {
    if (!isInitialized || !userId) return;
    setIsLoading(true);
    try {
      const rows = query(
        `SELECT c.*, co.name as company_name
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.user_id = ? ORDER BY c.id DESC`,
        [userId]
      );
      const contactsList = rows.map(row => ({
        id: row.external_id || `db_${row.id}`,
        dbId: row.id,
        name: row.name,
        company: row.company_name || null,    // backward compat: string name
        companyId: row.company_id,            // numeric FK
        position: row.position,
        connectedOn: row.connected_on,
        linkedinUrl: row.linkedin_url,
      }));
      setContacts(contactsList);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId]);

  useEffect(() => {
    if (isInitialized && userId) {
      loadContacts();
    } else if (!userId) {
      setContacts([]);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadContacts]);

  // Add a new contact — resolves company name -> company_id
  const addContact = useCallback(async (contact) => {
    if (!userId) return;
    const externalId = contact.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Resolve company name to FK
    let companyId = contact.companyId || null;
    if (!companyId && contact.company) {
      companyId = await getOrCreateCompany(userId, contact.company);
    }

    try {
      await execute(
        `INSERT INTO contacts (user_id, external_id, name, company_id, position, connected_on, linkedin_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          externalId,
          contact.name,
          companyId,
          contact.position || null,
          contact.connectedOn || null,
          contact.linkedinUrl || null,
        ]
      );
      const dbId = lastInsertRowId('contacts');

      const newContact = {
        ...contact,
        id: externalId,
        dbId,
        companyId,
      };
      setContacts(prev => [newContact, ...prev]);
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        await updateContact(contact);
      } else {
        console.error('Failed to add contact:', err);
        throw err;
      }
    }
  }, [userId]);

  // Update an existing contact
  const updateContact = useCallback(async (updatedContact) => {
    if (!userId) return;

    // Resolve company name to FK if changed
    let companyId = updatedContact.companyId || null;
    if (!companyId && updatedContact.company) {
      companyId = await getOrCreateCompany(userId, updatedContact.company);
    }

    try {
      await execute(
        `UPDATE contacts
         SET name = ?, company_id = ?, position = ?, connected_on = ?, linkedin_url = ?
         WHERE (external_id = ? OR id = ?) AND user_id = ?`,
        [
          updatedContact.name,
          companyId,
          updatedContact.position || null,
          updatedContact.connectedOn || null,
          updatedContact.linkedinUrl || null,
          updatedContact.id,
          updatedContact.dbId || 0,
          userId,
        ]
      );

      setContacts(prev => prev.map(c =>
        c.id === updatedContact.id ? { ...c, ...updatedContact, companyId } : c
      ));
    } catch (err) {
      console.error('Failed to update contact:', err);
      throw err;
    }
  }, [userId]);

  // Delete a contact
  const deleteContact = useCallback(async (contactId) => {
    if (!userId) return;

    try {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        await execute(
          'DELETE FROM contacts WHERE (external_id = ? OR id = ?) AND user_id = ?',
          [contactId, contact.dbId || 0, userId]
        );
      }
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (err) {
      console.error('Failed to delete contact:', err);
      throw err;
    }
  }, [userId, contacts]);

  // Bulk add contacts with name+company dedup (e.g., from CSV import)
  const addContacts = useCallback(async (newContacts) => {
    if (!userId || !newContacts.length) return;

    try {
      const db = getDatabase();
      db.run('BEGIN TRANSACTION');

      // Pre-resolve all unique company names in one pass
      const uniqueCompanies = [...new Set(
        newContacts.map(c => c.company?.trim()).filter(Boolean)
      )];
      const companyIdCache = {};
      for (const name of uniqueCompanies) {
        const existing = query(
          'SELECT id FROM companies WHERE user_id = ? AND LOWER(name) = LOWER(?)',
          [userId, name]
        );
        if (existing.length > 0) {
          companyIdCache[name.toLowerCase()] = existing[0].id;
        } else {
          db.run('INSERT INTO companies (user_id, name) VALUES (?, ?)', [userId, name]);
          const idRow = db.exec('SELECT MAX(id) as id FROM companies');
          companyIdCache[name.toLowerCase()] = idRow[0].values[0][0];
        }
      }

      // Load existing contacts for dedup by name+company (case-insensitive)
      const existingRows = query(
        `SELECT c.id, c.external_id, c.name, co.name as company_name
         FROM contacts c LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.user_id = ?`,
        [userId]
      );
      const existingMap = new Map();
      existingRows.forEach(row => {
        const key = `${row.name.toLowerCase()}||${(row.company_name || '').toLowerCase()}`;
        existingMap.set(key, row);
      });

      for (const contact of newContacts) {
        const externalId = contact.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const coName = contact.company?.trim() || '';
        const companyId = coName ? (companyIdCache[coName.toLowerCase()] || null) : null;
        const dedupKey = `${contact.name.toLowerCase()}||${coName.toLowerCase()}`;
        const existing = existingMap.get(dedupKey);

        if (existing) {
          db.run(
            `UPDATE contacts SET position = COALESCE(?, position), connected_on = COALESCE(?, connected_on), linkedin_url = COALESCE(?, linkedin_url)
             WHERE id = ?`,
            [
              contact.position || null,
              contact.connectedOn || null,
              contact.linkedinUrl || null,
              existing.id,
            ]
          );
        } else {
          try {
            db.run(
              `INSERT INTO contacts (user_id, external_id, name, company_id, position, connected_on, linkedin_url)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                userId,
                externalId,
                contact.name,
                companyId,
                contact.position || null,
                contact.connectedOn || null,
                contact.linkedinUrl || null,
              ]
            );
            existingMap.set(dedupKey, { id: 0, name: contact.name, company_name: coName });
          } catch (err) {
            if (!err.message?.includes('UNIQUE constraint failed')) {
              throw err;
            }
          }
        }
      }

      db.run('COMMIT');
      await persistDatabase();

      // Reload all contacts from DB to get clean state
      loadContacts();
    } catch (err) {
      console.error('Failed to bulk add contacts:', err);
      const db = getDatabase();
      db.run('ROLLBACK');
      throw err;
    }
  }, [userId, loadContacts]);

  // Import contacts from CSV
  const setAllContacts = useCallback(async (newContacts) => {
    if (!userId) return;
    if (newContacts.length > 0) {
      await addContacts(newContacts);
    }
  }, [userId, addContacts]);

  // Clear all contacts
  const clearContacts = useCallback(async () => {
    if (!userId) return;
    try {
      await execute('DELETE FROM contacts WHERE user_id = ?', [userId]);
      setContacts([]);
    } catch (err) {
      console.error('Failed to clear contacts:', err);
      throw err;
    }
  }, [userId]);

  // Rename a company — just updates companies.name; FK means contacts auto-follow
  const renameCompany = useCallback(async (oldName, newName, newEstimatedSize) => {
    if (!userId) return;
    try {
      const existing = query(
        'SELECT id FROM companies WHERE user_id = ? AND LOWER(name) = LOWER(?)',
        [userId, oldName]
      );
      if (existing.length > 0) {
        const fields = ['name = ?'];
        const vals = [newName];
        if (newEstimatedSize !== undefined) {
          fields.push('estimated_size = ?');
          vals.push(newEstimatedSize || null);
        }
        vals.push(existing[0].id);
        await execute(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`, vals);
      }
      loadContacts();
    } catch (err) {
      console.error('Failed to rename company:', err);
      throw err;
    }
  }, [userId, loadContacts]);

  // Delete all contacts for a given company
  const deleteCompanyContacts = useCallback(async (companyName) => {
    if (!userId) return;
    try {
      const co = query(
        'SELECT id FROM companies WHERE user_id = ? AND LOWER(name) = LOWER(?)',
        [userId, companyName]
      );
      if (co.length > 0) {
        await execute('DELETE FROM contacts WHERE company_id = ? AND user_id = ?', [co[0].id, userId]);
      }
      loadContacts();
    } catch (err) {
      console.error('Failed to delete company contacts:', err);
      throw err;
    }
  }, [userId, loadContacts]);

  // Get list of unique company names (from contacts — for modals/autocomplete)
  const existingCompanies = useMemo(() => {
    const companies = new Set(
      contacts.map(c => c.company?.trim()).filter(Boolean)
    );
    return Array.from(companies).sort();
  }, [contacts]);

  // Filter contacts by seniority level
  const filterBySeniority = useCallback((minSeniority) => {
    if (minSeniority === 0) return contacts;
    return contacts.filter(c => {
      const seniority = calculateSeniority(c.position);
      return seniority >= minSeniority;
    });
  }, [contacts]);

  return {
    contacts,
    isLoading,
    addContact,
    updateContact,
    deleteContact,
    addContacts,
    setAllContacts,
    clearContacts,
    existingCompanies,
    filterBySeniority,
    renameCompany,
    deleteCompanyContacts,
    reloadContacts: loadContacts,
  };
}
