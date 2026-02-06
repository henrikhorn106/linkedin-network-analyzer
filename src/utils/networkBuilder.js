import { estimateCompanySize } from '../data/companySizes';
import { SENIORITY_KEYWORDS, BUSINESS_ROLES } from '../data/constants';

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
 */
export function buildNetwork(contacts, minCompanySize = 1, userCompany = null, industryFilter = "all") {
  // Group contacts by company
  const companyMap = {};
  contacts.forEach(c => {
    const co = c.company?.trim() || "Unknown";
    if (!companyMap[co]) companyMap[co] = [];
    companyMap[co].push(c);
  });

  // Filter by minimum company size, but always include user's company
  const filteredCompanyMap = {};
  Object.entries(companyMap).forEach(([name, members]) => {
    const isUserCompany = userCompany && name.trim().toLowerCase() === userCompany.trim().toLowerCase();
    if ((members.length >= minCompanySize || isUserCompany) && name !== "Unknown") {
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
      const customSize = members.find(m => m.customEstimatedSize)?.customEstimatedSize;
      const estimatedSize = customSize || estimateCompanySize(name, members);
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
    // Filter by industry (always keep user's company)
    .filter(c => c.isUserCompany || industryFilter === "all" || c.industry === industryFilter)
    // Sort so user's company comes first
    .sort((a, b) => (b.isUserCompany ? 1 : 0) - (a.isUserCompany ? 1 : 0));

  // Create contact nodes (only for companies that passed all filters)
  const includedCompanies = new Set(companyNodes.map(c => c.name));
  const contactNodes = contacts
    .filter(c => includedCompanies.has(c.company?.trim()))
    .map(c => {
      const seniority = calculateSeniority(c.position);
      const companySize = filteredCompanyMap[c.company]?.length || 1;
      const influenceScore = seniority * 1.5 + companySize * 0.5;
      const isUser = typeof c.id === 'string' && c.id.startsWith('user_');

      return {
        ...c,
        type: "contact",
        companyId: `company_${c.company?.trim() || "Unknown"}`,
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
    .filter(c => c.company !== "Unknown")
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
    if (!co || co === "Unknown") return;
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
