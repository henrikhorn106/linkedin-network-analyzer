import { useState } from 'react';
import { P } from '../../styles/theme';

const INDUSTRIES = [
  "Technologie",
  "Finanzdienstleistungen",
  "Beratung",
  "Marketing & Werbung",
  "E-Commerce",
  "Gesundheitswesen",
  "Bildung",
  "Produktion",
  "Immobilien",
  "Sonstiges",
];

export function CompanySetup({ onComplete, onBack }) {
  const [name, setName] = useState("");
  const [estimatedSize, setEstimatedSize] = useState("");
  const [industry, setIndustry] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onComplete({
      name: name.trim(),
      estimated_size: estimatedSize ? parseInt(estimatedSize) : null,
      industry: industry || null,
    });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: 20,
      background: P.bg,
    }}>
      <div style={{
        background: P.surface,
        borderRadius: 12,
        padding: 32,
        width: 420,
        maxWidth: "90vw",
        border: `1px solid ${P.border}`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${P.blue}, ${P.purple})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 24,
          }}>
            <span role="img" aria-label="building">🏢</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: P.text }}>
            Deine Firma
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted }}>
            Wo arbeitest du?
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              FIRMENNAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. TechCorp GmbH"
              required
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              BRANCHE
            </label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: industry ? P.text : P.textMuted,
                fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
                cursor: "pointer",
              }}
            >
              <option value="">Branche auswählen...</option>
              {INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              MITARBEITERZAHL
            </label>
            <input
              type="number"
              value={estimatedSize}
              onChange={e => setEstimatedSize(e.target.value)}
              placeholder="z.B. 50"
              min="1"
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
              onClick={onBack}
              style={{
                flex: 1, padding: "12px", background: "transparent",
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.textMuted, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Zurück
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: "12px",
                background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
                border: "none", borderRadius: 6,
                color: P.bg, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Weiter
            </button>
          </div>
        </form>

        <div style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: P.accent,
          }} />
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: P.accent,
          }} />
        </div>
      </div>
    </div>
  );
}
