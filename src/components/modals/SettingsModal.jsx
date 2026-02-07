import { useState, useRef } from 'react';
import { P } from '../../styles/theme';

export function SettingsModal({ user, company, onDeleteAccount, onLogout, onExportDatabase, onImportDatabase, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleDelete = () => {
    if (confirmText !== 'LÖSCHEN') return;
    onDeleteAccount();
    onClose();
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: 'loading', message: 'Wird wiederhergestellt...' });
    const result = await onImportDatabase(file);
    if (result.success) {
      setImportStatus({ type: 'success', message: result.message });
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setImportStatus({ type: 'error', message: result.message });
    }
    // Reset file input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: P.surface, borderRadius: 12, padding: 24,
          width: 420, maxWidth: "90vw",
          border: `1px solid ${P.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 20 }}>
          Einstellungen
        </div>

        {/* Account info */}
        <div style={{
          padding: 12, background: P.bg, borderRadius: 7,
          border: `1px solid ${P.border}`, marginBottom: 16,
        }}>
          <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1px", marginBottom: 8 }}>
            ACCOUNT
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: P.textDim }}>Name</span>
            <span style={{ fontSize: 10, color: P.text, fontWeight: 600 }}>{user?.name || '—'}</span>
          </div>
          {user?.role && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: P.textDim }}>Rolle</span>
              <span style={{ fontSize: 10, color: P.text, fontWeight: 600 }}>{user.role}</span>
            </div>
          )}
          {company && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: P.textDim }}>Firma</span>
              <span style={{ fontSize: 10, color: P.text, fontWeight: 600 }}>{company.name}</span>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => { onLogout(); onClose(); }}
          style={{
            width: "100%", padding: "10px 0", marginBottom: 16,
            background: P.bg, border: `1px solid ${P.border}`,
            borderRadius: 7, color: P.text, fontSize: 11,
            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.5px",
          }}
        >
          Abmelden
        </button>

        {/* Backup section */}
        <div style={{
          padding: 12, background: P.bg, borderRadius: 7,
          border: `1px solid ${P.border}`, marginBottom: 16,
        }}>
          <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1px", marginBottom: 8 }}>
            DATENSICHERUNG
          </div>
          <div style={{ fontSize: 10, color: P.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
            Deine Daten werden nur lokal im Browser gespeichert. Erstelle regelmäßig ein Backup.
          </div>
          <button
            onClick={onExportDatabase}
            style={{
              width: "100%", padding: "8px 0", marginBottom: 8,
              background: P.accent + "18", border: `1px solid ${P.accent}40`,
              borderRadius: 5, color: P.accent, fontSize: 10,
              fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.5px",
            }}
          >
            Backup herunterladen
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%", padding: "8px 0",
              background: P.bg, border: `1px solid ${P.border}`,
              borderRadius: 5, color: P.text, fontSize: 10,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.5px",
            }}
          >
            Backup wiederherstellen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          {importStatus && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 5, fontSize: 10,
              background: importStatus.type === 'error' ? P.red + '15' : importStatus.type === 'success' ? P.accent + '15' : P.surface,
              color: importStatus.type === 'error' ? P.red : importStatus.type === 'success' ? P.accent : P.textMuted,
              border: `1px solid ${importStatus.type === 'error' ? P.red + '30' : importStatus.type === 'success' ? P.accent + '30' : P.border}`,
            }}>
              {importStatus.message}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div style={{
          padding: 12, background: P.red + "08", borderRadius: 7,
          border: `1px solid ${P.red}20`,
        }}>
          <div style={{ fontSize: 9, color: P.red, letterSpacing: "1px", marginBottom: 8, fontWeight: 600 }}>
            GEFAHRENZONE
          </div>
          <div style={{ fontSize: 10, color: P.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
            Account und alle Daten löschen. Du kannst dich danach neu registrieren und das Onboarding erneut durchlaufen.
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 9, color: P.textDim, marginBottom: 4 }}>
              Tippe LÖSCHEN zur Bestätigung
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN"
              style={{
                width: "100%", padding: "7px 10px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 5,
                color: P.text, fontSize: 11, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'LÖSCHEN'}
            style={{
              width: "100%", padding: "8px 0",
              background: confirmText === 'LÖSCHEN' ? P.red : P.red + "30",
              border: "none", borderRadius: 5,
              color: confirmText === 'LÖSCHEN' ? "#fff" : P.red + "60",
              fontSize: 10, fontWeight: 700,
              cursor: confirmText === 'LÖSCHEN' ? "pointer" : "not-allowed",
              fontFamily: "inherit", letterSpacing: "0.5px",
            }}
          >
            ACCOUNT LÖSCHEN
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 12, padding: "8px 0",
            background: "transparent", border: `1px solid ${P.border}`,
            borderRadius: 5, color: P.textMuted, fontSize: 10,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          SCHLIEßEN
        </button>
      </div>
    </div>
  );
}
