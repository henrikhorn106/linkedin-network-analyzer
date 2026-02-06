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
  showCompanyLinks,
  setShowCompanyLinks,
  allCompanyLinksCount,
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
  return (
    <div style={{
      padding: "10px 18px",
      borderBottom: `1px solid ${P.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: P.surface,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, color: P.bg, fontWeight: 700,
        }}>
          ◈
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E8ECF2", letterSpacing: "0.3px" }}>
            LINKEDIN NETWORK ANALYZER
          </span>
          {contacts.length > 0 && (
            <span style={{ fontSize: 10, color: P.textDim, marginLeft: 12 }}>
              {network.filteredContacts} Kontakte · {network.companyNodes.length} Firmen
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {contacts.length > 0 && (
          <>
            <FilterControls
              minCompanySize={minCompanySize}
              setMinCompanySize={setMinCompanySize}
              seniorityFilter={seniorityFilter}
              setSeniorityFilter={setSeniorityFilter}
              totalContacts={contacts.length}
              filteredContacts={network.filteredContacts}
              showCompanyLinks={showCompanyLinks}
              setShowCompanyLinks={setShowCompanyLinks}
              companyLinkCount={allCompanyLinksCount}
            />
            <div style={{ width: 1, height: 20, background: P.border, margin: "0 4px" }} />

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
                  padding: "6px 11px",
                  color: P.text,
                  fontSize: 10,
                  fontFamily: "inherit",
                  width: 150,
                  outline: "none",
                }}
              />
              {searchTerm && searchResults.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
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
                          setSelectedCompany(null);
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

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <button
            onClick={onShowAIChat}
            title="AI Assistent - Discovery Call Notizen verarbeiten"
            style={{
              background: `linear-gradient(135deg, ${P.purple}30, ${P.blue}30)`,
              border: `1px solid ${P.purple}60`,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 10,
              color: P.purple,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 12 }}>🤖</span>
            AI Assistent
          </button>
          <button
            onClick={onShowAddContact}
            title="Kontakt hinzufügen"
            style={{
              background: P.accent + "15",
              border: `1px solid ${P.accent}40`,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 10,
              color: P.accent,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>+</span>
            Kontakt
          </button>
          <button
            onClick={onShowAddCompany}
            title="Firma hinzufügen"
            style={{
              background: P.blue + "15",
              border: `1px solid ${P.blue}40`,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 10,
              color: P.blue,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>+</span>
            Firma
          </button>
          <div style={{ width: 1, height: 20, background: P.border, margin: "0 2px" }} />
          <button
            onClick={onShowSettings}
            title="Einstellungen"
            style={{
              background: "transparent",
              border: `1px solid ${P.border}`,
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 12,
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
  );
}
