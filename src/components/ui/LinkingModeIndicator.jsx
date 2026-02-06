import { P } from '../../styles/theme';
import { RELATIONSHIP_TYPES } from '../../data/constants';

export function LinkingModeIndicator({ linkingMode, onCancel }) {
  if (!linkingMode) return null;

  const relType = RELATIONSHIP_TYPES[linkingMode.type];

  return (
    <div style={{
      position: "absolute",
      top: 14,
      right: 290,
      background: "rgba(6,10,18,0.95)",
      backdropFilter: "blur(10px)",
      border: `1px solid ${relType?.color || P.purple}`,
      borderRadius: 10,
      padding: "12px 16px",
      maxWidth: 260,
      zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{relType?.icon || "?"}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: relType?.color || P.purple }}>
          {relType?.label || linkingMode.type} erstellen
        </span>
      </div>
      <div style={{ fontSize: 10, color: P.text, marginBottom: 8 }}>
        Klicke auf die Ziel-Firma um die Beziehung zu erstellen
      </div>
      <button
        onClick={onCancel}
        style={{
          background: P.border,
          border: "none",
          borderRadius: 4,
          padding: "5px 12px",
          fontSize: 9,
          color: P.text,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Abbrechen
      </button>
    </div>
  );
}
