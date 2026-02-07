import { useState, useEffect, useRef, useCallback } from 'react';
import { P } from '../styles/theme';
import { extractDataFromNotes, agentChat, enrichCompanyWithAI } from '../utils/aiExtractor';
import { RELATIONSHIP_TYPES } from '../data/constants';

function formatEnrichmentResult(companyName, data) {
  let text = `\uD83D\uDD0D **Recherche-Ergebnisse fuer "${companyName}":**\n\n`;
  if (data.description) text += `${data.description}\n\n`;
  const fields = [];
  if (data.industry) fields.push(`Branche: ${data.industry}`);
  if (data.company_type) fields.push(`Typ: ${data.company_type}`);
  if (data.website) fields.push(`Web: ${data.website}`);
  if (data.headquarters) fields.push(`Sitz: ${data.headquarters}`);
  if (data.founded_year) fields.push(`Gegr.: ${data.founded_year}`);
  if (data.estimated_size) fields.push(`~${data.estimated_size} Mitarbeiter`);
  if (data.linkedin_url) fields.push(`LinkedIn: ${data.linkedin_url}`);
  if (fields.length > 0) text += fields.join('\n');
  text += '\n\nSollen diese Daten gespeichert werden?';
  return text;
}

function toolCallsToActions(toolCalls) {
  return toolCalls.map(tc => {
    const args = JSON.parse(tc.function.arguments);
    const name = tc.function.name;
    if (name === 'create_contact') {
      return { type: 'contact', toolCallId: tc.id, data: { name: args.name, company: args.company, position: args.position || 'Connection' }, status: 'pending' };
    }
    if (name === 'create_company') {
      return { type: 'company', toolCallId: tc.id, data: { name: args.name, estimatedSize: args.estimatedSize || 100 }, status: 'pending' };
    }
    if (name === 'create_relationship') {
      return { type: 'relationship', toolCallId: tc.id, data: { sourceCompany: args.sourceCompany, targetCompany: args.targetCompany, relType: args.type }, status: 'pending' };
    }
    if (name === 'update_contact') {
      return { type: 'update_contact', toolCallId: tc.id, data: { name: args.name, company: args.company, position: args.position }, status: 'pending' };
    }
    if (name === 'enrich_company') {
      return { type: 'enrich_company', toolCallId: tc.id, data: { companyName: args.companyName }, status: 'pending' };
    }
    return null;
  }).filter(Boolean);
}

