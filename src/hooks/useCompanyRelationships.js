import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

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
        source: row.source_company,
        target: row.target_company,
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

  // Add a new relationship
  const addRelationship = useCallback(async (relationship) => {
    if (!userId) return;

    try {
      await execute(
        `INSERT INTO company_relationships (user_id, source_company, target_company, relationship_type)
         VALUES (?, ?, ?, ?)`,
        [userId, relationship.source, relationship.target, relationship.type]
      );
      const id = lastInsertRowId('company_relationships');

      const newRel = { ...relationship, id };
      setRelationships(prev => [...prev, newRel]);
      return newRel;
    } catch (err) {
      console.error('Failed to add relationship:', err);
      throw err;
    }
  }, [userId]);

  // Delete a relationship by index (for compatibility with existing code)
  const deleteRelationshipByIndex = useCallback(async (index) => {
    if (!userId) return;

    try {
      const rel = relationships[index];
      if (rel) {
        await execute(
          'DELETE FROM company_relationships WHERE id = ? AND user_id = ?',
          [rel.id, userId]
        );
        setRelationships(prev => prev.filter((_, i) => i !== index));
      }
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      throw err;
    }
  }, [userId, relationships]);

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
    deleteRelationshipByIndex,
    clearRelationships,
    reloadRelationships: loadRelationships,
  };
}
