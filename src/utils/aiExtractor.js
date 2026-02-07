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
  const { contacts = [], relationships = [], userCompany = null, estimatedSize = null, currentIndustry = null, existingEnrichment = null } = context;

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
      const direction = r.sourceName === companyName ? 'ist' : 'hat';
      const otherName = r.sourceName === companyName ? r.targetName : r.sourceName;
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
  const hasEnrichment = existingEnrichment && Object.keys(existingEnrichment).length > 0;
  if (estimatedSize || currentIndustry || hasEnrichment) {
    existingData = '\n\nBereits bekannte Daten:';
    if (estimatedSize) existingData += `\n- Geschätzte Größe: ~${estimatedSize} Mitarbeiter`;
    if (currentIndustry) existingData += `\n- Branche (vermutet): ${currentIndustry}`;
    if (hasEnrichment) {
      if (existingEnrichment.description) existingData += `\n- Beschreibung: ${existingEnrichment.description}`;
      if (existingEnrichment.website) existingData += `\n- Website: ${existingEnrichment.website}`;
      if (existingEnrichment.headquarters) existingData += `\n- Hauptsitz: ${existingEnrichment.headquarters}`;
      if (existingEnrichment.founded_year) existingData += `\n- Gründungsjahr: ${existingEnrichment.founded_year}`;
      if (existingEnrichment.company_type) existingData += `\n- Firmentyp: ${existingEnrichment.company_type}`;
      if (existingEnrichment.linkedin_url) existingData += `\n- LinkedIn: ${existingEnrichment.linkedin_url}`;
      if (existingEnrichment.industry) existingData += `\n- Branche: ${existingEnrichment.industry}`;
      if (existingEnrichment.estimated_size) existingData += `\n- Mitarbeiterzahl: ~${existingEnrichment.estimated_size}`;
    }
  }

  const enrichmentSchema = {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Präzise Beschreibung (2-3 Sätze): Was macht die Firma, Kernprodukte/Services, Zielmarkt',
      },
      industry: {
        type: 'string',
        enum: ['Technologie', 'Finanzdienstleistungen', 'Beratung', 'Marketing & Werbung', 'E-Commerce', 'Gesundheitswesen', 'Bildung', 'Produktion', 'Immobilien', 'Sonstiges'],
        description: 'Branche der Firma',
      },
      website: {
        type: 'string',
        description: 'Offizielle Website URL (z.B. https://firmenname.com)',
      },
      headquarters: {
        type: 'string',
        description: 'Hauptsitz im Format: Stadt, Land (z.B. Berlin, Deutschland oder San Francisco, USA). Immer den deutschen Ländernamen verwenden.',
      },
      founded_year: {
        type: 'integer',
        description: 'Gründungsjahr der Firma',
      },
      company_type: {
        type: 'string',
        enum: ['Enterprise', 'Startup', 'Mittelstand', 'Agentur', 'Beratung', 'Konzern'],
        description: 'Firmentyp',
      },
      linkedin_url: {
        type: 'string',
        description: 'LinkedIn Firmenprofil URL',
      },
      estimated_size: {
        type: 'integer',
        description: 'Geschätzte Mitarbeiterzahl',
      },
    },
    required: ['description', 'industry', 'website', 'headquarters', 'founded_year', 'company_type', 'linkedin_url', 'estimated_size'],
    additionalProperties: false,
  };

  const systemPrompt = `Du bist ein erstklassiger Business-Intelligence-Analyst. Du erhältst umfangreiche Kontextdaten über eine Firma aus einem LinkedIn-Netzwerk und sollst möglichst präzise Firmendaten zusammenstellen.

WICHTIG: Nutze die Websuche um aktuelle, echte Daten über die Firma zu finden (Website, Hauptsitz, Gründungsjahr, Mitarbeiterzahl, LinkedIn-Profil).
Nutze die Kontaktpositionen, um auf die Firmenstruktur und -größe zu schließen.
Nutze Geschäftsbeziehungen, um den Marktkontext zu verstehen.

Regeln:
- Suche im Web nach der Firma und nutze die echten Daten
- Jedes Feld MUSS einen Wert haben. Mache immer eine bestmögliche Schätzung.
- estimated_size soll realistisch sein: Startup 5-50, Mittelstand 50-500, Enterprise 500+
- Bevorzuge echte, verifizierte Daten aus der Websuche über Schätzungen
- Wenn bereits Daten vorhanden sind, aktualisiere und verbessere sie mit aktuellen Webdaten statt sie zu ignorieren`;

  const userPrompt = `Recherchiere die Firma "${companyName}" im Web und fülle alle Felder mit echten Daten.${existingData}${contactSection}${relationshipSection}${userContext}`;

  // Use Responses API with web search + structured output
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      instructions: systemPrompt,
      input: userPrompt,
      tools: [{ type: 'web_search_preview' }],
      text: {
        format: {
          type: 'json_schema',
          name: 'company_enrichment',
          strict: true,
          schema: enrichmentSchema,
        },
      },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'API request failed');
  }

  const data = await response.json();

  // Responses API returns output array — find the text output item
  const textOutput = data.output?.find(item => item.type === 'message');
  const content = textOutput?.content?.find(c => c.type === 'output_text')?.text;

  if (content) {
    return JSON.parse(content);
  }
  throw new Error('Empty response from AI');
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

