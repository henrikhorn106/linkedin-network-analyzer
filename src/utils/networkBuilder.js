import { estimateCompanySize } from '../data/companySizes';
import { SENIORITY_KEYWORDS, BUSINESS_ROLES } from '../data/constants';

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
 */
export function buildNetwork(contacts, minCompanySize = 1, userCompany = null) {
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

  // Create company nodes with estimated sizes
  const companyNodes = Object.entries(filteredCompanyMap)
    .map(([name, members]) => {
      const customSize = members.find(m => m.customEstimatedSize)?.customEstimatedSize;
      const estimatedSize = customSize || estimateCompanySize(name, members);
      const isUserCompany = userCompany && name.toLowerCase() === userCompany.toLowerCase();
      return {
        id: `company_${name}`,
        name,
        type: "company",
        memberCount: members.length,
        members,
        estimatedSize,
        isUserCompany, // Flag for special styling/positioning
      };
    })
    // Sort so user's company comes first
    .sort((a, b) => (b.isUserCompany ? 1 : 0) - (a.isUserCompany ? 1 : 0));

  // Create contact nodes
  const includedCompanies = new Set(Object.keys(filteredCompanyMap));
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

  return {
    nodes: [...contactNodes, ...companyNodes],
    contactNodes,
    companyNodes,
    links,
    companyMap: filteredCompanyMap,
    totalContacts: contacts.length,
    filteredContacts: contactNodes.length,
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
