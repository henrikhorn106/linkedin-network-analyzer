import { P } from '../../styles/theme';

export function OnboardingComplete({ userName, companyName, onComplete }) {
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
        textAlign: "center",
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${P.accent}30, ${P.accent}10)`,
          border: `2px solid ${P.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 32,
        }}>
          <span role="img" aria-label="check">✓</span>
        </div>

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: P.text }}>
          Alles bereit!
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: P.textMuted, lineHeight: 1.5 }}>
          Willkommen, {userName}!
        </p>
        <p style={{ margin: "8px 0 24px", fontSize: 12, color: P.textDim }}>
          Du bist jetzt als {companyName} eingerichtet.
        </p>

        <div style={{
          background: P.bg,
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          border: `1px solid ${P.border}`,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: P.textMuted, lineHeight: 1.6 }}>
            Jetzt kannst du:
          </p>
          <ul style={{
            margin: "12px 0 0",
            padding: "0 0 0 16px",
            fontSize: 11,
            color: P.text,
            lineHeight: 1.8,
            textAlign: "left",
          }}>
            <li>LinkedIn-Kontakte per CSV importieren</li>
            <li>Kontakte manuell hinzufügen</li>
            <li>Dein Netzwerk visualisieren</li>
            <li>Firmenverbindungen analysieren</li>
          </ul>
        </div>

        <button
          onClick={onComplete}
          style={{
            width: "100%",
            padding: "14px",
            background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
            border: "none",
            borderRadius: 6,
            color: P.bg,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Los geht's
        </button>

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
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: P.accent,
          }} />
        </div>
      </div>
    </div>
  );
}
