import { useState } from 'react';
import { P } from '../../styles/theme';

export function AddCompanyModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [estimatedSize, setEstimatedSize] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Add a placeholder contact for this company
    onAdd({
      id: `company_placeholder_${Date.now()}`,
      name: `${name.trim()} (Firma)`,
      company: name.trim(),
      position: "Firma hinzugefügt",
      connectedOn: new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
      isCompanyPlaceholder: true,
      customEstimatedSize: estimatedSize ? parseInt(estimatedSize) : undefined,
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
            Neue Firma
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
              FIRMENNAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. TechCorp GmbH"
              required
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
              GESCHÄTZTE MITARBEITERZAHL
            </label>
            <input
              type="number"
              value={estimatedSize}
              onChange={e => setEstimatedSize(e.target.value)}
              placeholder="z.B. 500"
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 9, color: P.textDim, marginTop: 4 }}>
              Optional - wird sonst automatisch geschätzt
            </div>
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
              Hinzufügen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
