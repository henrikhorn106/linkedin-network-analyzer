import { estimateCompanySize } from '../data/companySizes';
import { SENIORITY_KEYWORDS, BUSINESS_ROLES } from '../data/constants';

/**
 * Calculate a richer influence score for a contact.
 *
 * Factors:
 *  1. Seniority (0-10)       — highest weight, C-level = max influence
 *  2. Company reach           — log10 of estimated employees (bigger org = wider influence)
 *  3. Network density         — how many of your contacts are at this company (sqrt, diminishing)
 *  4. Role relevance          — bonus for business-facing roles (sales, partnerships, BD)
 *  5. Recency                 — recently connected contacts are more actionable
 *  6. Company relationships   — bonus if their company has links (customer, partner, etc.)
 */
function calculateInfluence(contact, seniority, companyMembers, estimatedSize, companyLinkCount) {
  // 1. Seniority (dominant factor): 0–30
  const seniorityScore = seniority * 3;

  // 2. Company reach: log10(employees), range ~1–6 → weighted 0–12
  const companyReach = Math.log10(Math.max(estimatedSize || 100, 10)) * 2;

  // 3. Network density: sqrt of contacts at company, capped → 0–6
  const networkDensity = Math.min(Math.sqrt(companyMembers) * 1.5, 6);

  // 4. Role relevance: business-facing roles get +3
  const posLower = (contact.position || '').toLowerCase();
  const roleBonus = BUSINESS_ROLES.some(r => posLower.includes(r)) ? 3 : 0;

  // 5. Recency: parse connectedOn, bonus for recent connections
  let recencyBonus = 0;
  if (contact.connectedOn) {
    try {
      // Handle various date formats (German locale, ISO, etc.)
      const dateStr = contact.connectedOn.replace(/\./g, '/');
      const connDate = new Date(dateStr);
      if (!isNaN(connDate.getTime())) {
        const monthsAgo = (Date.now() - connDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsAgo < 6) recencyBonus = 2;
        else if (monthsAgo < 12) recencyBonus = 1;
      }
    } catch { /* ignore unparsable dates */ }
  }

  // 6. Company relationships: bonus per link (customer/partner = more strategic value)
  const relationshipBonus = Math.min(companyLinkCount * 2, 8);

  return seniorityScore + companyReach + networkDensity + roleBonus + recencyBonus + relationshipBonus;
}

// Industry classification patterns (checked against company name + member positions)
const INDUSTRY_PATTERNS = {
  'Technology': ['software', 'tech', 'digital', 'saas', 'cloud', ' ai ', 'data ', 'cyber', 'platform', 'iot', 'robotik', 'informatik'],
  'Finance': ['bank', 'financ', 'finanz', 'invest', 'versicherung', 'insurance', 'capital', 'asset', 'credit', 'fintech'],
  'Consulting': ['consult', 'berat', 'advisory', 'strateg', 'pwc', 'deloitte', 'kpmg', 'mckinsey', 'accenture', 'bcg', 'ernst & young'],
  'Healthcare': ['health', 'medical', 'pharma', 'hospital', 'klinik', 'bio', 'medizin', 'gesundheit', 'clinic'],
  'Manufacturing': ['manufactur', 'industr', 'automotive', 'maschin', 'produk', 'engineer', 'fertigung', 'siemens', 'bosch'],
  'Marketing': ['market', 'media', 'agentur', 'agency', 'werb', 'brand', 'creative', 'design', 'kommunikation'],
  'Real Estate': ['real estate', 'immobil', 'property', 'bau', 'construc', 'archite'],
  'Education': ['universit', 'school', 'hochschule', 'bildung', 'academ', 'institut', 'forschung'],
  'Legal': ['law', 'legal', 'recht', 'kanzlei', 'attorney', 'anwalt', 'notar'],
  'Retail': ['retail', 'e-commerce', 'handel', 'shop', 'store', 'commerce', 'amazon'],
  'Energy': ['energy', 'energie', 'solar', 'renewable', 'power', 'strom', 'wind'],
  'Logistics': ['logist', 'transport', 'shipping', 'supply chain', 'freight', 'spedition'],
};

/**
 * Infer industry from company name and member positions
 */
