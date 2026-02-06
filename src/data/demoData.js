// Demo data generator for 1000 contacts

const FIRST_NAMES = [
  "Max", "Anna", "Thomas", "Sarah", "Michael", "Julia", "Daniel", "Laura", "Stefan", "Lisa",
  "Andreas", "Katharina", "Markus", "Sophie", "Christian", "Marie", "Sebastian", "Emma", "Florian", "Hannah",
  "Tobias", "Lena", "Patrick", "Nina", "Benjamin", "Lea", "Alexander", "Jana", "Philipp", "Johanna",
  "Matthias", "Clara", "David", "Amelie", "Simon", "Vanessa", "Felix", "Melanie", "Lukas", "Christina",
  "Jan", "Sandra", "Tim", "Nadine", "Martin", "Sabrina", "Niklas", "Stefanie", "Jonas", "Verena",
  "Marcel", "Jasmin", "Kevin", "Bianca", "Oliver", "Tanja", "Fabian", "Miriam", "Dennis", "Anja",
  "Marco", "Kerstin", "Sven", "Monika", "René", "Claudia", "Jens", "Petra", "Thorsten", "Martina",
  "Nico", "Susanne", "Erik", "Daniela", "Moritz", "Simone", "Leon", "Manuela", "Vincent", "Heike",
  "Henrik", "Silke", "Robert", "Sonja", "Dominik", "Anke", "Julian", "Diana", "Paul", "Carolin",
  "Adrian", "Judith", "Sascha", "Katja", "Kai", "Eva", "Rico", "Ines", "Steffen", "Barbara"
];

const LAST_NAMES = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
  "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
  "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier",
  "Lehmann", "Schmid", "Schulze", "Maier", "Köhler", "Herrmann", "König", "Walter", "Mayer", "Huber",
  "Kaiser", "Fuchs", "Peters", "Lang", "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Schubert",
  "Vogel", "Friedrich", "Keller", "Günther", "Frank", "Berger", "Winkler", "Roth", "Beck", "Lorenz",
  "Baumann", "Franke", "Albrecht", "Schuster", "Simon", "Ludwig", "Böhm", "Winter", "Kraus", "Martin",
  "Schumacher", "Krämer", "Vogt", "Stein", "Jäger", "Otto", "Sommer", "Groß", "Seidel", "Heinrich",
  "Brandt", "Haas", "Schreiber", "Graf", "Schulte", "Dietrich", "Ziegler", "Kuhn", "Kühn", "Pohl",
  "Engel", "Horn", "Busch", "Bergmann", "Thomas", "Voigt", "Sauer", "Arnold", "Wolff"
];