export function AIChatAssistant({ onAddContact, onCreateCompany, onAddRelationship, onUpdateContact, existingContacts, existingCompanies, companies, onClose, getCompanyByName, getOrCreateCompanyId, updateCompany, companyRelationships, userCompany }) {
  const [chatHistory, setChatHistory] = useState([]); // OpenAI-format messages
  const [displayMessages, setDisplayMessages] = useState([
    {
      role: "assistant",
      content: "Hallo! Ich bin dein Netzwerk-Assistent. Teile mir deine Discovery Call Notizen mit, und ich helfe dir, neue Kontakte, Firmen und Beziehungen hinzuzufuegen.\n\nDu kannst mir z.B. sagen:\n\u2022 \"Hatte einen Call mit Max Mueller, CEO von TechStart GmbH\"\n\u2022 \"CloudTech ist ein Lead fuer uns\"\n\u2022 Oder fuege einfach deine Notizen ein!",
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActions, setPendingActions] = useState([]);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || "");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const pendingAssistantMessage = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, pendingActions]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openai_api_key', key);
    setShowSettings(false);
  };

  const trimHistory = useCallback((history) => {
    if (history.length > 40) {
      return history.slice(history.length - 30);
    }
    return history;
  }, []);

  const executeAction = useCallback(async (action) => {
    if (action.type === 'contact') {
      onAddContact({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        name: action.data.name,
        company: action.data.company,
        position: action.data.position || "Connection",
        connectedOn: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
      return { success: true, message: `Kontakt "${action.data.name}" erstellt` };
    }
    if (action.type === 'company') {
      await onCreateCompany({
        name: action.data.name,
        estimated_size: action.data.estimatedSize || null,
      });
      return { success: true, message: `Firma "${action.data.name}" erstellt` };
    }
    if (action.type === 'relationship') {
      if (!onAddRelationship) {
        return { success: false, message: "Beziehungen koennen nicht erstellt werden" };
      }
      // Resolve company names to numeric IDs
      const srcCompany = getCompanyByName ? getCompanyByName(action.data.sourceCompany) : null;
      const tgtCompany = getCompanyByName ? getCompanyByName(action.data.targetCompany) : null;
      if (!srcCompany || !tgtCompany) {
        return { success: false, message: `Firma "${!srcCompany ? action.data.sourceCompany : action.data.targetCompany}" nicht gefunden` };
      }
      onAddRelationship({
        sourceCompanyId: srcCompany.id,
        targetCompanyId: tgtCompany.id,
        type: action.data.relType,
      });
      return { success: true, message: `Beziehung "${action.data.sourceCompany}" \u2192 "${action.data.targetCompany}" (${action.data.relType}) erstellt` };
    }
    if (action.type === 'update_contact') {
      const match = (existingContacts || []).find(c => c.name.toLowerCase() === action.data.name.toLowerCase());
      if (!match) {
        return { success: false, message: `Kontakt "${action.data.name}" nicht gefunden` };
      }
      const updated = { ...match };
      if (action.data.company) updated.company = action.data.company;
      if (action.data.position) updated.position = action.data.position;
      try {
        onUpdateContact(updated);
        const changes = [];
        if (action.data.position) changes.push(`Position \u2192 ${action.data.position}`);
        if (action.data.company) changes.push(`Firma \u2192 ${action.data.company}`);
        return { success: true, message: `Kontakt "${action.data.name}" aktualisiert (${changes.join(', ')})` };
      } catch (e) {
        return { success: false, message: `Fehler beim Aktualisieren: ${e.message}` };
      }
    }
    if (action.type === 'enrich_company') {
      const key = apiKey || localStorage.getItem('openai_api_key');
      if (!key) {
        return { success: false, message: "Kein API Key gesetzt - Anreicherung nicht moeglich" };
      }
      try {
        const companyName = action.data.companyName;
        // Gather contacts for this company by looking up company ID
        const companyObj = getCompanyByName ? getCompanyByName(companyName) : null;
        const companyContacts = companyObj
          ? (existingContacts || []).filter(c => c.companyId === companyObj.id)
          : (existingContacts || []).filter(c => c.company?.trim().toLowerCase() === companyName.trim().toLowerCase());
        // Filter relationships relevant to this company
        const companyNodeId = companyObj ? `company_${companyObj.id}` : null;
        const relevantRelationships = companyNodeId
          ? (companyRelationships || []).filter(r => r.source === companyNodeId || r.target === companyNodeId)
          : [];
        const context = {
          contacts: companyContacts,
          relationships: relevantRelationships,
          userCompany: userCompany || null,
          estimatedSize: companyObj?.estimated_size || null,
          currentIndustry: companyObj?.industry || null,
        };
        const result = await enrichCompanyWithAI(companyName, context, key);
        const snippet = result.description ? result.description.slice(0, 80) + (result.description.length > 80 ? '...' : '') : '';
        return { success: true, message: `Daten fuer "${companyName}" gefunden: ${snippet}`, enrichmentResult: { companyName, data: result } };
      } catch (e) {
        return { success: false, message: `Fehler bei Anreicherung: ${e.message}` };
      }
    }
    if (action.type === 'save_enrichment') {
      // Save enrichment data directly to the company row
      const companyObj = getCompanyByName ? getCompanyByName(action.data.companyName) : null;
      if (companyObj && updateCompany) {
        await updateCompany(companyObj.id, {
          ...action.data.enrichmentData,
          enriched_at: new Date().toISOString(),
        });
      }
      return { success: true, message: `Firmendaten fuer "${action.data.companyName}" gespeichert` };
    }
    return { success: false, message: "Unbekannte Aktion" };
  }, [onAddContact, onCreateCompany, onAddRelationship, onUpdateContact, existingContacts, apiKey, getCompanyByName, updateCompany, companyRelationships, userCompany]);

  const callAgent = useCallback(async (history) => {
    const context = {
      existingCompanies: existingCompanies || [],
      existingContactsSample: (existingContacts || []).slice(0, 10),
    };
    return await agentChat(history, apiKey, context);
  }, [apiKey, existingCompanies, existingContacts]);

  // Process approval/rejection and send tool results back to LLM
  const processApprovalResults = useCallback(async (actions) => {
    const storedMsg = pendingAssistantMessage.current;
    if (!storedMsg) return;
    pendingAssistantMessage.current = null;

    // Build tool result messages, collecting enrichment follow-ups
    const enrichmentFollowUps = [];
    const toolResults = await Promise.all(storedMsg.tool_calls.map(async tc => {
      const action = actions.find(a => a.toolCallId === tc.id);
      if (!action) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, message: "Aktion abgelehnt" }) };
      }
      if (action.status === 'approved') {
        const result = await executeAction(action);
        // Collect enrichment results for follow-up review
        if (result.enrichmentResult) {
          enrichmentFollowUps.push(result.enrichmentResult);
        }
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: result.success, message: result.message }) };
      }
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: false, message: "Aktion vom Nutzer abgelehnt" }) };
    }));

    // Add the stored assistant message + tool results to history
    const newHistory = trimHistory([...chatHistory, storedMsg, ...toolResults]);
    setChatHistory(newHistory);
    setPendingActions([]);
    setAwaitingApproval(false);

    // Call agent again so it can summarize
    setIsProcessing(true);
    try {
      const followUp = await callAgent(newHistory);
      if (followUp?.content) {
        setChatHistory(prev => trimHistory([...prev, { role: "assistant", content: followUp.content }]));
        setDisplayMessages(prev => [...prev, { role: "assistant", content: followUp.content }]);
      }
    } catch (err) {
      console.error("Follow-up call failed:", err);
    }
    setIsProcessing(false);

    // Show enrichment results for user review (fallback mode — no toolCallId)
    if (enrichmentFollowUps.length > 0) {
      enrichmentFollowUps.forEach(er => {
        setDisplayMessages(prev => [...prev, { role: "assistant", content: formatEnrichmentResult(er.companyName, er.data) }]);
      });
      const saveActions = enrichmentFollowUps.map(er => ({
        type: 'save_enrichment',
        toolCallId: null,
        data: { companyName: er.companyName, enrichmentData: er.data },
        status: 'pending',
      }));
      setPendingActions(saveActions);
      setAwaitingApproval(true);
    }
  }, [chatHistory, callAgent, executeAction, trimHistory]);

  const handleApproveAll = useCallback(async () => {
    const updated = pendingActions.map(a => ({ ...a, status: 'approved' }));
    setDisplayMessages(prev => [...prev, { role: "assistant", content: `\u2705 ${updated.length} Aktionen werden ausgefuehrt...` }]);
    await processApprovalResults(updated);
  }, [pendingActions, processApprovalResults]);

  const handleRejectAll = useCallback(async () => {
    const updated = pendingActions.map(a => ({ ...a, status: 'rejected' }));
    setDisplayMessages(prev => [...prev, { role: "assistant", content: "Alle Vorschlaege verworfen." }]);
    await processApprovalResults(updated);
  }, [pendingActions, processApprovalResults]);

  const handleApproveOne = useCallback(async (index) => {
    const action = pendingActions[index];

    // Show loading for enrichment (API call takes time)
    if (action.type === 'enrich_company') {
      setIsProcessing(true);
    }

    const result = await executeAction(action);

    if (action.type === 'enrich_company') {
      setIsProcessing(false);
    }

    // Enrichment returns data for review — create save_enrichment follow-up
    if (result.enrichmentResult) {
      const { companyName, data } = result.enrichmentResult;
      setDisplayMessages(prev => [...prev, { role: "assistant", content: formatEnrichmentResult(companyName, data) }]);
      const remaining = pendingActions.filter((_, i) => i !== index);
      const saveAction = {
        type: 'save_enrichment',
        toolCallId: action.toolCallId,
        data: { companyName, enrichmentData: data },
        status: 'pending',
      };
      setPendingActions([saveAction, ...remaining]);
      return;
    }

    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: result.success ? `\u2705 ${result.message}` : `\u274C ${result.message}`
    }]);
    const remaining = pendingActions.filter((_, i) => i !== index);
    setPendingActions(remaining);

    // If no more pending, finalize
    if (remaining.length === 0) {
      const updated = pendingActions.map((a, i) =>
        i === index ? { ...a, status: 'approved' } : { ...a, status: 'rejected' }
      );
      await processApprovalResults(updated);
    }
  }, [pendingActions, executeAction, processApprovalResults]);

  const handleRejectOne = useCallback((index) => {
    const action = pendingActions[index];
    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: `\u274C "${action.data.name || action.data.companyName || action.data.sourceCompany}" uebersprungen.`
    }]);
    const remaining = pendingActions.filter((_, i) => i !== index);
    setPendingActions(remaining);

    // If no more pending, finalize
    if (remaining.length === 0) {
      const updated = pendingActions.map((a, i) =>
        i === index ? { ...a, status: 'rejected' } : { ...a, status: 'rejected' }
      );
      processApprovalResults(updated);
    }
  }, [pendingActions, processApprovalResults]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing || awaitingApproval) return;

    const userMessage = input.trim();
    setInput("");
    setDisplayMessages(prev => [...prev, { role: "user", content: userMessage }]);

    const newHistory = trimHistory([...chatHistory, { role: "user", content: userMessage }]);
    setChatHistory(newHistory);
    setIsProcessing(true);

    try {
      if (!apiKey) {
        // Fallback: rule-based extraction (no conversation, no relationships)
        const extracted = await extractDataFromNotes(userMessage, null);
        const newContacts = extracted.contacts?.filter(c =>
          !existingContacts.some(ec => ec.name.toLowerCase() === c.name.toLowerCase())
        ) || [];
        const newCompanies = extracted.companies?.filter(c =>
          !existingCompanies.includes(c.name)
        ) || [];

        if (newContacts.length === 0 && newCompanies.length === 0) {
          setDisplayMessages(prev => [...prev, {
            role: "assistant",
            content: extracted.summary || "Ich konnte keine neuen Kontakte oder Firmen extrahieren. Gib mir mehr Details!"
          }]);
        } else {
          const actions = [
            ...newContacts.map(c => ({ type: 'contact', toolCallId: null, data: c, status: 'pending' })),
            ...newCompanies.map(c => ({ type: 'company', toolCallId: null, data: c, status: 'pending' })),
          ];
          setPendingActions(actions);
          setAwaitingApproval(true);
          pendingAssistantMessage.current = null; // no tool call message for fallback

          let responseText = "\uD83D\uDCCB Ich habe folgende Daten extrahiert:\n\n";
          if (newContacts.length > 0) {
            responseText += "**Kontakte:**\n";
            newContacts.forEach(c => { responseText += `\u2022 ${c.name} - ${c.position} bei ${c.company}\n`; });
            responseText += "\n";
          }
          if (newCompanies.length > 0) {
            responseText += "**Firmen:**\n";
            newCompanies.forEach(c => { responseText += `\u2022 ${c.name} (~${c.estimatedSize} Mitarbeiter)\n`; });
          }
          setDisplayMessages(prev => [...prev, { role: "assistant", content: responseText }]);
        }
      } else {
        // Agentic flow: call LLM with full history + tools
        const assistantMsg = await callAgent(newHistory);

        if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
          // LLM wants to use tools — queue them for approval
          const actions = toolCallsToActions(assistantMsg.tool_calls);
          pendingAssistantMessage.current = assistantMsg;
          setPendingActions(actions);
          setAwaitingApproval(true);

          // Build summary for display
          let summaryText = "\uD83D\uDCCB Folgende Aktionen vorgeschlagen:\n\n";
          actions.forEach(a => {
            if (a.type === 'contact') summaryText += `\uD83D\uDC64 ${a.data.name} - ${a.data.position} bei ${a.data.company}\n`;
            else if (a.type === 'company') summaryText += `\uD83C\uDFE2 ${a.data.name} (~${a.data.estimatedSize} Mitarbeiter)\n`;
            else if (a.type === 'update_contact') {
              const changes = [a.data.position && `Position \u2192 ${a.data.position}`, a.data.company && `Firma \u2192 ${a.data.company}`].filter(Boolean).join(', ');
              summaryText += `\u270F\uFE0F ${a.data.name} (${changes})\n`;
            }
            else if (a.type === 'enrich_company') {
              summaryText += `\uD83D\uDD0D ${a.data.companyName} (Websuche & Anreicherung)\n`;
            }
            else if (a.type === 'relationship') {
              const typeInfo = RELATIONSHIP_TYPES[a.data.relType];
              summaryText += `\uD83D\uDD17 ${a.data.sourceCompany} \u2192 ${a.data.targetCompany} (${typeInfo?.label || a.data.relType})\n`;
            }
          });

          // Also include any text content from the assistant
          if (assistantMsg.content) {
            summaryText += "\n" + assistantMsg.content;
          }

          setDisplayMessages(prev => [...prev, { role: "assistant", content: summaryText }]);
        } else if (assistantMsg?.content) {
          // Pure text response — add to both histories
          setChatHistory(prev => trimHistory([...prev, { role: "assistant", content: assistantMsg.content }]));
          setDisplayMessages(prev => [...prev, { role: "assistant", content: assistantMsg.content }]);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      setDisplayMessages(prev => [...prev, {
        role: "assistant",
        content: "Entschuldigung, es gab einen Fehler bei der Verarbeitung. Bitte versuche es erneut."
      }]);
    }

    setIsProcessing(false);
  };

  // Fallback approve/reject for rule-based mode (no tool call IDs)
  const handleFallbackApproveAll = useCallback(async () => {
    await Promise.all(pendingActions.map(action => executeAction(action)));
    const count = pendingActions.length;
    setPendingActions([]);
    setAwaitingApproval(false);
    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: `\u2705 ${count} Eintraege wurden hinzugefuegt!\n\nHast du weitere Notizen fuer mich?`
    }]);
  }, [pendingActions, executeAction]);

  const handleFallbackRejectAll = useCallback(() => {
    setPendingActions([]);
    setAwaitingApproval(false);
    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: "Vorschlaege verworfen."
    }]);
  }, []);

  const handleFallbackApproveOne = useCallback(async (index) => {
    const action = pendingActions[index];
    const result = await executeAction(action);
    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: result.success ? `\u2705 ${result.message}` : `\u274C ${result.message}`
    }]);
    const remaining = pendingActions.filter((_, i) => i !== index);
    setPendingActions(remaining);
    if (remaining.length === 0) {
      setAwaitingApproval(false);
    }
  }, [pendingActions, executeAction]);

  const handleFallbackRejectOne = useCallback((index) => {
    const action = pendingActions[index];
    setDisplayMessages(prev => [...prev, {
      role: "assistant",
      content: `\u274C "${action.data.name || action.data.companyName || action.data.sourceCompany}" uebersprungen.`
    }]);
    const remaining = pendingActions.filter((_, i) => i !== index);
    setPendingActions(remaining);
    if (remaining.length === 0) {
      setAwaitingApproval(false);
    }
  }, [pendingActions]);

  // Decide which handlers to use
  const isFallbackMode = pendingAssistantMessage.current === null && pendingActions.length > 0;

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
          }}>{"\uD83E\uDD16"}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>AI Assistent</div>
            <div style={{ fontSize: 9, color: P.textDim }}>Kontakte \u00B7 Firmen \u00B7 Beziehungen</div>
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
          >{"\u2699"}</button>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: `1px solid ${P.border}`,
              borderRadius: 6, padding: "6px 10px",
              color: P.textMuted, cursor: "pointer", fontSize: 12,
            }}
          >{"\u2715"}</button>
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
            {apiKey ? "\u2713 API Key gespeichert - Agentic Mode aktiv" : "Ohne API Key wird regelbasierte Extraktion verwendet"}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {displayMessages.map((msg, i) => (
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
                    {action.type === 'contact' ? '\uD83D\uDC64' : action.type === 'company' ? '\uD83C\uDFE2' : action.type === 'update_contact' ? '\u270F\uFE0F' : action.type === 'enrich_company' ? '\uD83D\uDD0D' : action.type === 'save_enrichment' ? '\uD83D\uDCBE' : '\uD83D\uDD17'}{' '}
                    {action.type === 'relationship'
                      ? `${action.data.sourceCompany} \u2192 ${action.data.targetCompany}`
                      : action.type === 'enrich_company'
                        ? action.data.companyName
                        : action.type === 'save_enrichment'
                          ? action.data.companyName
                          : action.data.name
                    }
                  </div>
                  <div style={{ fontSize: 9, color: P.textDim }}>
                    {action.type === 'contact'
                      ? `${action.data.position} bei ${action.data.company}`
                      : action.type === 'company'
                        ? `~${action.data.estimatedSize} Mitarbeiter`
                        : action.type === 'update_contact'
                          ? [action.data.position && `Position \u2192 ${action.data.position}`, action.data.company && `Firma \u2192 ${action.data.company}`].filter(Boolean).join(', ')
                          : action.type === 'enrich_company'
                            ? 'Per Websuche anreichern'
                            : action.type === 'save_enrichment'
                              ? 'Anreicherungsdaten speichern'
                              : `${RELATIONSHIP_TYPES[action.data.relType]?.label || action.data.relType}`
                    }
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => isFallbackMode ? handleFallbackApproveOne(i) : handleApproveOne(i)}
                    style={{
                      background: P.accent + "20", border: `1px solid ${P.accent}40`,
                      borderRadius: 4, padding: "4px 8px", color: P.accent,
                      fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{"\u2713"}</button>
                  <button
                    onClick={() => isFallbackMode ? handleFallbackRejectOne(i) : handleRejectOne(i)}
                    style={{
                      background: P.red + "20", border: `1px solid ${P.red}40`,
                      borderRadius: 4, padding: "4px 8px", color: P.red,
                      fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{"\u2715"}</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={isFallbackMode ? handleFallbackApproveAll : handleApproveAll}
                disabled={isProcessing}
                style={{
                  flex: 1, padding: "8px", background: P.accent,
                  border: "none", borderRadius: 6, color: P.bg,
                  fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >Alle hinzufuegen</button>
              <button
                onClick={isFallbackMode ? handleFallbackRejectAll : handleRejectAll}
                disabled={isProcessing}
                style={{
                  flex: 1, padding: "8px", background: "transparent",
                  border: `1px solid ${P.border}`, borderRadius: 6,
                  color: P.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  opacity: isProcessing ? 0.5 : 1,
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
            placeholder={awaitingApproval ? "Bitte erst Aktionen bestaetigen oder verwerfen..." : "Fuege deine Discovery Call Notizen ein..."}
            rows={3}
            disabled={awaitingApproval}
            style={{
              width: "100%", padding: "12px", paddingRight: 50,
              background: P.surface, border: `1px solid ${P.border}`,
              borderRadius: 10, color: P.text, fontSize: 11,
              fontFamily: "inherit", resize: "none", outline: "none",
              boxSizing: "border-box",
              opacity: awaitingApproval ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing || awaitingApproval}
            style={{
              position: "absolute", right: 8, bottom: 8,
              width: 36, height: 36, borderRadius: 8,
              background: input.trim() && !awaitingApproval ? `linear-gradient(135deg, ${P.purple}, ${P.blue})` : P.border,
              border: "none", color: "#fff", fontSize: 14,
              cursor: input.trim() && !awaitingApproval ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >{"\u2192"}</button>
        </div>
        <div style={{ fontSize: 9, color: P.textDim, marginTop: 8, textAlign: "center" }}>
          Enter zum Senden {"\u00B7"} Shift+Enter fuer neue Zeile
        </div>
      </div>
    </div>
  );
}
