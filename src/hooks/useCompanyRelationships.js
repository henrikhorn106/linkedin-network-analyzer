import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

const stripPrefix = (name) => name?.startsWith('company_') ? name.slice(8) : name;
const addPrefix = (name) => name ? `company_${name}` : name;

/**
 * Hook for managing company-to-company relationships with SQLite persistence
 */
export function useCompanyRelationships(userId) {
  const { isInitialized } = useDatabase();
  const [relationships, setRelationships] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRelationships = useCallback(() => {
    if (!isInitialized || !userId) return;
    setIsLoading(true);
    try {
      const rows = query(
        'SELECT * FROM company_relationships WHERE user_id = ? ORDER BY id DESC',
        [userId]
      );
      const rels = rows.map(row => ({
        id: row.id,
        source: addPrefix(row.source_company),
        target: addPrefix(row.target_company),
        type: row.relationship_type,
      }));
      setRelationships(rels);
    } catch (err) {
      console.error('Failed to load company relationships:', err);
      setRelationships([]);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId]);

  // Load relationships when database is initialized and userId changes
  useEffect(() => {
    if (isInitialized && userId) {
      loadRelationships();
    } else if (!userId) {
      setRelationships([]);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadRelationships]);

  // Add a new relationship (with duplicate prevention)
  const addRelationship = useCallback(async (relationship) => {
    if (!userId) return;

    const cleanSource = stripPrefix(relationship.source);
    const cleanTarget = stripPrefix(relationship.target);

    // Check for duplicate
    const existing = query(
      `SELECT id FROM company_relationships
       WHERE user_id = ? AND source_company = ? AND target_company = ? AND relationship_type = ?`,
      [userId, cleanSource, cleanTarget, relationship.type]
    );
    if (existing.length > 0) return existing[0];

    try {
      // Auto-upgrade: creating "customer" removes existing "lead" between same pair
      if (relationship.type === 'customer') {
        const leadRows = query(
          `SELECT id FROM company_relationships
           WHERE user_id = ? AND source_company = ? AND target_company = ? AND relationship_type = 'lead'`,
          [userId, cleanSource, cleanTarget]
        );
        for (const row of leadRows) {
          await execute('DELETE FROM company_relationships WHERE id = ?', [row.id]);
        }
        if (leadRows.length > 0) {
          setRelationships(prev => prev.filter(r => !leadRows.some(lr => lr.id === r.id)));
        }
      }

      await execute(
        `INSERT INTO company_relationships (user_id, source_company, target_company, relationship_type, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [userId, cleanSource, cleanTarget, relationship.type]
      );
      const id = lastInsertRowId('company_relationships');

      const newRel = {
        id,
        source: addPrefix(cleanSource),
        target: addPrefix(cleanTarget),
        type: relationship.type,
      };
      setRelationships(prev => [...prev, newRel]);
      return newRel;
    } catch (err) {
      console.error('Failed to add relationship:', err);
      throw err;
    }
  }, [userId]);

  // Delete a relationship by id
  const deleteRelationship = useCallback(async (relId) => {
    if (!userId) return;

    try {
      await execute(
        'DELETE FROM company_relationships WHERE id = ? AND user_id = ?',
        [relId, userId]
      );
      setRelationships(prev => prev.filter(r => r.id !== relId));
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      throw err;
    }
  }, [userId]);

  // Clear all relationships
  const clearRelationships = useCallback(async () => {
    if (!userId) return;

    try {
      await execute('DELETE FROM company_relationships WHERE user_id = ?', [userId]);
      setRelationships([]);
    } catch (err) {
      console.error('Failed to clear relationships:', err);
      throw err;
    }
  }, [userId]);

  return {
    relationships,
    isLoading,
    addRelationship,
    deleteRelationship,
    clearRelationships,
    reloadRelationships: loadRelationships,
  };
}