export function inferIndustry(companyName, members = []) {
  const nameLower = ` ${(companyName || '').toLowerCase()} `;
  // Check company name first
  for (const [industry, keywords] of Object.entries(INDUSTRY_PATTERNS)) {
    if (keywords.some(k => nameLower.includes(k))) return industry;
  }
  // Fall back to member position keywords
  const posText = ` ${members.map(m => (m.position || '').toLowerCase()).join(' ')} `;
  for (const [industry, keywords] of Object.entries(INDUSTRY_PATTERNS)) {
    if (keywords.some(k => posText.includes(k))) return industry;
  }
  return 'Sonstige';
}

/**
 * Calculate seniority score based on position title
 */
export function calculateSeniority(position) {
  const posLower = (position || '').toLowerCase();
  for (const [score, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some(k => posLower.includes(k))) {
      return parseInt(score);
    }
  }
  return 1;
}

/**
 * Build network data structure from contacts
 * @param {Array} contacts - All contacts
 * @param {number} minCompanySize - Minimum contacts per company to show
 * @param {string} userCompany - User's own company name (always shown, centered)
 * @param {string} industryFilter - Industry to filter by ("all" = no filter)
 * @param {Array} companyRelationships - Company-to-company relationships [{source, target, type}]
 */
export function buildNetwork(contacts, minCompanySize = 1, userCompany = null, industryFilter = "all", companyRelationships = [], companyEnrichments = {}, focusCompanyNames = null) {
  // Group contacts by company (case-insensitive, preserving first-seen casing)
  const companyMap = {};
  const companyCanonical = {}; // lowercase -> first-seen casing
  contacts.forEach(c => {
    const rawVal = c.company?.trim();
    const raw = (!rawVal || rawVal === "Unknown") ? "Unbekannt" : rawVal;
    const key = raw.toLowerCase();
    if (!companyCanonical[key]) companyCanonical[key] = raw;
    const co = companyCanonical[key];
    if (!companyMap[co]) companyMap[co] = [];
    companyMap[co].push(c);
  });

  // Filter by minimum company size, but always include user's company and focused companies
  const filteredCompanyMap = {};
  Object.entries(companyMap).forEach(([name, members]) => {
    const isUserCompany = userCompany && name.trim().toLowerCase() === userCompany.trim().toLowerCase();
    const isFocused = focusCompanyNames && focusCompanyNames.has(name.trim().toLowerCase());
    if (members.length >= minCompanySize || isUserCompany || isFocused) {
      filteredCompanyMap[name] = members;
    }
  });

  // Ensure user's company always exists in the map, even with 0 filtered contacts
  if (userCompany && !Object.keys(filteredCompanyMap).some(
    name => name.trim().toLowerCase() === userCompany.trim().toLowerCase()
  )) {
    filteredCompanyMap[userCompany] = [];
  }

  // Create company nodes with estimated sizes and industry
  const companyNodes = Object.entries(filteredCompanyMap)
    .map(([name, members]) => {
      const enrichedSize = companyEnrichments[name]?.estimated_size;
      const customSize = members.find(m => m.customEstimatedSize)?.customEstimatedSize;
      const estimatedSize = enrichedSize || customSize || estimateCompanySize(name, members);
      const isUserCompany = userCompany && name.toLowerCase() === userCompany.toLowerCase();
      const industry = inferIndustry(name, members);
      return {
        id: `company_${name}`,
        name,
        type: "company",
        memberCount: members.length,
        members,
        estimatedSize,
        isUserCompany,
        industry,
      };
    })
    // Filter by industry (always keep user's company and focused companies)
    .filter(c => c.isUserCompany || industryFilter === "all" || c.industry === industryFilter || (focusCompanyNames && focusCompanyNames.has(c.name.trim().toLowerCase())))
    // Sort so user's company comes first
    .sort((a, b) => (b.isUserCompany ? 1 : 0) - (a.isUserCompany ? 1 : 0));

  // Create contact nodes (only for companies that passed all filters)
  const includedCompanies = new Set(companyNodes.map(c => c.name));
  const companySizeMap = {};
  companyNodes.forEach(c => { companySizeMap[c.name] = c.estimatedSize; });

  // Count company relationships per company name
  const companyLinkCounts = {};
  (companyRelationships || []).forEach(rel => {
    // source/target are like "company_ACME" — extract the name
    const src = (rel.source || '').replace(/^company_/, '');
    const tgt = (rel.target || '').replace(/^company_/, '');
    companyLinkCounts[src] = (companyLinkCounts[src] || 0) + 1;
    companyLinkCounts[tgt] = (companyLinkCounts[tgt] || 0) + 1;
  });

  const normalizeCompany = (name) => {
    const trimmed = name?.trim();
    return (!trimmed || trimmed === "Unknown") ? "Unbekannt" : trimmed;
  };

  const contactNodes = contacts
    .filter(c => includedCompanies.has(normalizeCompany(c.company)))
    .map(c => {
      const co = normalizeCompany(c.company);
      const seniority = calculateSeniority(c.position);
      const companyMembers = filteredCompanyMap[co]?.length || 1;
      const estimatedSize = companySizeMap[co] || 100;
      const companyLinkCount = companyLinkCounts[co] || 0;
      const influenceScore = calculateInfluence(c, seniority, companyMembers, estimatedSize, companyLinkCount);
      const isUser = typeof c.id === 'string' && c.id.startsWith('user_');

      return {
        ...c,
        company: co,
        type: "contact",
        companyId: `company_${co}`,
        seniority,
        influenceScore,
        isUser,
      };
    });

  // Normalize influence scores
  const maxInf = Math.max(...contactNodes.map(c => c.influenceScore), 1);
  contactNodes.forEach(c => {
    c.normalizedInfluence = c.influenceScore / maxInf;
  });

  // Create links between contacts and their companies
  const links = contactNodes
    .map(c => ({
      source: c.id,
      target: c.companyId,
      type: "employment"
    }));

  // Sort companies by estimated size
  companyNodes.sort((a, b) => (b.estimatedSize || 0) - (a.estimatedSize || 0));

  // Collect all unique industries (from ALL companies before industry filter, so dropdown stays stable)
  const allIndustries = [...new Set(
    Object.entries(filteredCompanyMap).map(([name, members]) => inferIndustry(name, members))
  )].sort();

  return {
    nodes: [...contactNodes, ...companyNodes],
    contactNodes,
    companyNodes,
    links,
    companyMap: filteredCompanyMap,
    totalContacts: contacts.length,
    filteredContacts: contactNodes.length,
    allIndustries,
  };
}

