import { useState } from 'react';
import { P } from '../styles/theme';
import { useDatabase } from '../contexts/DatabaseContext';

export function SetPasswordScreen({ userName }) {
  const { setUserPassword } = useDatabase();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 4) {
      setError('Mindestens 4 Zeichen');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setIsLoading(true);
    try {
      await setUserPassword(password);
    } catch (err) {
      setError('Fehler beim Speichern');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: 20,
      background: P.bg,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        background: P.surface,
        borderRadius: 12,
        padding: 32,
        width: 380,
        maxWidth: "90vw",
        border: `1px solid ${P.border}`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 24,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: P.text }}>
            Passwort einrichten
          </h2>
          {userName && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted }}>
              {userName}
            </p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: P.textDim, lineHeight: 1.6 }}>
            Bitte lege ein Passwort fest, um dein Konto zu schützen.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              PASSWORT
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Mindestens 4 Zeichen"
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${error ? P.red : P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              PASSWORT BESTÄTIGEN
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="Passwort wiederholen"
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${error ? P.red : P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {error && (
              <div style={{ fontSize: 10, color: P.red, marginTop: 6 }}>
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            style={{
              width: "100%",
              padding: "12px",
              background: (password && confirmPassword) ? `linear-gradient(135deg, ${P.accent}, ${P.blue})` : P.border,
              border: "none",
              borderRadius: 6,
              color: (password && confirmPassword) ? P.bg : P.textDim,
              fontSize: 12,
              fontWeight: 700,
              cursor: (password && confirmPassword) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Speichern...' : 'Passwort festlegen'}
          </button>
        </form>
      </div>
    </div>
  );
}
