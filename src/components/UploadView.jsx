import { P } from '../styles/theme';
import { CSVUpload } from './modals/CSVUpload';

export function UploadView({ onCSVUpload, onShowAIChat, onShowAddContact, onShowAddCompany, onLoadDemo }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 500, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#F0F2F5", marginBottom: 8 }}>
            LinkedIn Network Analyzer
          </h1>
          <p style={{ fontSize: 12, color: P.textMuted, lineHeight: 1.6 }}>
            Visualisiere dein LinkedIn-Netzwerk. Finde Top-Influencer, entdecke Firmenverflechtungen und analysiere deine Connections.
          </p>
        </div>

        <CSVUpload onUpload={onCSVUpload} contactCount={0} />

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <div style={{ fontSize: 10, color: P.textDim, marginBottom: 12 }}>oder</div>

          {/* AI Assistant */}
          <button
            onClick={onShowAIChat}
            style={{
              background: `linear-gradient(135deg, ${P.purple}20, ${P.blue}20)`,
              border: `1px solid ${P.purple}50`,
              borderRadius: 10,
              padding: "16px 28px",
              fontSize: 13,
              color: P.purple,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 20 }}>🤖</span>
            AI Assistent - Discovery Call Notizen einfügen
          </button>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={onShowAddContact}
              style={{
                background: P.accent + "15",
                border: `1px solid ${P.accent}40`,
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 11,
                color: P.accent,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              + Manuell Kontakt
            </button>
            <button
              onClick={onShowAddCompany}
              style={{
                background: P.blue + "15",
                border: `1px solid ${P.blue}40`,
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 11,
                color: P.blue,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              + Firma
            </button>
            <button
              onClick={onLoadDemo}
              style={{
                background: "transparent",
                border: `1px solid ${P.border}`,
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 11,
                color: P.textMuted,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Demo-Daten
            </button>
          </div>
        </div>

        <div style={{
          marginTop: 40,
          padding: 20,
          background: P.surface,
          borderRadius: 12,
          border: `1px solid ${P.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.text, marginBottom: 12 }}>
            So exportierst du deine LinkedIn-Daten:
          </div>
          <ol style={{ fontSize: 10, color: P.textMuted, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
            <li>Gehe zu LinkedIn → Einstellungen & Datenschutz</li>
            <li>Klicke auf "Datenschutz" → "Kopie deiner Daten anfordern"</li>
            <li>Wähle "Verbindungen" aus</li>
            <li>LinkedIn sendet dir eine E-Mail mit Download-Link</li>
            <li>Lade die Connections.csv hier hoch</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
