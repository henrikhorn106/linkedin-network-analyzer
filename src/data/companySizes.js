// Estimated employee counts for known companies
export const COMPANY_SIZES = {
  // Tech Giants
  "google": 180000, "alphabet": 180000, "microsoft": 220000, "amazon": 1500000, "apple": 160000,
  "meta": 70000, "facebook": 70000, "netflix": 13000, "tesla": 130000, "nvidia": 30000,
  "intel": 130000, "ibm": 280000, "oracle": 140000, "salesforce": 80000, "adobe": 30000,
  "sap": 110000, "cisco": 85000, "vmware": 35000, "dell": 130000, "hp": 50000,
  "uber": 30000, "airbnb": 7000, "spotify": 10000, "twitter": 2000, "x": 2000,
  "linkedin": 20000, "snap": 5000, "pinterest": 4000, "dropbox": 3000, "zoom": 8000,
  "slack": 3000, "atlassian": 10000, "shopify": 10000, "stripe": 8000, "square": 12000,
  "paypal": 30000, "intuit": 17000, "servicenow": 20000, "workday": 18000,
  // German Companies
  "siemens": 310000, "volkswagen": 670000, "vw": 670000, "bmw": 120000, "daimler": 170000,
  "mercedes": 170000, "mercedes-benz": 170000, "bosch": 420000, "basf": 110000,
  "bayer": 100000, "allianz": 155000, "deutsche bank": 85000, "commerzbank": 35000,
  "lufthansa": 110000, "adidas": 60000, "henkel": 50000, "continental": 190000,
  "thyssenkrupp": 100000, "eon": 70000, "rwe": 20000, "deutsche telekom": 210000,
  "zalando": 17000, "delivery hero": 40000, "hellofresh": 20000, "auto1": 6000,
  "n26": 1500, "celonis": 3000, "personio": 2000, "flixbus": 3000, "teamviewer": 1500,
  // Consulting
  "mckinsey": 45000, "bcg": 30000, "boston consulting": 30000, "bain": 15000,
  "deloitte": 415000, "pwc": 330000, "ey": 365000, "ernst & young": 365000,
  "kpmg": 265000, "accenture": 740000, "capgemini": 360000, "cognizant": 350000,
  "infosys": 340000, "tcs": 615000, "wipro": 250000, "hcl": 225000,
  // Finance
  "jpmorgan": 290000, "jp morgan": 290000, "goldman sachs": 45000, "morgan stanley": 80000,
  "bank of america": 215000, "citibank": 240000, "citi": 240000, "hsbc": 220000,
  "ubs": 75000, "credit suisse": 50000, "barclays": 85000, "bnp paribas": 190000,
  "blackrock": 20000, "fidelity": 70000, "vanguard": 20000,
  // Retail & Consumer
  "walmart": 2300000, "costco": 310000, "target": 450000, "ikea": 220000,
  "starbucks": 400000, "mcdonalds": 200000, "coca-cola": 80000, "pepsi": 310000,
  "nestle": 275000, "unilever": 150000, "procter & gamble": 100000, "p&g": 100000,
  "loreal": 90000, "nike": 80000, "lvmh": 200000, "zara": 165000, "inditex": 165000,
  // Mittelstand
  "würth": 85000, "wurth": 85000, "trumpf": 16000, "zeiss": 35000,
  "kärcher": 15000, "karcher": 15000, "festo": 20000, "stihl": 20000,
  // Other
  "ge": 170000, "general electric": 170000, "3m": 95000, "johnson & johnson": 150000,
  "pfizer": 80000, "merck": 70000, "novartis": 105000, "roche": 100000,
  "boeing": 140000, "airbus": 130000, "lockheed martin": 115000,
};

/**
 * Estimate company size based on name and context
 */
export function estimateCompanySize(companyName, members = []) {
  const normalized = companyName.toLowerCase().trim();

  // Check exact matches first
  if (COMPANY_SIZES[normalized]) return COMPANY_SIZES[normalized];

  // Check partial matches
  for (const [key, size] of Object.entries(COMPANY_SIZES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return size;
    }
  }

  // Heuristics based on suffixes and patterns
  if (normalized.includes("gmbh") || normalized.includes("kg")) {
    return Math.max(50, members.length * 15);
  }
  if (normalized.includes("ag") || normalized.includes("se")) {
    return Math.max(500, members.length * 50);
  }
  if (normalized.includes("inc") || normalized.includes("corp") || normalized.includes("ltd")) {
    return Math.max(200, members.length * 30);
  }
  if (normalized.includes("startup") || normalized.includes("ventures")) {
    return Math.max(20, members.length * 8);
  }

  // Check if members have senior titles (suggests smaller company)
  const hasCLevel = members.some(m => {
    const pos = (m.position || '').toLowerCase();
    return pos.includes('ceo') || pos.includes('founder') || pos.includes('owner');
  });

  if (hasCLevel && members.length <= 3) {
    return Math.max(20, members.length * 10);
  }

  // Default estimate
  return Math.max(100, members.length * 25);
}
