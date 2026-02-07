import { P } from '../../styles/theme';
import { RELATIONSHIP_TYPES } from '../../data/constants';

export function Legend({ showCompanyLinks, companyLinkCount }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 12,
      right: 65,
      background: P.surface + "99",
      backdropFilter: "blur(8px)",
      border: `1px solid ${P.border}`,
      borderRadius: 8,
      padding: "8px 14px",
    }}>
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: showCompanyLinks && companyLinkCount > 0 ? 8 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: P.accent + "25", border: `1px solid ${P.accent}50`,
            }} />
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              background: P.accent + "25", border: `1px solid ${P.accent}50`,
            }} />
          </div>
          <span style={{ fontSize: 9, color: P.textMuted }}>Firmengröße</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: P.text }} />
          <span style={{ fontSize: 9, color: P.textMuted }}>Kontakt</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            border: `2px solid ${P.gold}`, background: "transparent",
          }} />
          <span style={{ fontSize: 9, color: P.gold }}>C-Level</span>
        </div>
      </div>
      {showCompanyLinks && companyLinkCount > 0 && (
        <div style={{
          display: "flex",
          gap: 10,
          paddingTop: 8,
          borderTop: `1px solid ${P.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 16, height: 2, background: P.purple, opacity: 0.5, borderRadius: 1 }} />
            <span style={{ fontSize: 8, color: P.textMuted }}>Inferiert</span>
          </div>
          {Object.entries(RELATIONSHIP_TYPES).slice(0, 3).map(([type, info]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 16, height: 2, background: info.color, borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: info.color }}>{info.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
