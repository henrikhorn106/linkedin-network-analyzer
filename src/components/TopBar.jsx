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
  focusConnections,
  setFocusConnections,
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
                  width: 30, height: 30,
                  background: showFilters ? P.accent + "15" : P.surface + "CC",
                  border: `1px solid ${showFilters ? P.accent + "40" : P.border}`,
                  borderRadius: 6, padding: 0,
                  color: showFilters ? P.accent : P.textMuted,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h12" /><path d="M4 6.5h8" /><path d="M6 10h4" /><path d="M7 13.5h2" />
                </svg>
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
                    borderRadius: 6,
                    padding: "0 10px",
                    height: 30,
                    boxSizing: "border-box",
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

          {/* Action buttons — matching graph toolbar style */}
          {(() => {
            const tbtn = (onClick, title, icon, color) => (
              <button
                onClick={onClick}
                title={title}
                style={{
                  width: 30, height: 30,
                  background: P.surface + "CC",
                  border: `1px solid ${P.border}`,
                  borderRadius: 6, padding: 0,
                  color: color || P.textMuted,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >{icon}</button>
            );
            const S = (ch) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ch}</svg>;
            return (
              <>
                {tbtn(onShowAIChat, "AI Assistent",
                  S(<><circle cx="8" cy="8" r="5.5" /><circle cx="6" cy="7" r="0.8" fill="currentColor" stroke="none" /><circle cx="10" cy="7" r="0.8" fill="currentColor" stroke="none" /><path d="M6 10c0.5 0.8 1.2 1 2 1s1.5-0.2 2-1" /></>),
                  P.purple
                )}
                {tbtn(onShowAddContact, "Kontakt hinzufügen",
                  S(<><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /><line x1="13" y1="3" x2="13" y2="7" /><line x1="11" y1="5" x2="15" y2="5" /></>),
                  P.accent
                )}
                {tbtn(onShowAddCompany, "Firma hinzufügen",
                  S(<><rect x="3" y="4" width="10" height="9" rx="1.5" /><line x1="3" y1="7.5" x2="13" y2="7.5" /><line x1="8" y1="4" x2="8" y2="13" /><path d="M6 2.5L8 1l2 1.5" /></>),
                  P.blue
                )}
                {tbtn(onShowSettings, "Einstellungen",
                  S(<><circle cx="8" cy="8" r="2" /><path d="M8 2.5v1.5" /><path d="M8 12v1.5" /><path d="M2.5 8H4" /><path d="M12 8h1.5" /><path d="M4.1 4.1l1.1 1.1" /><path d="M10.8 10.8l1.1 1.1" /><path d="M4.1 11.9l1.1-1.1" /><path d="M10.8 5.2l1.1-1.1" /></>)
                )}
              </>
            );
          })()}
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
            focusConnections={focusConnections}
            setFocusConnections={setFocusConnections}
          />
        </div>
      )}
    </div>
  );
}
