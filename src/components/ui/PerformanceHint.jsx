import { P } from '../../styles/theme';

export function PerformanceHint({ contactCount, linkingMode }) {
  if (contactCount <= 500 || linkingMode) return null;

  return (
    <div style={{
      position: "absolute",
      top: 14,
      right: 290,
      background: "rgba(6,10,18,0.85)",
      backdropFilter: "blur(10px)",
      border: `1px solid ${P.orange}30`,
      borderRadius: 7,
      padding: "8px 12px",
      maxWidth: 200,
    }}>
      <div style={{ fontSize: 9, color: P.orange, lineHeight: 1.5 }}>
        Großes Netzwerk! Filter nutzen für bessere Performance.
      </div>
    </div>
  );
}
