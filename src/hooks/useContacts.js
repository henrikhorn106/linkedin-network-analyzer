import { useState, useCallback, useMemo, useEffect } from 'react';
import { calculateSeniority } from '../utils/networkBuilder';
import { query, execute, lastInsertRowId, getDatabase, persistDatabase } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

/**
 * Hook for managing contacts state with SQLite persistence
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
        'SELECT * FROM contacts WHERE user_id = ? ORDER BY id DESC',
        [userId]
      );
      // Transform database rows to contact objects
      const contactsList = rows.map(row => ({
        id: row.external_id || `db_${row.id}`,
        dbId: row.id,
        name: row.name,
        company: row.company,
        position: row.position,
        connectedOn: row.connected_on,
        isCompanyPlaceholder: row.is_company_placeholder === 1,
        customEstimatedSize: row.custom_estimated_size,
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

  // Load contacts from database when initialized and userId changes
  useEffect(() => {
    if (isInitialized && userId) {
      loadContacts();
    } else if (!userId) {
      setContacts([]);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadContacts]);

  // Add a new contact
  const addContact = useCallback(async (contact) => {
    if (!userId) return;
    const externalId = contact.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      await execute(
        `INSERT INTO contacts (user_id, external_id, name, company, position, connected_on, is_company_placeholder, custom_estimated_size, linkedin_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          externalId,
          contact.name,
          contact.company || null,
          contact.position || null,
          contact.connectedOn || null,
          contact.isCompanyPlaceholder ? 1 : 0,
          contact.customEstimatedSize || null,
          contact.linkedinUrl || null,
        ]
      );
      const dbId = lastInsertRowId('contacts');

      const newContact = {
        ...contact,
        id: externalId,
        dbId,
      };
      setContacts(prev => [newContact, ...prev]);
    } catch (err) {
      // Handle duplicate external_id by updating instead
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

    try {
      await execute(
        `UPDATE contacts
         SET name = ?, company = ?, position = ?, connected_on = ?, is_company_placeholder = ?, custom_estimated_size = ?, linkedin_url = ?
         WHERE (external_id = ? OR id = ?) AND user_id = ?`,
        [
          updatedContact.name,
          updatedContact.company || null,
          updatedContact.position || null,
          updatedContact.connectedOn || null,
          updatedContact.isCompanyPlaceholder ? 1 : 0,
          updatedContact.customEstimatedSize || null,
          updatedContact.linkedinUrl || null,
          updatedContact.id,
          updatedContact.dbId || 0,
          userId,
        ]
      );

      setContacts(prev => prev.map(c =>
        c.id === updatedContact.id ? { ...c, ...updatedContact } : c
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

      // Load existing contacts for dedup by name+company (case-insensitive)
      const existingRows = query('SELECT id, external_id, name, company FROM contacts WHERE user_id = ?', [userId]);
      const existingMap = new Map();
      existingRows.forEach(row => {
        const key = `${row.name.toLowerCase()}||${(row.company || '').toLowerCase()}`;
        existingMap.set(key, row);
      });

      const addedContacts = [];

      for (const contact of newContacts) {
        const externalId = contact.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const dedupKey = `${contact.name.toLowerCase()}||${(contact.company || '').toLowerCase()}`;
        const existing = existingMap.get(dedupKey);

        if (existing) {
          // Update existing contact with newer data (position, linkedinUrl, etc.)
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
              `INSERT INTO contacts (user_id, external_id, name, company, position, connected_on, is_company_placeholder, custom_estimated_size, linkedin_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                userId,
                externalId,
                contact.name,
                contact.company || null,
                contact.position || null,
                contact.connectedOn || null,
                contact.isCompanyPlaceholder ? 1 : 0,
                contact.customEstimatedSize || null,
                contact.linkedinUrl || null,
              ]
            );

            addedContacts.push({
              ...contact,
              id: externalId,
            });
            // Track for dedup within same batch
            existingMap.set(dedupKey, { id: 0, name: contact.name, company: contact.company });
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

  // Import contacts from CSV (upserts, preserves manual contacts)
  const setAllContacts = useCallback(async (newContacts) => {
    if (!userId) return;

    try {
      if (newContacts.length > 0) {
        await addContacts(newContacts);
      }
    } catch (err) {
      console.error('Failed to import contacts:', err);
      throw err;
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

  // Rename a company across all contacts (and optionally update estimated size)
  const renameCompany = useCallback(async (oldName, newName, newEstimatedSize) => {
    if (!userId) return;
    try {
      await execute(
        'UPDATE contacts SET company = ?, custom_estimated_size = ? WHERE company = ? AND user_id = ?',
        [newName, newEstimatedSize || null, oldName, userId]
      );
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
      await execute(
        'DELETE FROM contacts WHERE company = ? AND user_id = ?',
        [companyName, userId]
      );
      loadContacts();
    } catch (err) {
      console.error('Failed to delete company contacts:', err);
      throw err;
    }
  }, [userId, loadContacts]);

  // Get list of unique company names
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
