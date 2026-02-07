import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

/**
 * Hook for managing company-to-company relationships with SQLite persistence.
 * Uses numeric company IDs (source_company_id, target_company_id).
 * Exposes source/target as D3-compatible `company_${id}` strings.
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
        'SELECT * FROM relations WHERE user_id = ? ORDER BY id DESC',
        [userId]
      );
      const rels = rows.map(row => ({
        id: row.id,
        source: `company_${row.source_company_id}`,
        target: `company_${row.target_company_id}`,
        sourceCompanyId: row.source_company_id,
        targetCompanyId: row.target_company_id,
        type: row.type,
      }));
      setRelationships(rels);
    } catch (err) {
      console.error('Failed to load relationships:', err);
      setRelationships([]);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId]);

  useEffect(() => {
    if (isInitialized && userId) {
      loadRelationships();
    } else if (!userId) {
      setRelationships([]);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadRelationships]);

  // Add a new relationship (with duplicate prevention)
  // Accepts { source, target, type } where source/target are `company_${id}` strings
  // OR { sourceCompanyId, targetCompanyId, type } with numeric IDs
  const addRelationship = useCallback(async (relationship) => {
    if (!userId) return;

    // Extract numeric IDs
    let srcId = relationship.sourceCompanyId;
    let tgtId = relationship.targetCompanyId;
    if (!srcId && relationship.source) {
      srcId = parseInt(relationship.source.replace('company_', ''), 10);
    }
    if (!tgtId && relationship.target) {
      tgtId = parseInt(relationship.target.replace('company_', ''), 10);
    }
    if (!srcId || !tgtId || isNaN(srcId) || isNaN(tgtId)) return;

    // Check for duplicate
    const existing = query(
      `SELECT id FROM relations
       WHERE user_id = ? AND source_company_id = ? AND target_company_id = ? AND type = ?`,
      [userId, srcId, tgtId, relationship.type]
    );
    if (existing.length > 0) return existing[0];

    try {
      // Auto-upgrade: creating "customer" removes existing "lead" between same pair
      if (relationship.type === 'customer') {
        const leadRows = query(
          `SELECT id FROM relations
           WHERE user_id = ? AND source_company_id = ? AND target_company_id = ? AND type = 'lead'`,
          [userId, srcId, tgtId]
        );
        for (const row of leadRows) {
          await execute('DELETE FROM relations WHERE id = ?', [row.id]);
        }
        if (leadRows.length > 0) {
          setRelationships(prev => prev.filter(r => !leadRows.some(lr => lr.id === r.id)));
        }
      }

      await execute(
        `INSERT INTO relations (user_id, source_company_id, target_company_id, type, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [userId, srcId, tgtId, relationship.type]
      );
      const id = lastInsertRowId('relations');

      const newRel = {
        id,
        source: `company_${srcId}`,
        target: `company_${tgtId}`,
        sourceCompanyId: srcId,
        targetCompanyId: tgtId,
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
        'DELETE FROM relations WHERE id = ? AND user_id = ?',
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
      await execute('DELETE FROM relations WHERE user_id = ?', [userId]);
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
