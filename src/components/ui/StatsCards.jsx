import { P } from '../../styles/theme';

export function StatsCards({ filteredContacts, companyCount, cLevelCount }) {
  const stats = [
    { label: "KONTAKTE", value: filteredContacts },
    { label: "FIRMEN", value: companyCount },
    { label: "C-LEVEL", value: cLevelCount, color: P.gold },
  ];

  return (
    <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8 }}>
      {stats.map((s, i) => (
        <div
          key={i}
          style={{
            background: "rgba(6,10,18,0.88)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${P.border}`,
            borderRadius: 7,
            padding: "7px 12px",
          }}
        >
          <div style={{ fontSize: 8, color: P.textDim, letterSpacing: "1px", marginBottom: 3 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: s.color || "#E8ECF2" }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