/**
 * OpenAI function/tool definitions for the agentic chat assistant
 */
export const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Erstelle einen neuen Kontakt im Netzwerk",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vollständiger Name des Kontakts" },
          company: { type: "string", description: "Firmenname des Kontakts" },
          position: { type: "string", description: "Position/Titel des Kontakts (optional)" },
        },
        required: ["name", "company"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_company",
      description: "Erstelle einen neuen Firmen-Platzhalter im Netzwerk",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Firmenname" },
          estimatedSize: { type: "integer", description: "Geschätzte Mitarbeiterzahl (optional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_relationship",
      description: "Erstelle eine Geschäftsbeziehung zwischen zwei Firmen",
      parameters: {
        type: "object",
        properties: {
          sourceCompany: { type: "string", description: "Name der Quell-Firma" },
          targetCompany: { type: "string", description: "Name der Ziel-Firma" },
          type: {
            type: "string",
            enum: ["lead", "customer", "partner", "investor", "competitor"],
            description: "Art der Beziehung",
          },
        },
        required: ["sourceCompany", "targetCompany", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Aktualisiere einen bestehenden Kontakt (z.B. neue Position oder Firmenwechsel)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name des bestehenden Kontakts (zur Identifikation)" },
          company: { type: "string", description: "Neuer Firmenname (optional, nur wenn sich die Firma aendert)" },
          position: { type: "string", description: "Neue Position/Titel (optional, nur wenn sich die Position aendert)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_company",
      description: "Recherchiere eine Firma per Websuche und reichere sie mit Daten an (Beschreibung, Branche, Website, Hauptsitz, Gruendungsjahr, etc.)",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string", description: "Name der Firma die angereichert werden soll" },
        },
        required: ["companyName"],
      },
    },
  },
];

/**
 * System prompt for the agentic assistant.
 * Placeholders {existingCompanies} and {existingContactsSample} are filled at call time.
 */
export const AGENT_SYSTEM_PROMPT = `Du bist ein Netzwerk-Assistent für ein LinkedIn-Netzwerk-Analysetool. Du hilfst dem Nutzer, Kontakte, Firmen und Geschäftsbeziehungen aus Notizen und Gesprächen zu extrahieren und anzulegen.

Du hast Zugriff auf folgende Tools:
- create_contact: Neuen Kontakt erstellen
- create_company: Neue Firma erstellen
- create_relationship: Geschäftsbeziehung zwischen zwei Firmen erstellen (lead/customer/partner/investor/competitor)
- update_contact: Bestehenden Kontakt aktualisieren (z.B. neue Position oder Firmenwechsel)
- enrich_company: Firma per Websuche recherchieren und mit Daten anreichern (Beschreibung, Branche, Website, Hauptsitz, etc.)

Regeln:
- Antworte immer auf Deutsch
- Wenn der Nutzer sagt, ein Kontakt hat eine neue Position oder Firma, nutze update_contact statt create_contact
- Wenn der Nutzer Notizen teilt, extrahiere alle genannten Personen, Firmen und Beziehungen und nutze die passenden Tools
- Wenn eine Firma nicht existiert aber als Beziehungspartner erwähnt wird, erstelle sie zuerst mit create_company
- Bei create_relationship: "MEINE FIRMA" ist die Firma des Nutzers. Nutze den echten Firmennamen wenn bekannt
- Schätze Firmengröße basierend auf Kontext (Startup: 10-50, Mittelstand: 50-500, Enterprise: 500+)
- Position ist optional, nutze "Connection" als Standard wenn nicht bekannt
- Wenn der Nutzer eine Firma erwähnt und mehr Informationen möchte (z.B. "recherchiere", "was weißt du über", "reichere an"), frage ob du die Firma per Websuche anreichern sollst, dann nutze enrich_company
- Fasse deine Aktionen kurz zusammen nachdem du die Tools aufgerufen hast

Bereits existierende Firmen im Netzwerk:
{existingCompanies}

Beispiel-Kontakte im Netzwerk (Auszug):
{existingContactsSample}`;

/**
 * Send a conversational message to the LLM with full history and tool definitions.
 * Returns the raw assistant message object (may contain content, tool_calls, or both).
 */
export async function agentChat(messages, apiKey, context = {}) {
  const { existingCompanies = [], existingContactsSample = [] } = context;

  const companiesStr = existingCompanies.length > 0
    ? existingCompanies.slice(0, 30).join(", ")
    : "(noch keine)";

  const contactsStr = existingContactsSample.length > 0
    ? existingContactsSample.slice(0, 10).map(c => `${c.name} (${c.company})`).join(", ")
    : "(noch keine)";

  const systemPrompt = AGENT_SYSTEM_PROMPT
    .replace("{existingCompanies}", companiesStr)
    .replace("{existingContactsSample}", contactsStr);

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: apiMessages,
      tools: CHAT_TOOLS,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "API request failed");
  }

  const data = await response.json();
  return data.choices[0]?.message;
}