const COMPANIES = [
  // Tech Giants
  { name: "SAP", weight: 15 }, { name: "Siemens", weight: 12 }, { name: "Deutsche Telekom", weight: 10 },
  { name: "BMW", weight: 8 }, { name: "Volkswagen", weight: 8 }, { name: "Mercedes-Benz", weight: 7 },
  { name: "Bosch", weight: 10 }, { name: "Allianz", weight: 6 }, { name: "BASF", weight: 5 },
  // German Tech
  { name: "Zalando", weight: 12 }, { name: "Delivery Hero", weight: 8 }, { name: "HelloFresh", weight: 7 },
  { name: "N26", weight: 6 }, { name: "Celonis", weight: 8 }, { name: "Personio", weight: 10 },
  { name: "FlixBus", weight: 5 }, { name: "Auto1 Group", weight: 4 }, { name: "TeamViewer", weight: 6 },
  // Consulting
  { name: "McKinsey", weight: 8 }, { name: "BCG", weight: 7 }, { name: "Bain", weight: 5 },
  { name: "Deloitte", weight: 12 }, { name: "PwC", weight: 10 }, { name: "EY", weight: 9 },
  { name: "KPMG", weight: 8 }, { name: "Accenture", weight: 15 }, { name: "Capgemini", weight: 10 },
  // Startups & Scale-ups
  { name: "TechFlow GmbH", weight: 8 }, { name: "ScaleUp AG", weight: 6 }, { name: "DataVista", weight: 5 },
  { name: "NovaTech", weight: 7 }, { name: "CloudBase", weight: 6 }, { name: "GreenEnergy Solutions", weight: 5 },
  { name: "FinPro", weight: 4 }, { name: "MediaPulse", weight: 5 }, { name: "AutomateX", weight: 6 },
  { name: "RetailFlow", weight: 4 }, { name: "BrandHive", weight: 5 }, { name: "Consulting Plus", weight: 4 },
  { name: "DigiCore", weight: 6 }, { name: "SmartFactory", weight: 5 }, { name: "HealthTech Pro", weight: 4 },
  { name: "EduLearn", weight: 3 }, { name: "PropTech Solutions", weight: 4 }, { name: "InsureTech AG", weight: 5 },
  { name: "LogiSmart", weight: 4 }, { name: "FoodTech Berlin", weight: 3 }, { name: "MobilityHub", weight: 5 },
  // International Tech
  { name: "Google", weight: 10 }, { name: "Microsoft", weight: 12 }, { name: "Amazon", weight: 8 },
  { name: "Meta", weight: 5 }, { name: "Apple", weight: 4 }, { name: "Salesforce", weight: 8 },
  { name: "Oracle", weight: 6 }, { name: "IBM", weight: 5 }, { name: "Cisco", weight: 4 },
  // Finance
  { name: "Deutsche Bank", weight: 8 }, { name: "Commerzbank", weight: 5 }, { name: "Goldman Sachs", weight: 4 },
  { name: "JPMorgan", weight: 3 }, { name: "UBS", weight: 3 }, { name: "BlackRock", weight: 2 },
  // Mittelstand
  { name: "Würth Group", weight: 4 }, { name: "Trumpf", weight: 3 }, { name: "Zeiss", weight: 4 },
  { name: "Kärcher", weight: 3 }, { name: "Festo", weight: 3 }, { name: "Stihl", weight: 2 },
  // Smaller companies
  { name: "InnoSoft GmbH", weight: 3 }, { name: "DataDriven AG", weight: 3 }, { name: "CloudNative", weight: 3 },
  { name: "AgileWorks", weight: 3 }, { name: "DevOps Pro", weight: 2 }, { name: "AIVentures", weight: 4 },
  { name: "CyberSecure GmbH", weight: 3 }, { name: "BlockChain Solutions", weight: 2 }, { name: "IoT Systems", weight: 3 },
  { name: "RoboTech", weight: 2 }, { name: "QuantumLabs", weight: 2 }, { name: "BioTech Innovations", weight: 3 },
  { name: "CleanTech AG", weight: 3 }, { name: "SolarPower GmbH", weight: 2 }, { name: "WindEnergy Pro", weight: 2 },
  { name: "E-Commerce Plus", weight: 3 }, { name: "MarketingCloud", weight: 3 }, { name: "SalesForce Pro", weight: 2 },
  { name: "HRTech Solutions", weight: 3 }, { name: "LegalTech GmbH", weight: 2 }, { name: "TravelTech", weight: 2 },
  { name: "GameDev Studios", weight: 2 }, { name: "MediaTech AG", weight: 3 }, { name: "AdTech Solutions", weight: 2 },
];

