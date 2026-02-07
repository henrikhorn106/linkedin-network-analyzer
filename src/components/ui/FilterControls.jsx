import { P } from '../../styles/theme';
import { RELATIONSHIP_TYPES } from '../../data/constants';

export function FilterControls({
  minCompanySize,
  setMinCompanySize,
  seniorityFilter,
  setSeniorityFilter,
  totalContacts,
  filteredContacts,
  companyLinkFilter,
  setCompanyLinkFilter,
  allCompanyLinks,
  industryFilter,
  setIndustryFilter,
  availableIndustries,
  focusConnections,
  setFocusConnections,
}) {
  // Count links per type for dropdown labels
  const linkCounts = {};
  (allCompanyLinks || []).forEach(l => {
    const t = l.type || 'inferred';
    linkCounts[t] = (linkCounts[t] || 0) + 1;
  });

  const selectStyle = {
    background: P.bg,
    border: `1px solid ${P.border}`,
    borderRadius: 4,
    padding: "3px 6px",
    color: P.text,
    fontSize: 10,
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: P.textDim }}>Min. Kontakte:</span>
        <select
          value={minCompanySize}
          onChange={(e) => setMinCompanySize(parseInt(e.target.value))}
          style={selectStyle}
        >
          <option value={1}>1+</option>
          <option value={2}>2+</option>
          <option value={3}>3+</option>
          <option value={5}>5+</option>
          <option value={10}>10+</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: P.textDim }}>Seniority:</span>
        <select
          value={seniorityFilter}
          onChange={(e) => setSeniorityFilter(parseInt(e.target.value))}
          style={selectStyle}
        >
          <option value={0}>Alle</option>
          <option value={3}>3+ (Specialist)</option>
          <option value={5}>5+ (Manager)</option>
          <option value={7}>7+ (Director)</option>
          <option value={8}>8+ (C-Level)</option>
        </select>
      </div>

      {availableIndustries && availableIndustries.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: P.textDim }}>Branche:</span>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Alle</option>
            {availableIndustries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: P.textDim }}>Links:</span>
        <select
          value={companyLinkFilter}
          onChange={(e) => setCompanyLinkFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Alle ({allCompanyLinks?.length || 0})</option>
          <option value="none">Keine</option>
          {Object.entries(RELATIONSHIP_TYPES).map(([type, info]) =>
            linkCounts[type] ? (
              <option key={type} value={type}>{info.label} ({linkCounts[type]})</option>
            ) : null
          )}
          {linkCounts.inferred > 0 && (
            <option value="inferred">Inferiert ({linkCounts.inferred})</option>
          )}
        </select>
      </div>

      <button
        onClick={() => setFocusConnections(!focusConnections)}
        style={{
          background: focusConnections ? P.accent + "15" : "transparent",
          border: `1px solid ${focusConnections ? P.accent + "40" : P.border}`,
          borderRadius: 4,
          padding: "3px 8px",
          fontSize: 9,
          color: focusConnections ? P.accent : P.textDim,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
        title="Nur direkt verbundene Firmen anzeigen"
      >
        Direkt
      </button>

      {totalContacts !== filteredContacts && (
        <span style={{ fontSize: 9, color: P.orange }}>
          {filteredContacts}/{totalContacts}
        </span>
      )}
    </div>
  );
}
