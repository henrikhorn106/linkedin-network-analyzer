/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values.map(v => v.replace(/^"|"$/g, '').trim());
}

/**
 * Parse LinkedIn CSV export file
 */
export function parseLinkedInCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // LinkedIn exports may have preamble lines (Notes, disclaimer, etc.)
  // Find the actual header row by looking for known column names
  const headerKeywords = ['first name', 'last name', 'company', 'position', 'connected', 'vorname', 'nachname', 'firma'];
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (headerKeywords.some(k => lower.includes(k))) {
      headerIndex = i;
      break;
    }
  }

  // Parse header - LinkedIn exports use these column names
  const header = parseCSVLine(lines[headerIndex]).map(h => h.toLowerCase().trim());

  // Map common LinkedIn column names (English and German)
  const columnMap = {
    firstName: header.findIndex(h =>
      h.includes('first name') || h === 'firstname' || h === 'vorname'
    ),
    lastName: header.findIndex(h =>
      h.includes('last name') || h === 'lastname' || h === 'nachname'
    ),
    company: header.findIndex(h =>
      h.includes('company') || h === 'firma' || h === 'unternehmen' || h === 'organization'
    ),
    position: header.findIndex(h =>
      h.includes('position') || h === 'title' || h === 'titel' || h === 'job title'
    ),
    connectedOn: header.findIndex(h =>
      h.includes('connected') || h.includes('verbunden') || h === 'date'
    ),
    email: header.findIndex(h =>
      h.includes('email') || h.includes('e-mail')
    ),
    url: header.findIndex(h =>
      h === 'url' || h.includes('profile') || h.includes('linkedin')
    ),
  };

  const contacts = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const firstName = columnMap.firstName >= 0 ? values[columnMap.firstName]?.trim() || '' : '';
    const lastName = columnMap.lastName >= 0 ? values[columnMap.lastName]?.trim() || '' : '';
    const name = `${firstName} ${lastName}`.trim();

    if (!name) continue;

    const company = columnMap.company >= 0 ? values[columnMap.company]?.trim() || 'Unknown' : 'Unknown';
    const position = columnMap.position >= 0 ? values[columnMap.position]?.trim() || 'Connection' : 'Connection';
    const connectedOn = columnMap.connectedOn >= 0 ? values[columnMap.connectedOn]?.trim() || '' : '';
    const linkedinUrl = columnMap.url >= 0 ? values[columnMap.url]?.trim() || '' : '';

    contacts.push({
      id: `csv_${i}`,
      name,
      company,
      position,
      connectedOn,
      linkedinUrl: linkedinUrl || undefined,
    });
  }

  return contacts;
}
