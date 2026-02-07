// Company relationship types for visualization
export const RELATIONSHIP_TYPES = {
  lead: { label: "Lead", reverseLabel: "Anbieter", color: "#F59E0B", icon: "◎" },
  customer: { label: "Kunde", reverseLabel: "Lieferant", color: "#00E5A0", icon: "→" },
  partner: { label: "Partner", color: "#8B5CF6", icon: "↔" },
  investor: { label: "Investor", color: "#3B82F6", icon: "$" },
  competitor: { label: "Wettbewerber", color: "#EF4444", icon: "⚡" },
};

// Seniority keywords for scoring
export const SENIORITY_KEYWORDS = {
  10: ["ceo", "founder", "gründer", "geschäftsführer", "inhaber", "owner", "managing director", "vorstand"],
  8: ["cto", "cfo", "cmo", "coo", "cio", "chief", "president", "vp", "vice president"],
  7: ["director", "head of", "leiter", "partner"],
  5: ["manager", "lead", "senior", "principal"],
  3: ["specialist", "consultant", "engineer", "analyst", "berater", "scientist", "designer"],
};

// Business-related roles for inferring company connections
export const BUSINESS_ROLES = [
  'sales', 'account', 'partner', 'business', 'customer',
  'client', 'key account', 'enterprise'
];
