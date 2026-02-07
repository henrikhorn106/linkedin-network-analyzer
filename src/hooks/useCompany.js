import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId, getOrCreateCompany } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

/**
 * Hook for managing ALL companies (first-class entities).
 * Derives userCompany from profile.company_id.
 */
export function useCompany(userId) {
  const { isInitialized } = useDatabase();
  const [companies, setCompanies] = useState([]);
  const [userCompany, setUserCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCompanies = useCallback(() => {
    if (!isInitialized || !userId) return;
    setIsLoading(true);
    try {
      const rows = query('SELECT * FROM companies WHERE user_id = ? ORDER BY id', [userId]);
      setCompanies(rows);

      // Derive userCompany from profile.company_id
      const profileRows = query('SELECT company_id FROM profile WHERE id = ?', [userId]);
      const companyId = profileRows[0]?.company_id;
      if (companyId) {
        setUserCompany(rows.find(c => c.id === companyId) || null);
      } else {
        setUserCompany(null);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      setCompanies([]);
      setUserCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId]);

  useEffect(() => {
    if (isInitialized && userId) {
      loadCompanies();
    } else if (!userId) {
      setCompanies([]);
      setUserCompany(null);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadCompanies]);

  const createCompany = useCallback(async (companyData) => {
    if (!userId) return null;
    const { name, estimated_size, industry, color } = companyData;
    await execute(
      'INSERT INTO companies (user_id, name, estimated_size, industry, color) VALUES (?, ?, ?, ?, ?)',
      [userId, name, estimated_size || null, industry || null, color || null]
    );
    const id = lastInsertRowId('companies');
    const newCompany = { id, user_id: userId, name, estimated_size, industry, color };
    setCompanies(prev => [...prev, newCompany]);
    return newCompany;
  }, [userId]);

  const updateCompany = useCallback(async (companyId, companyData) => {
    if (!userId) return null;
    const existing = companies.find(c => c.id === companyId);
    if (!existing) return null;

    // Build dynamic SET clause from provided fields
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(companyData)) {
      if (key === 'id' || key === 'user_id') continue;
      fields.push(`${key} = ?`);
      values.push(val !== undefined ? val : null);
    }
    if (fields.length === 0) return existing;

    values.push(companyId);
    await execute(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const updated = { ...existing, ...companyData };
    setCompanies(prev => prev.map(c => c.id === companyId ? updated : c));
    if (userCompany?.id === companyId) {
      setUserCompany(updated);
    }
    return updated;
  }, [userId, companies, userCompany]);

  const deleteCompany = useCallback(async (companyId) => {
    if (!userId) return;
    const id = companyId || userCompany?.id;
    if (!id) return;
    // Unlink contacts referencing this company
    await execute('UPDATE contacts SET company_id = NULL WHERE company_id = ? AND user_id = ?', [id, userId]);
    // Delete relations
    await execute('DELETE FROM relations WHERE (source_company_id = ? OR target_company_id = ?) AND user_id = ?', [id, id, userId]);
    await execute('DELETE FROM companies WHERE id = ? AND user_id = ?', [id, userId]);
    setCompanies(prev => prev.filter(c => c.id !== id));
    if (userCompany?.id === id) {
      setUserCompany(null);
      await execute('UPDATE profile SET company_id = NULL WHERE id = ?', [userId]);
    }
  }, [userId, userCompany]);

  // Get company by name (case-insensitive)
  const getCompanyByName = useCallback((name) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return companies.find(c => c.name.toLowerCase().trim() === lower) || null;
  }, [companies]);

  // Get or create company ID by name
  const getOrCreateCompanyId = useCallback(async (name) => {
    if (!userId || !name?.trim()) return null;
    return await getOrCreateCompany(userId, name);
  }, [userId]);

  return {
    companies,
    company: userCompany,     // backward compat: "company" = user's company
    userCompany,
    isLoading,
    createCompany,
    updateCompany,
    deleteCompany,
    getCompanyByName,
    getOrCreateCompanyId,
    reloadCompanies: loadCompanies,
  };
}
