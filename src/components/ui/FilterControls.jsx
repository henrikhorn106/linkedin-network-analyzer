import { P } from '../../styles/theme';

export function FilterControls({
  minCompanySize,
  setMinCompanySize,
  seniorityFilter,
  setSeniorityFilter,
  totalContacts,
  filteredContacts,
  showCompanyLinks,
  setShowCompanyLinks,
  companyLinkCount,
  industryFilter,
  setIndustryFilter,
  availableIndustries,
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: P.textDim }}>Min. Firmen:</span>
        <select
          value={minCompanySize}
          onChange={(e) => setMinCompanySize(parseInt(e.target.value))}
          style={{
            background: P.bg,
            border: `1px solid ${P.border}`,
            borderRadius: 4,
            padding: "3px 6px",
            color: P.text,
            fontSize: 10,
            fontFamily: "inherit",
          }}
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
          style={{
            background: P.bg,
            border: `1px solid ${P.border}`,
            borderRadius: 4,
            padding: "3px 6px",
            color: P.text,
            fontSize: 10,
            fontFamily: "inherit",
          }}
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
            style={{
              background: P.bg,
              border: `1px solid ${P.border}`,
              borderRadius: 4,
              padding: "3px 6px",
              color: P.text,
              fontSize: 10,
              fontFamily: "inherit",
            }}
          >
            <option value="all">Alle</option>
            {availableIndustries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={() => setShowCompanyLinks(!showCompanyLinks)}
        style={{
          background: showCompanyLinks ? P.purple + "20" : "transparent",
          border: `1px solid ${showCompanyLinks ? P.purple : P.border}`,
          borderRadius: 4,
          padding: "3px 8px",
          color: showCompanyLinks ? P.purple : P.textMuted,
          fontSize: 9,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10 }}>⟷</span>
        Firmen-Links {companyLinkCount > 0 && `(${companyLinkCount})`}
      </button>

      {totalContacts !== filteredContacts && (
        <span style={{ fontSize: 9, color: P.orange }}>
          {filteredContacts}/{totalContacts}
        </span>
      )}
    </div>
  );
}
