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
 * Takes company name + rich context for better results
 */
export async function enrichCompanyWithAI(companyName, context, apiKey) {
  const { contacts = [], relationships = [], userCompany = null, estimatedSize = null, currentIndustry = null } = context;

  // Build contact context with seniority analysis
  let contactSection = '';
  if (contacts.length > 0) {
    const positionCounts = {};
    contacts.forEach(c => {
      const pos = c.position || 'Connection';
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });

    const seniorContacts = contacts.filter(c => {
      const p = (c.position || '').toLowerCase();
      return /ceo|cto|cfo|coo|cmo|founder|gründer|director|head|vp|vice president|geschäftsführer|vorstand|partner|inhaber/i.test(p);
    });

    contactSection = `\n\nBekannte Kontakte (${contacts.length} gesamt):`;
    if (seniorContacts.length > 0) {
      contactSection += `\nFührungskräfte:`;
      seniorContacts.forEach(c => {
        contactSection += `\n- ${c.name}: ${c.position}`;
        if (c.connectedOn) contactSection += ` (verbunden seit ${c.connectedOn})`;
      });
    }

    contactSection += `\n\nPositionsverteilung:`;
    Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([pos, count]) => {
        contactSection += `\n- ${pos}: ${count}x`;
      });
  }

  // Build relationship context
  let relationshipSection = '';
  if (relationships.length > 0) {
    relationshipSection = `\n\nGeschäftsbeziehungen:`;
    relationships.forEach(r => {
      const direction = r.source === `company_${companyName}` ? 'ist' : 'hat';
      const otherName = r.source === `company_${companyName}` ? r.targetName : r.sourceName;
      relationshipSection += `\n- ${direction} ${r.typeLabel} von/für ${otherName}`;
    });
  }

  // Build user company context
  let userContext = '';
  if (userCompany) {
    userContext = `\n\nKontext: Der Nutzer arbeitet bei "${userCompany.name}"`;
    if (userCompany.industry) userContext += ` (Branche: ${userCompany.industry})`;
    userContext += `. Die zu analysierende Firma ist Teil seines LinkedIn-Netzwerks.`;
  }

  // Build existing data context
  let existingData = '';
  if (estimatedSize || currentIndustry) {
    existingData = '\n\nBereits bekannte Daten:';
    if (estimatedSize) existingData += `\n- Geschätzte Größe: ~${estimatedSize} Mitarbeiter`;
    if (currentIndustry) existingData += `\n- Branche (vermutet): ${currentIndustry}`;
  }

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
          content: `Du bist ein erstklassiger Business-Intelligence-Analyst. Du erhältst umfangreiche Kontextdaten über eine Firma aus einem LinkedIn-Netzwerk und sollst möglichst präzise Firmendaten zusammenstellen.

Nutze die Kontaktpositionen, um auf die Firmenstruktur und -größe zu schließen.
Nutze Geschäftsbeziehungen, um den Marktkontext zu verstehen.
Nutze die Positionsverteilung, um die Branche und den Firmentyp einzugrenzen.

Antworte NUR mit validem JSON. Jedes Feld MUSS einen Wert haben, NIEMALS null:
{
  "description": "Präzise Beschreibung (2-3 Sätze): Was macht die Firma, Kernprodukte/Services, Zielmarkt",
  "industry": "Eine der folgenden: Technologie, Finanzdienstleistungen, Beratung, Marketing & Werbung, E-Commerce, Gesundheitswesen, Bildung, Produktion, Immobilien, Sonstiges",
  "website": "https://firmenname.com (bestmögliche URL)",
  "headquarters": "Stadt, Land",
  "founded_year": 2010,
  "company_type": "Enterprise/Startup/Mittelstand/Agentur/Beratung/Konzern",
  "linkedin_url": "https://linkedin.com/company/firmenname",
  "estimated_size": 500
}

Regeln:
- Nutze dein Wissen UND die bereitgestellten Kontextdaten
- Wenn viele Senior-Positionen vorhanden sind, ist die Firma wahrscheinlich größer
- Wenn die Positionsverteilung auf Entwickler/Engineers hindeutet → Technologie
- Wenn Sales/Account-Manager dominieren → möglicherweise B2B/Beratung
- WICHTIG: Gib NIEMALS null zurück. Jedes Feld MUSS einen Wert haben. Mache immer eine bestmögliche Schätzung basierend auf dem Kontext.
- estimated_size soll realistisch sein: Startup 5-50, Mittelstand 50-500, Enterprise 500+
- Wenn du die Website nicht kennst, konstruiere eine plausible URL (z.B. https://firmenname.com)
- Wenn du das Gründungsjahr nicht kennst, schätze es basierend auf Firmengröße und Branche`
        },
        {
          role: 'user',
          content: `Firma: ${companyName}${existingData}${contactSection}${relationshipSection}${userContext}`
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
