import { useState, useMemo } from 'react';
import { P } from '../../styles/theme';

export function AddContactModal({ onAdd, onClose, companies, editContact = null }) {
  const [name, setName] = useState(editContact?.name || "");
  const [company, setCompany] = useState(editContact?.company || "");
  const [position, setPosition] = useState(editContact?.position || "");
  const [connectedOn, setConnectedOn] = useState(editContact?.connectedOn || "");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const filteredCompanies = useMemo(() => {
    if (!company) return companies.slice(0, 8);
    const lower = company.toLowerCase();
    return companies.filter(c => c.toLowerCase().includes(lower)).slice(0, 8);
  }, [company, companies]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;

    onAdd({
      id: editContact?.id || `manual_${Date.now()}`,
      name: name.trim(),
      company: company.trim(),
      position: position.trim() || "Connection",
      connectedOn: connectedOn.trim() || new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: P.surface, borderRadius: 12, padding: 24,
          width: 400, maxWidth: "90vw",
          border: `1px solid ${P.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: P.text }}>
            {editContact ? "Kontakt bearbeiten" : "Neuer Kontakt"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", color: P.textMuted,
              fontSize: 18, cursor: "pointer", padding: 4,
            }}
          >×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, color: P.textDim, marginBottom: 6, letterSpacing: "0.5px" }}>
              NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Max Mustermann"
              required
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16, position: "relative" }}>
            <label style={{ display: "block", fontSize: 10, color: P.textDim, marginBottom: 6, letterSpacing: "0.5px" }}>
              FIRMA *
            </label>
            <input
              type="text"
              value={company}
              onChange={e => { setCompany(e.target.value); setShowCompanyDropdown(true); }}
              onFocus={() => setShowCompanyDropdown(true)}
              onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
              placeholder="Firmenname"
              required
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {showCompanyDropdown && filteredCompanies.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: P.bg, border: `1px solid ${P.border}`, borderRadius: 6,
                marginTop: 4, maxHeight: 160, overflowY: "auto", zIndex: 10,
              }}>
                {filteredCompanies.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => { setCompany(c); setShowCompanyDropdown(false); }}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 11, color: P.text,
                      borderBottom: i < filteredCompanies.length - 1 ? `1px solid ${P.border}` : "none",
                    }}
                    onMouseOver={e => e.currentTarget.style.background = P.surfaceHover}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, color: P.textDim, marginBottom: 6, letterSpacing: "0.5px" }}>
              POSITION
            </label>
            <input
              type="text"
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="CEO, Manager, Engineer..."
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, color: P.textDim, marginBottom: 6, letterSpacing: "0.5px" }}>
              VERBUNDEN AM
            </label>
            <input
              type="text"
              value={connectedOn}
              onChange={e => setConnectedOn(e.target.value)}
              placeholder="z.B. 15 Jan 2024"
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "10px", background: "transparent",
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.textMuted, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: "10px",
                background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
                border: "none", borderRadius: 6,
                color: P.bg, fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {editContact ? "Speichern" : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
