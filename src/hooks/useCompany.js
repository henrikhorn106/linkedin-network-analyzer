import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

export function useCompany(userId) {
  const { isInitialized } = useDatabase();
  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCompany = useCallback(() => {
    if (!isInitialized || !userId) return;
    setIsLoading(true);
    try {
      const companies = query(
        'SELECT * FROM companies WHERE user_id = ? LIMIT 1',
        [userId]
      );
      setCompany(companies[0] || null);
    } catch (err) {
      console.error('Failed to load company:', err);
      setCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId]);

  // Load company when database is initialized and userId changes
  useEffect(() => {
    if (isInitialized && userId) {
      loadCompany();
    } else if (!userId) {
      setCompany(null);
      setIsLoading(false);
    }
  }, [isInitialized, userId, loadCompany]);

  const createCompany = useCallback(async (companyData) => {
    if (!userId) return null;
    const { name, estimated_size, industry, color } = companyData;
    await execute(
      'INSERT INTO companies (user_id, name, estimated_size, industry, color) VALUES (?, ?, ?, ?, ?)',
      [userId, name, estimated_size || null, industry || null, color || null]
    );
    const id = lastInsertRowId('companies');
    const newCompany = { id, user_id: userId, name, estimated_size, industry, color };
    setCompany(newCompany);
    return newCompany;
  }, [userId]);

  const updateCompany = useCallback(async (companyData) => {
    if (!company) return null;
    const { name, estimated_size, industry, color } = companyData;
    await execute(
      'UPDATE companies SET name = ?, estimated_size = ?, industry = ?, color = ? WHERE id = ?',
      [name, estimated_size || null, industry || null, color !== undefined ? color : company.color || null, company.id]
    );
    const updatedCompany = { ...company, name, estimated_size, industry, color: color !== undefined ? color : company.color };
    setCompany(updatedCompany);
    return updatedCompany;
  }, [company]);

  const deleteCompany = useCallback(async () => {
    if (!company) return;
    await execute('DELETE FROM companies WHERE id = ?', [company.id]);
    setCompany(null);
  }, [company]);

  // Get enrichment data for any company by name
  const getCompanyEnrichment = useCallback((companyName) => {
    if (!isInitialized || !userId) return null;
    try {
      const rows = query(
        'SELECT * FROM companies WHERE user_id = ? AND name = ? LIMIT 1',
        [userId, companyName]
      );
      return rows[0] || null;
    } catch (err) {
      console.error('Failed to get company enrichment:', err);
      return null;
    }
  }, [isInitialized, userId]);

  // Save enrichment data for any company (upsert)
  const saveCompanyEnrichment = useCallback(async (companyName, enrichmentData) => {
    if (!userId) return null;

    // Normalize: convert null/undefined to empty string for text fields
    const d = {
      description: enrichmentData.description || '',
      website: enrichmentData.website || '',
      headquarters: enrichmentData.headquarters || '',
      founded_year: enrichmentData.founded_year || null,
      company_type: enrichmentData.company_type || '',
      linkedin_url: enrichmentData.linkedin_url || '',
      industry: enrichmentData.industry || '',
      estimated_size: enrichmentData.estimated_size || null,
    };

    const existing = getCompanyEnrichment(companyName);
    const now = new Date().toISOString();

    if (existing) {
      await execute(
        `UPDATE companies SET
          description = ?, website = ?, headquarters = ?, founded_year = ?,
          company_type = ?, linkedin_url = ?, enriched_at = ?,
          industry = COALESCE(NULLIF(?, ''), industry),
          estimated_size = COALESCE(?, estimated_size)
        WHERE id = ?`,
        [
          d.description,
          d.website,
          d.headquarters,
          d.founded_year,
          d.company_type,
          d.linkedin_url,
          now,
          d.industry,
          d.estimated_size,
          existing.id,
        ]
      );
      return { ...existing, ...d, enriched_at: now };
    } else {
      await execute(
        `INSERT INTO companies (user_id, name, description, website, headquarters, founded_year, company_type, linkedin_url, enriched_at, industry, estimated_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          companyName,
          d.description,
          d.website,
          d.headquarters,
          d.founded_year,
          d.company_type,
          d.linkedin_url,
          now,
          d.industry,
          d.estimated_size,
        ]
      );
      return { name: companyName, ...d, enriched_at: now };
    }
  }, [userId, getCompanyEnrichment]);

  return {
    company,
    isLoading,
    createCompany,
    updateCompany,
    deleteCompany,
    reloadCompany: loadCompany,
    getCompanyEnrichment,
    saveCompanyEnrichment,
  };
}
