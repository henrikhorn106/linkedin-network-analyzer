import { useState, useEffect, useRef } from 'react';
import { P } from '../styles/theme';
import { extractDataFromNotes } from '../utils/aiExtractor';

export function AIChatAssistant({ onAddContact, onAddCompany, existingContacts, existingCompanies, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hallo! Ich bin dein Netzwerk-Assistent. Teile mir deine Discovery Call Notizen mit, und ich helfe dir, neue Kontakte und Firmen hinzuzufügen.\n\nDu kannst mir z.B. sagen:\n• \"Hatte einen Call mit Max Müller, CEO von TechStart GmbH\"\n• \"Meeting mit dem Sales Team von Enterprise Corp - 500 Mitarbeiter\"\n• Oder füge einfach deine Notizen ein!",
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActions, setPendingActions] = useState([]);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || "");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingActions]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openai_api_key', key);
    setShowSettings(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsProcessing(true);

    try {
      const lowerInput = userMessage.toLowerCase();

      if (pendingActions.length > 0 && (lowerInput.includes('ja') || lowerInput.includes('ok') || lowerInput.includes('bestätigen') || lowerInput.includes('hinzufügen') || lowerInput === 'alle')) {
        const approved = pendingActions.filter(a => a.status === 'pending');
        approved.forEach(action => {
          if (action.type === 'contact') {
            onAddContact({
              id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
              name: action.data.name,
              company: action.data.company,
              position: action.data.position || "Connection",
              connectedOn: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
            });
          } else if (action.type === 'company') {
            onAddCompany({
              id: `ai_company_${Date.now()}`,
              name: `${action.data.name} (Firma)`,
              company: action.data.name,
              position: "Firma hinzugefügt",
              connectedOn: new Date().toLocaleDateString('de-DE'),
              customEstimatedSize: action.data.estimatedSize,
            });
          }
        });

        setPendingActions([]);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Perfekt! ${approved.length} Einträge wurden hinzugefügt.\n\nHast du weitere Notizen für mich?`
        }]);
      } else if (pendingActions.length > 0 && (lowerInput.includes('nein') || lowerInput.includes('abbrechen') || lowerInput.includes('verwerfen'))) {
        setPendingActions([]);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Alles klar, ich habe die Vorschläge verworfen. Teile mir gerne neue Notizen mit!"
        }]);
      } else {
        const extracted = await extractDataFromNotes(userMessage, apiKey);

        const newContacts = extracted.contacts?.filter(c =>
          !existingContacts.some(ec => ec.name.toLowerCase() === c.name.toLowerCase())
        ) || [];

        const newCompanies = extracted.companies?.filter(c =>
          !existingCompanies.includes(c.name)
        ) || [];

        if (newContacts.length === 0 && newCompanies.length === 0) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: extracted.summary || "Ich konnte keine neuen Kontakte oder Firmen aus deinen Notizen extrahieren. Kannst du mir mehr Details geben?\n\nBeispiel: \"Hatte einen Call mit Max Müller, CEO bei TechStart GmbH - 50 Mitarbeiter\""
          }]);
        } else {
          const actions = [
            ...newContacts.map(c => ({ type: 'contact', data: c, status: 'pending' })),
            ...newCompanies.map(c => ({ type: 'company', data: c, status: 'pending' })),
          ];
          setPendingActions(actions);

          let responseText = "📋 Ich habe folgende Daten aus deinen Notizen extrahiert:\n\n";

          if (newContacts.length > 0) {
            responseText += "**Kontakte:**\n";
            newContacts.forEach(c => {
              responseText += `• ${c.name} - ${c.position} bei ${c.company}\n`;
            });
            responseText += "\n";
          }

          if (newCompanies.length > 0) {
            responseText += "**Firmen:**\n";
            newCompanies.forEach(c => {
              responseText += `• ${c.name} (~${c.estimatedSize} Mitarbeiter)\n`;
            });
            responseText += "\n";
          }

          responseText += "---\nMöchtest du diese Daten hinzufügen?\n👉 Antworte mit **\"Ja\"** zum Bestätigen oder **\"Nein\"** zum Verwerfen.";

          setMessages(prev => [...prev, {
            role: "assistant",
            content: responseText
          }]);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Entschuldigung, es gab einen Fehler bei der Verarbeitung. Bitte versuche es erneut."
      }]);
    }

    setIsProcessing(false);
  };

  const handleApproveOne = (index) => {
    const action = pendingActions[index];
    if (action.type === 'contact') {
      onAddContact({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        name: action.data.name,
        company: action.data.company,
        position: action.data.position || "Connection",
        connectedOn: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
    } else if (action.type === 'company') {
      onAddCompany({
        id: `ai_company_${Date.now()}`,
        name: `${action.data.name} (Firma)`,
        company: action.data.name,
        position: "Firma hinzugefügt",
        connectedOn: new Date().toLocaleDateString('de-DE'),
        customEstimatedSize: action.data.estimatedSize,
      });
    }

    setPendingActions(prev => prev.filter((_, i) => i !== index));
    setMessages(prev => [...prev, {
      role: "assistant",
      content: `✅ "${action.data.name}" wurde hinzugefügt!`
    }]);
  };

  const handleRejectOne = (index) => {
    const action = pendingActions[index];
    setPendingActions(prev => prev.filter((_, i) => i !== index));
    setMessages(prev => [...prev, {
      role: "assistant",
      content: `❌ "${action.data.name}" wurde übersprungen.`
    }]);
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 420, maxWidth: "100vw",
      background: P.surface, borderLeft: `1px solid ${P.border}`,
      display: "flex", flexDirection: "column",
      zIndex: 1000,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: `1px solid ${P.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${P.purple}, ${P.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>AI Assistent</div>
            <div style={{ fontSize: 9, color: P.textDim }}>Discovery Call → Kontakte</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Einstellungen"
            style={{
              background: showSettings ? P.purple + "30" : "transparent",
              border: `1px solid ${showSettings ? P.purple : P.border}`,
              borderRadius: 6, padding: "6px 10px",
              color: showSettings ? P.purple : P.textMuted,
              cursor: "pointer", fontSize: 12,
            }}
          >⚙</button>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: `1px solid ${P.border}`,
              borderRadius: 6, padding: "6px 10px",
              color: P.textMuted, cursor: "pointer", fontSize: 12,
            }}
          >✕</button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          padding: 16, borderBottom: `1px solid ${P.border}`,
          background: P.bg,
        }}>
          <div style={{ fontSize: 10, color: P.textDim, marginBottom: 8, letterSpacing: "0.5px" }}>
            OPENAI API KEY (optional)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                flex: 1, padding: "8px 10px", background: P.surface,
                border: `1px solid ${P.border}`, borderRadius: 6,
                color: P.text, fontSize: 11, fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => saveApiKey(apiKey)}
              style={{
                background: P.accent, border: "none", borderRadius: 6,
                padding: "8px 14px", color: P.bg, fontSize: 10,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >Speichern</button>
          </div>
          <div style={{ fontSize: 9, color: P.textDim, marginTop: 8 }}>
            {apiKey ? "✓ API Key gespeichert - GPT-4 wird verwendet" : "Ohne API Key wird regelbasierte Extraktion verwendet"}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
            }}
          >
            <div style={{
              padding: "10px 14px",
              borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: msg.role === "user" ? P.accent + "20" : P.bg,
              border: `1px solid ${msg.role === "user" ? P.accent + "40" : P.border}`,
              color: P.text,
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {msg.content.split('**').map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </div>
          </div>
        ))}

        {/* Pending Actions */}
        {pendingActions.length > 0 && (
          <div style={{
            padding: 12, background: P.bg, borderRadius: 10,
            border: `1px solid ${P.purple}40`,
          }}>
            <div style={{ fontSize: 10, color: P.purple, fontWeight: 600, marginBottom: 10 }}>
              AUSSTEHENDE AKTIONEN
            </div>
            {pendingActions.map((action, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", background: P.surface, borderRadius: 6,
                marginBottom: 6, border: `1px solid ${P.border}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: P.text, fontWeight: 500 }}>
                    {action.type === 'contact' ? '👤' : '🏢'} {action.data.name}
                  </div>
                  <div style={{ fontSize: 9, color: P.textDim }}>
                    {action.type === 'contact'
                      ? `${action.data.position} bei ${action.data.company}`
                      : `~${action.data.estimatedSize} Mitarbeiter`
                    }
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => handleApproveOne(i)}
                    style={{
                      background: P.accent + "20", border: `1px solid ${P.accent}40`,
                      borderRadius: 4, padding: "4px 8px", color: P.accent,
                      fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >✓</button>
                  <button
                    onClick={() => handleRejectOne(i)}
                    style={{
                      background: P.red + "20", border: `1px solid ${P.red}40`,
                      borderRadius: 4, padding: "4px 8px", color: P.red,
                      fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >✕</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => { setInput("Ja, alle hinzufügen"); setTimeout(handleSend, 0); }}
                disabled={isProcessing}
                style={{
                  flex: 1, padding: "8px", background: P.accent,
                  border: "none", borderRadius: 6, color: P.bg,
                  fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >Alle hinzufügen</button>
              <button
                onClick={() => { setPendingActions([]); setMessages(prev => [...prev, { role: "assistant", content: "Vorschläge verworfen." }]); }}
                style={{
                  flex: 1, padding: "8px", background: "transparent",
                  border: `1px solid ${P.border}`, borderRadius: 6,
                  color: P.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                }}
              >Alle verwerfen</button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div style={{
            alignSelf: "flex-start",
            padding: "10px 14px",
            background: P.bg,
            border: `1px solid ${P.border}`,
            borderRadius: "14px 14px 14px 4px",
            color: P.textMuted,
            fontSize: 11,
          }}>
            <span style={{ animation: "pulse 1s infinite" }}>Analysiere...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 16, borderTop: `1px solid ${P.border}`,
        background: P.bg,
      }}>
        <div style={{ position: "relative" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Füge deine Discovery Call Notizen ein..."
            rows={3}
            style={{
              width: "100%", padding: "12px", paddingRight: 50,
              background: P.surface, border: `1px solid ${P.border}`,
              borderRadius: 10, color: P.text, fontSize: 11,
              fontFamily: "inherit", resize: "none", outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            style={{
              position: "absolute", right: 8, bottom: 8,
              width: 36, height: 36, borderRadius: 8,
              background: input.trim() ? `linear-gradient(135deg, ${P.purple}, ${P.blue})` : P.border,
              border: "none", color: "#fff", fontSize: 14,
              cursor: input.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >→</button>
        </div>
        <div style={{ fontSize: 9, color: P.textDim, marginTop: 8, textAlign: "center" }}>
          Enter zum Senden · Shift+Enter für neue Zeile
        </div>
      </div>
    </div>
  );
}
