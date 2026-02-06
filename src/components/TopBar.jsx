import { useState } from 'react';
import { P } from '../styles/theme';
import { FilterControls } from './ui/FilterControls';
import { CSVUpload } from './modals/CSVUpload';

export function TopBar({
  contacts,
  network,
  minCompanySize,
  setMinCompanySize,
  seniorityFilter,
  setSeniorityFilter,
  companyLinkFilter,
  setCompanyLinkFilter,
  allCompanyLinks,
  industryFilter,
  setIndustryFilter,
  availableIndustries,
  searchTerm,
  setSearchTerm,
  searchResults,
  setSelectedContact,
  setSelectedCompany,
  onFocusNode,
  onCSVUpload,
  onShowAIChat,
  onShowAddContact,
  onShowAddCompany,
  onShowSettings,
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div style={{
      borderBottom: `1px solid ${P.border}`,
      background: P.surface,
      flexShrink: 0,
    }}>
      {/* Main bar */}
      <div style={{
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "nowrap",
        minHeight: 40,
      }}>
        {/* Left: Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: P.bg, fontWeight: 700, flexShrink: 0,
          }}>
            ◈
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2", letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
              NETWORK ANALYZER
            </span>
            {contacts.length > 0 && (
              <span style={{ fontSize: 9, color: P.textDim, whiteSpace: "nowrap" }}>
                {network.filteredContacts} Kontakte · {network.companyNodes.length} Firmen
              </span>
            )}
          </div>
        </div>

        {/* Right: Search + actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {contacts.length > 0 && (
            <>
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                title="Filter"
                style={{
                  background: showFilters ? P.accent + "15" : "transparent",
                  border: `1px solid ${showFilters ? P.accent + "40" : P.border}`,
                  borderRadius: 5,
                  padding: "4px 8px",
                  fontSize: 9,
                  color: showFilters ? P.accent : P.textMuted,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 10 }}>⚡</span>
                Filter
              </button>

              {/* Search */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Suchen…"
                  style={{
                    background: P.bg,
                    border: `1px solid ${P.border}`,
                    borderRadius: 5,
                    padding: "5px 10px",
                    color: P.text,
                    fontSize: 10,
                    fontFamily: "inherit",
                    width: 120,
                    outline: "none",
                  }}
                />
                {searchTerm && searchResults.length > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: 250,
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    borderRadius: 7,
                    marginTop: 4,
                    maxHeight: 260,
                    overflowY: "auto",
                    zIndex: 100,
                  }}>
                    {searchResults.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (c.type === "company") {
                            setSelectedCompany(c);
                            setSelectedContact(null);
                          } else {
                            setSelectedContact(c);
                            const co = network.companyNodes.find(n => n.name === c.company);
                            setSelectedCompany(co || null);
                          }
                          setSearchTerm("");
                          onFocusNode(c.id);
                        }}
                        style={{
                          padding: "8px 11px",
                          cursor: "pointer",
                          borderBottom: `1px solid ${P.border}`,
                          fontSize: 10,
                        }}
                        onMouseOver={e => e.currentTarget.style.background = P.surfaceHover}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      >
                        {c.type === "company" ? (
                          <>
                            <div style={{ color: P.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 8, color: P.accent, background: P.accentDim, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>FIRMA</span>
                              {c.name}
                            </div>
                            <div style={{ color: P.textDim, fontSize: 9 }}>{c.memberCount} Kontakte · {c.estimatedSize?.toLocaleString('de-DE')} Mitarbeiter</div>
                          </>
                        ) : (
                          <>
                            <div style={{ color: P.text, fontWeight: 500 }}>{c.name}</div>
                            <div style={{ color: P.textDim, fontSize: 9 }}>{c.position} · {c.company}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <CSVUpload onUpload={onCSVUpload} contactCount={contacts.length} />

          {/* Compact action buttons */}
          <div style={{ display: "flex", gap: 3 }}>
            <button
              onClick={onShowAIChat}
              title="AI Assistent"
              style={{
                background: `linear-gradient(135deg, ${P.purple}30, ${P.blue}30)`,
                border: `1px solid ${P.purple}60`,
                borderRadius: 5,
                padding: "4px 8px",
                fontSize: 11,
                color: P.purple,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🤖
            </button>
            <button
              onClick={onShowAddContact}
              title="Kontakt hinzufügen"
              style={{
                background: P.accent + "15",
                border: `1px solid ${P.accent}40`,
                borderRadius: 5,
                padding: "4px 8px",
                fontSize: 10,
                color: P.accent,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              +
            </button>
            <button
              onClick={onShowAddCompany}
              title="Firma hinzufügen"
              style={{
                background: P.blue + "15",
                border: `1px solid ${P.blue}40`,
                borderRadius: 5,
                padding: "4px 8px",
                fontSize: 10,
                color: P.blue,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              ⬡
            </button>
            <button
              onClick={onShowSettings}
              title="Einstellungen"
              style={{
                background: "transparent",
                border: `1px solid ${P.border}`,
                borderRadius: 5,
                padding: "4px 8px",
                fontSize: 11,
                color: P.textMuted,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ⚙
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible filter row */}
      {showFilters && contacts.length > 0 && (
        <div style={{
          padding: "6px 14px 8px",
          borderTop: `1px solid ${P.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}>
          <FilterControls
            minCompanySize={minCompanySize}
            setMinCompanySize={setMinCompanySize}
            seniorityFilter={seniorityFilter}
            setSeniorityFilter={setSeniorityFilter}
            totalContacts={contacts.length}
            filteredContacts={network.filteredContacts}
            companyLinkFilter={companyLinkFilter}
            setCompanyLinkFilter={setCompanyLinkFilter}
            allCompanyLinks={allCompanyLinks}
            industryFilter={industryFilter}
            setIndustryFilter={setIndustryFilter}
            availableIndustries={availableIndustries}
          />
        </div>
      )}
    </div>
  );
}
