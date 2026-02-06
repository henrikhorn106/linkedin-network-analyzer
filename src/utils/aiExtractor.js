/**
 * Extract contacts and companies from notes using OpenAI API
 */
export async function extractWithAI(notes, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Assistent der Kontakt- und Firmeninformationen aus Notizen extrahiert.
Extrahiere alle Personen und Firmen aus den Notizen.
Antworte NUR mit validem JSON in diesem Format:
{
  "contacts": [
    { "name": "Vollständiger Name", "company": "Firmenname", "position": "Position/Titel" }
  ],
  "companies": [
    { "name": "Firmenname", "estimatedSize": 100, "notes": "Zusätzliche Infos" }
  ],
  "summary": "Kurze Zusammenfassung was extrahiert wurde"
}
Wenn keine Daten gefunden werden, gib leere Arrays zurück.
Schätze Firmengröße basierend auf Kontext (Startup: 10-50, Mittelstand: 50-500, Enterprise: 500+).`
        },
        {
          role: 'user',
          content: notes
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '{}';

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return { contacts: [], companies: [], summary: "Konnte keine Daten extrahieren." };
}

/**
 * Extract contacts and companies using rule-based parsing (fallback)
 */
export function extractWithRules(notes) {
  const contacts = [];
  const companies = [];

  // Common patterns
  const namePatterns = [
    /(?:mit|von|bei|call|meeting|gespräch)\s+([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/gi,
    /([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)(?:\s*,|\s+(?:CEO|CTO|CFO|COO|CMO|Founder|Gründer|Manager|Director|Head|VP|Lead))/gi,
  ];

  const companyPatterns = [
    /(?:von|bei|firma|company|unternehmen)\s+([A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)*(?:\s+(?:GmbH|AG|SE|Inc|Corp|Ltd))?)/gi,
    /([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\s+(?:GmbH|AG|SE|Inc|Corp|Ltd))/gi,
  ];

  const positionPatterns = [
    /(?:CEO|CTO|CFO|COO|CMO|CIO)/gi,
    /(?:Founder|Co-Founder|Gründer|Mitgründer)/gi,
    /(?:Director|Head of|VP|Vice President|Manager|Lead|Leiter)/gi,
  ];

  // Extract names
  const foundNames = new Set();
  namePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(notes)) !== null) {
      const name = match[1]?.trim();
      if (name && name.split(' ').length >= 2 && !foundNames.has(name.toLowerCase())) {
        foundNames.add(name.toLowerCase());

        // Try to find position
        let position = "Connection";
        positionPatterns.forEach(pp => {
          const posMatch = notes.match(pp);
          if (posMatch) position = posMatch[0];
        });

        // Try to find company
        let company = "";
        companyPatterns.forEach(cp => {
          const compMatch = notes.match(cp);
          if (compMatch) company = compMatch[1] || compMatch[0];
        });

        contacts.push({ name, company: company || "Unbekannt", position });
      }
    }
  });

  // Extract companies
  const foundCompanies = new Set();
  companyPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(notes)) !== null) {
      const name = (match[1] || match[0])?.trim();
      if (name && !foundCompanies.has(name.toLowerCase())) {
        foundCompanies.add(name.toLowerCase());

        // Estimate size
        let estimatedSize = 100;
        const sizeMatch = notes.match(/(\d+)\s*(?:mitarbeiter|employees)/i);
        if (sizeMatch) {
          estimatedSize = parseInt(sizeMatch[1]);
        } else if (/startup|klein/i.test(notes)) {
          estimatedSize = 25;
        } else if (/enterprise|groß|konzern/i.test(notes)) {
          estimatedSize = 1000;
        }

        companies.push({ name, estimatedSize, notes: "" });
      }
    }
  });

  return {
    contacts,
    companies,
    summary: contacts.length || companies.length
      ? `${contacts.length} Kontakt(e) und ${companies.length} Firma(en) gefunden.`
      : "Keine strukturierten Daten gefunden. Bitte gib mehr Details an."
  };
}

/**
 * Enrich company data using OpenAI API
 * Takes company name + known contacts/positions for context
 */
export async function enrichCompanyWithAI(companyName, contacts, apiKey) {
  const contactContext = contacts.length > 0
    ? `\nBekannte Kontakte bei dieser Firma:\n${contacts.map(c => `- ${c.name}: ${c.position || 'Connection'}`).join('\n')}`
    : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Business-Research-Assistent. Du erhältst einen Firmennamen und optional bekannte Kontakte.
Recherchiere basierend auf deinem Wissen über die Firma und antworte NUR mit validem JSON:
{
  "description": "Kurze Beschreibung (1-2 Sätze) was die Firma macht",
  "industry": "Branche (z.B. Technologie, Beratung, Finanzdienstleistungen, Marketing & Werbung, E-Commerce, Gesundheitswesen, Bildung, Produktion, Immobilien)",
  "website": "https://... (offizielle Website, oder null wenn unbekannt)",
  "headquarters": "Stadt, Land (Hauptsitz)",
  "founded_year": 2010,
  "company_type": "Enterprise/Startup/Mittelstand/Agentur/Beratung/Konzern",
  "linkedin_url": "https://linkedin.com/company/... (oder null wenn unbekannt)",
  "estimated_size": 500
}
Wenn du dir bei einem Feld nicht sicher bist, setze es auf null.
Schätze die Firmengröße basierend auf dem Kontext (Startup: 10-50, Mittelstand: 50-500, Enterprise: 500+).
Antworte NUR mit dem JSON-Objekt, kein zusätzlicher Text.`
        },
        {
          role: 'user',
          content: `Firma: ${companyName}${contactContext}`
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '{}';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('Could not parse AI response');
}

/**
 * Extract data from notes - uses AI if API key available, otherwise rules
 */
export async function extractDataFromNotes(notes, apiKey) {
  if (apiKey) {
    try {
      return await extractWithAI(notes, apiKey);
    } catch (error) {
      console.error("AI extraction failed, using fallback:", error);
      return extractWithRules(notes);
    }
  }
  return extractWithRules(notes);
}
