import { P } from '../../styles/theme';

export function ContactTooltip({ contact, onEdit, onDelete }) {
  if (!contact) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: 14,
      left: 14,
      background: "rgba(6,10,18,0.93)",
      backdropFilter: "blur(14px)",
      border: `1px solid ${P.border}`,
      borderRadius: 10,
      padding: "13px 18px",
      maxWidth: 340,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F5" }}>
          {contact.name}
          {contact.seniority >= 8 && (
            <span style={{
              background: `linear-gradient(135deg, ${P.gold}, ${P.orange})`,
              color: P.bg,
              fontSize: 8,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              marginLeft: 8,
            }}>
              TOP INFLUENCER
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onEdit(contact)}
            title="Bearbeiten"
            style={{
              background: P.blue + "20",
              border: `1px solid ${P.blue}40`,
              borderRadius: 4,
              padding: "3px 6px",
              fontSize: 9,
              color: P.blue,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >✎</button>
          <button
            onClick={() => {
              if (confirm(`"${contact.name}" wirklich löschen?`)) {
                onDelete(contact.id);
              }
            }}
            title="Löschen"
            style={{
              background: P.red + "20",
              border: `1px solid ${P.red}40`,
              borderRadius: 4,
              padding: "3px 6px",
              fontSize: 9,
              color: P.red,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >×</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: P.accent, marginTop: 4 }}>
        {contact.position || 'Connection'}
      </div>
      <div style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}>
        {contact.company}
        {contact.connectedOn && ` · Verbunden: ${contact.connectedOn}`}
      </div>
      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 8, padding: "5px 10px",
            background: "#0A66C2" + "20",
            border: `1px solid #0A66C240`,
            borderRadius: 5, textDecoration: "none",
            fontSize: 10, fontWeight: 600, color: "#0A66C2",
            fontFamily: "inherit",
          }}
        >
          in LinkedIn öffnen
        </a>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 10 }}>
        <span>
          <span style={{ color: P.textDim }}>Influence </span>
          <span style={{ color: P.gold, fontWeight: 700 }}>
            {(contact.normalizedInfluence * 100).toFixed(0)}%
          </span>
        </span>
        <span>
          <span style={{ color: P.textDim }}>Seniority </span>
          <span style={{ color: P.text, fontWeight: 600 }}>{contact.seniority}/10</span>
        </span>
      </div>
    </div>
  );
}
