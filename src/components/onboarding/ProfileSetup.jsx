import { useState } from 'react';
import { P } from '../../styles/theme';

export function ProfileSetup({ onComplete }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onComplete({
      name: name.trim(),
      email: email.trim() || null,
      role: role.trim() || null,
    });
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
    }}>
      <div style={{
        background: P.surface,
        borderRadius: 12,
        padding: 32,
        width: 420,
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
            <span role="img" aria-label="user">👤</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: P.text }}>
            Willkommen
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted }}>
            Lass uns dein Profil einrichten
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              DEIN NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Max Mustermann"
              required
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="max@beispiel.de"
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 10, color: P.textDim,
              marginBottom: 6, letterSpacing: "0.5px"
            }}>
              DEINE POSITION
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="z.B. Sales Manager, Founder..."
              style={{
                width: "100%", padding: "10px 12px", background: P.bg,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 12, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
              border: "none",
              borderRadius: 6,
              color: P.bg,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Weiter
          </button>
        </form>

        <div style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: P.accent,
          }} />
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: P.border,
          }} />
        </div>
      </div>
    </div>
  );
}