const POSITIONS = [
  // C-Level
  { title: "CEO", weight: 3 }, { title: "CTO", weight: 4 }, { title: "CFO", weight: 2 },
  { title: "CMO", weight: 2 }, { title: "COO", weight: 2 }, { title: "CIO", weight: 2 },
  { title: "Founder", weight: 4 }, { title: "Co-Founder", weight: 3 }, { title: "Managing Director", weight: 3 },
  // Director/VP
  { title: "VP Engineering", weight: 4 }, { title: "VP Sales", weight: 4 }, { title: "VP Marketing", weight: 3 },
  { title: "VP Product", weight: 3 }, { title: "VP Operations", weight: 2 }, { title: "VP Finance", weight: 2 },
  { title: "Director of Engineering", weight: 5 }, { title: "Director of Sales", weight: 5 },
  { title: "Director of Marketing", weight: 4 }, { title: "Director of Product", weight: 4 },
  { title: "Creative Director", weight: 3 }, { title: "Technical Director", weight: 3 },
  // Head of
  { title: "Head of Engineering", weight: 6 }, { title: "Head of Product", weight: 6 },
  { title: "Head of Sales", weight: 6 }, { title: "Head of Marketing", weight: 5 },
  { title: "Head of HR", weight: 4 }, { title: "Head of Finance", weight: 3 },
  { title: "Head of Growth", weight: 5 }, { title: "Head of Data", weight: 4 },
  { title: "Head of Design", weight: 4 }, { title: "Head of Partnerships", weight: 4 },
  // Manager
  { title: "Engineering Manager", weight: 10 }, { title: "Product Manager", weight: 12 },
  { title: "Project Manager", weight: 10 }, { title: "Marketing Manager", weight: 8 },
  { title: "Sales Manager", weight: 8 }, { title: "Account Manager", weight: 10 },
  { title: "HR Manager", weight: 5 }, { title: "Operations Manager", weight: 5 },
  { title: "Customer Success Manager", weight: 8 }, { title: "Business Development Manager", weight: 7 },
  // Lead
  { title: "Tech Lead", weight: 10 }, { title: "Team Lead", weight: 12 },
  { title: "Design Lead", weight: 6 }, { title: "Product Lead", weight: 6 },
  { title: "Frontend Lead", weight: 5 }, { title: "Backend Lead", weight: 5 },
  // Senior
  { title: "Senior Software Engineer", weight: 20 }, { title: "Senior Product Manager", weight: 8 },
  { title: "Senior Designer", weight: 8 }, { title: "Senior Consultant", weight: 10 },
  { title: "Senior Data Scientist", weight: 6 }, { title: "Senior Analyst", weight: 8 },
  { title: "Senior Account Executive", weight: 6 }, { title: "Senior Marketing Manager", weight: 5 },
  // Mid-level
  { title: "Software Engineer", weight: 25 }, { title: "Product Designer", weight: 12 },
  { title: "Data Scientist", weight: 8 }, { title: "Data Analyst", weight: 10 },
  { title: "UX Designer", weight: 10 }, { title: "UI Designer", weight: 8 },
  { title: "Business Analyst", weight: 10 }, { title: "Consultant", weight: 15 },
  { title: "Account Executive", weight: 10 }, { title: "Sales Representative", weight: 8 },
  { title: "Marketing Specialist", weight: 10 }, { title: "Content Manager", weight: 6 },
  { title: "DevOps Engineer", weight: 8 }, { title: "Cloud Engineer", weight: 6 },
  { title: "Security Engineer", weight: 4 }, { title: "QA Engineer", weight: 8 },
  { title: "Full Stack Developer", weight: 12 }, { title: "Frontend Developer", weight: 10 },
  { title: "Backend Developer", weight: 10 }, { title: "Mobile Developer", weight: 6 },
  // Partner/Principal
  { title: "Partner", weight: 4 }, { title: "Senior Partner", weight: 2 },
  { title: "Principal", weight: 5 }, { title: "Principal Consultant", weight: 4 },
  { title: "Principal Engineer", weight: 4 }, { title: "Staff Engineer", weight: 5 },
];

// Weighted random selection helper
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= (item.weight || 1);
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

// Generate random date in past 3 years
function randomDate() {
  const start = new Date(2022, 0, 1);
  const end = new Date();
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Generate demo contacts with realistic distribution
 */
export function generateDemoContacts(count = 1000) {
  const contacts = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    let name;
    // Ensure unique names
    do {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      name = `${firstName} ${lastName}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const company = weightedRandom(COMPANIES);
    const position = weightedRandom(POSITIONS);

    contacts.push({
      id: `demo_${i}`,
      name,
      company: company.name,
      position: position.title,
      connectedOn: randomDate(),
    });
  }

  return contacts;
}

// Pre-generated demo data
export const DEMO_CONTACTS = generateDemoContacts(1000);
