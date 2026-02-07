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
 * Build network data structure from contacts and companies.
 * Companies are first-class entities; node IDs are `company_${numericId}`.
 *
 * @param {Array} contacts - All contacts (with .company string name and .companyId numeric FK)
 * @param {Array} companies - All company rows from DB
 * @param {number} minCompanySize - Minimum contacts per company to show
 * @param {number|null} userCompanyId - Numeric ID of user's own company
 * @param {string} industryFilter - Industry to filter by ("all" = no filter)
 * @param {Array} companyRelationships - [{source, target, type}] where source/target are `company_${id}`
 * @param {Set|null} focusCompanyIds - Set of numeric company IDs to focus on (null = show all)
 */
export function buildNetwork(contacts, companies = [], minCompanySize = 1, userCompanyId = null, industryFilter = "all", companyRelationships = [], focusCompanyIds = null) {
  // Build a map of companyId -> company row for quick access
  const companyById = {};
  companies.forEach(c => { companyById[c.id] = c; });

  // Group contacts by companyId
  const contactsByCompanyId = {};
  contacts.forEach(c => {
    const cid = c.companyId || 0;  // 0 = "Unbekannt"
    if (!contactsByCompanyId[cid]) contactsByCompanyId[cid] = [];
    contactsByCompanyId[cid].push(c);
  });

  // Build company nodes from the companies array
  const filteredCompanyNodes = [];
  const companyMembersMap = {}; // id -> members array

  companies.forEach(co => {
    const members = contactsByCompanyId[co.id] || [];
    companyMembersMap[co.id] = members;
    const isUserCompany = co.id === userCompanyId;
    const isFocused = focusCompanyIds && focusCompanyIds.has(co.id);

    // Direkt filter
    if (focusCompanyIds && !isUserCompany && !isFocused) return;

    // Min company size filter
    if (minCompanySize === -1) {
      if (members.length !== 0 && !isUserCompany) return;
    } else if (members.length < minCompanySize && !isUserCompany) {
      // Always show companies with enrichment data or non-zero estimated_size
      if (!co.enriched_at && !co.estimated_size) return;
    }

    const estimatedSize = co.estimated_size || estimateCompanySize(co.name, members);
    const industry = co.industry || inferIndustry(co.name, members);

    filteredCompanyNodes.push({
      id: `company_${co.id}`,
      numericId: co.id,
      name: co.name,
      type: "company",
      memberCount: members.length,
      members,
      estimatedSize,
      isUserCompany,
      industry,
    });
  });

  // Handle contacts with no company (companyId=0 or null) — "Unbekannt" node
  const unknownMembers = contactsByCompanyId[0] || [];
  // Also collect contacts whose companyId doesn't match any company row
  contacts.forEach(c => {
    if (c.companyId && !companyById[c.companyId] && !unknownMembers.includes(c)) {
      unknownMembers.push(c);
    }
  });
  // Contacts with null companyId
  const nullMembers = contactsByCompanyId[null] || contactsByCompanyId[undefined] || [];
  nullMembers.forEach(m => { if (!unknownMembers.includes(m)) unknownMembers.push(m); });

  if (unknownMembers.length > 0 && (minCompanySize <= unknownMembers.length || minCompanySize === -1)) {
    filteredCompanyNodes.push({
      id: 'company_0',
      numericId: 0,
      name: 'Unbekannt',
      type: 'company',
      memberCount: unknownMembers.length,
      members: unknownMembers,
      estimatedSize: estimateCompanySize('Unbekannt', unknownMembers),
      isUserCompany: false,
      industry: 'Sonstige',
    });
  }

  // Ensure user's company always exists
  if (userCompanyId && !filteredCompanyNodes.some(c => c.numericId === userCompanyId)) {
    const co = companyById[userCompanyId];
    if (co) {
      const members = contactsByCompanyId[co.id] || [];
      filteredCompanyNodes.push({
        id: `company_${co.id}`,
        numericId: co.id,
        name: co.name,
        type: "company",
        memberCount: members.length,
        members,
        estimatedSize: co.estimated_size || estimateCompanySize(co.name, members),
        isUserCompany: true,
        industry: co.industry || inferIndustry(co.name, members),
      });
    }
  }

  // Filter by industry (always keep user's company)
  const companyNodes = filteredCompanyNodes
    .filter(c => c.isUserCompany || industryFilter === "all" || c.industry === industryFilter)
    .sort((a, b) => (b.isUserCompany ? 1 : 0) - (a.isUserCompany ? 1 : 0));

  // Create contact nodes (only for companies that passed all filters)
  const includedCompanyIds = new Set(companyNodes.map(c => c.numericId));
  const companySizeMap = {};
  companyNodes.forEach(c => { companySizeMap[c.numericId] = c.estimatedSize; });

  // Count company relationships per company ID
  const companyLinkCounts = {};
  (companyRelationships || []).forEach(rel => {
    const srcId = parseInt((rel.source || '').replace('company_', ''), 10);
    const tgtId = parseInt((rel.target || '').replace('company_', ''), 10);
    if (srcId) companyLinkCounts[srcId] = (companyLinkCounts[srcId] || 0) + 1;
    if (tgtId) companyLinkCounts[tgtId] = (companyLinkCounts[tgtId] || 0) + 1;
  });

  const contactNodes = contacts
    .filter(c => {
      const cid = c.companyId || 0;
      return includedCompanyIds.has(cid);
    })
    .map(c => {
      const cid = c.companyId || 0;
      const seniority = calculateSeniority(c.position);
      const companyMembers = (companyMembersMap[cid] || []).length || 1;
      const estimatedSize = companySizeMap[cid] || 100;
      const companyLinkCount = companyLinkCounts[cid] || 0;
      const influenceScore = calculateInfluence(c, seniority, companyMembers, estimatedSize, companyLinkCount);
      const isUser = typeof c.id === 'string' && c.id.startsWith('user_');

      return {
        ...c,
        type: "contact",
        companyNodeId: `company_${cid}`,
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
      target: c.companyNodeId,
      type: "employment"
    }));

  // Sort companies by estimated size
  companyNodes.sort((a, b) => (b.estimatedSize || 0) - (a.estimatedSize || 0));

  // Collect all unique industries
  const allIndustries = [...new Set(
    companyNodes.map(c => c.industry)
  )].sort();

  return {
    nodes: [...contactNodes, ...companyNodes],
    contactNodes,
    companyNodes,
    links,
    companyMap: Object.fromEntries(companyNodes.map(c => [c.name, c.members])),
    totalContacts: contacts.length,
    filteredContacts: contactNodes.length,
    allIndustries,
  };
}

/**
 * Infer company-to-company connections based on shared contacts
 */
export function inferCompanyConnections(contacts, companyNodes, minSharedContacts = 2) {
  // Group contacts by company node ID
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
        // Find numeric company IDs for D3 node matching
        const nodeA = companyNodes.find(n => n.name === companyA);
        const nodeB = companyNodes.find(n => n.name === companyB);
        if (nodeA && nodeB) {
          connections.push({
            source: nodeA.id,
            target: nodeB.id,
            type: "inferred",
            strength: Math.min(strength / 10, 1),
            contactsA: contactsA.length,
            contactsB: contactsB.length,
          });
        }
      }
    }
  }

  // Sort by strength and limit to avoid clutter
  connections.sort((a, b) => b.strength - a.strength);
  return connections.slice(0, 30);
}
