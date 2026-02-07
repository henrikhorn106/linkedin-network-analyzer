import { useState } from 'react';
import { P } from '../styles/theme';
import { useDatabase } from '../contexts/DatabaseContext';

export function LoginScreen({ userName }) {
  const { login } = useDatabase();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError('');

    try {
      const success = await login(password);
      if (!success) {
        setError('Falsches Passwort');
      }
    } catch (err) {
      setError('Fehler bei der Anmeldung');
    } finally {
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
            Willkommen zurück
          </h2>
          {userName && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted }}>
              {userName}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
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
              placeholder="Passwort eingeben"
              autoFocus
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
            disabled={isLoading || !password}
            style={{
              width: "100%",
              padding: "12px",
              background: password ? `linear-gradient(135deg, ${P.accent}, ${P.blue})` : P.border,
              border: "none",
              borderRadius: 6,
              color: password ? P.bg : P.textDim,
              fontSize: 12,
              fontWeight: 700,
              cursor: password ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
