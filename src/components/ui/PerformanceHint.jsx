import { useState, useEffect } from 'react';
import { P } from '../../styles/theme';

export function PerformanceHint({ totalContacts, renderedNodes, linkingMode }) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismiss when node count changes significantly
  useEffect(() => {
    setDismissed(false);
  }, [renderedNodes > 300, renderedNodes > 600, renderedNodes > 1000]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (dismissed || renderedNodes <= 300) return;
    const timer = setTimeout(() => setDismissed(true), 8000);
    return () => clearTimeout(timer);
  }, [renderedNodes, dismissed]);

  if (dismissed || linkingMode || renderedNodes <= 300) return null;

  const level = renderedNodes > 1000 ? 'high' : renderedNodes > 600 ? 'medium' : 'low';
  const color = level === 'high' ? P.red : P.orange;
  const message = level === 'high'
    ? `${renderedNodes} Elemente — Filter oder Branche einschränken!`
    : `${renderedNodes} Elemente — Filter nutzen für bessere Performance.`;

  return (
    <div
      onClick={() => setDismissed(true)}
      style={{
        position: "absolute",
        top: 14,
        right: 290,
        background: "rgba(6,10,18,0.85)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${color}30`,
        borderRadius: 7,
        padding: "8px 12px",
        maxWidth: 220,
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 9, color, lineHeight: 1.5 }}>
        {message}
      </div>
    </div>
  );
}