/**
 * Infer company-to-company connections based on shared contacts
 */
export function inferCompanyConnections(contacts, companyNodes, minSharedContacts = 2) {
  // Group contacts by company
  const companyContacts = {};
  contacts.forEach(c => {
    const co = c.company?.trim();
    if (!co || co === "Unbekannt" || co === "Unknown") return;
    if (!companyContacts[co]) companyContacts[co] = [];
    companyContacts[co].push(c);
  });

  const connections = [];
  const companyNames = Object.keys(companyContacts);

  // For each pair of companies, calculate connection strength
  for (let i = 0; i < companyNames.length; i++) {
    for (let j = i + 1; j < companyNames.length; j++) {
      const companyA = companyNames[i];
      const companyB = companyNames[j];
      const contactsA = companyContacts[companyA];
      const contactsB = companyContacts[companyB];

      // Calculate strength based on business roles
      let strengthA = 0;
      let strengthB = 0;

      contactsA.forEach(c => {
        const posLower = (c.position || '').toLowerCase();
        const hasBusinessRole = BUSINESS_ROLES.some(r => posLower.includes(r));
        strengthA += hasBusinessRole ? 2 : 1;
      });

      contactsB.forEach(c => {
        const posLower = (c.position || '').toLowerCase();
        const hasBusinessRole = BUSINESS_ROLES.some(r => posLower.includes(r));
        strengthB += hasBusinessRole ? 2 : 1;
      });

      // Geometric mean of both sides
      const strength = Math.sqrt(strengthA * strengthB);

      // Only create connection if both have enough contacts
      if (contactsA.length >= minSharedContacts &&
          contactsB.length >= minSharedContacts &&
          strength >= 3) {
        connections.push({
          source: `company_${companyA}`,
          target: `company_${companyB}`,
          type: "inferred",
          strength: Math.min(strength / 10, 1),
          contactsA: contactsA.length,
          contactsB: contactsB.length,
        });
      }
    }
  }

  // Sort by strength and limit to avoid clutter
  connections.sort((a, b) => b.strength - a.strength);
  return connections.slice(0, 30);
}
