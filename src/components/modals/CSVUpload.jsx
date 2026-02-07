import { useState, useRef, useCallback } from 'react';
import { P } from '../../styles/theme';
import { parseLinkedInCSV } from '../../utils/csvParser';

export function CSVUpload({ onUpload, contactCount }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Bitte eine CSV-Datei hochladen');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const contacts = parseLinkedInCSV(e.target.result);
        if (contacts.length === 0) {
          setError('Keine Kontakte in der Datei gefunden. Bitte LinkedIn-Export verwenden.');
          return;
        }
        setError(null);
        onUpload(contacts);
      } catch (err) {
        setError('Fehler beim Parsen der CSV-Datei');
        console.error(err);
      }
    };
    reader.readAsText(file);
  }, [onUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Compact version when contacts are loaded
  if (contactCount > 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          background: P.accentDim,
          border: `1px solid ${P.accent}40`,
          borderRadius: 6,
          padding: "0 10px",
          height: 30,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          fontSize: 10,
          color: P.accent,
          fontWeight: 600,
        }}>
          {contactCount} Kontakte geladen
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "transparent",
            border: `1px solid ${P.border}`,
            borderRadius: 6,
            padding: "0 10px",
            height: 30,
            boxSizing: "border-box",
            fontSize: 10,
            color: P.textMuted,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Neue CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFile(e.target.files[0])}
          style={{ display: "none" }}
        />
      </div>
    );
  }

  // Full upload area when no contacts
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? P.accent : P.border}`,
        borderRadius: 10,
        padding: "30px 40px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        background: isDragging ? P.accentDim : "transparent",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={(e) => handleFile(e.target.files[0])}
        style={{ display: "none" }}
      />
      <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: P.text, marginBottom: 6 }}>
        LinkedIn CSV hier ablegen
      </div>
      <div style={{ fontSize: 10, color: P.textMuted, marginBottom: 12 }}>
        oder klicken zum Auswählen
      </div>
      <div style={{ fontSize: 9, color: P.textDim, lineHeight: 1.6 }}>
        LinkedIn → Einstellungen → Datenschutz → Kopie deiner Daten anfordern → "Verbindungen" auswählen
      </div>
      {error && (
        <div style={{ marginTop: 12, fontSize: 10, color: P.red, fontWeight: 500 }}>
          {error}
        </div>
      )}
    </div>
  );
}
