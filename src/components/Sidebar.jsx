import { useState, useEffect } from 'react';
import { P } from '../styles/theme';
import { RELATIONSHIP_TYPES } from '../data/constants';
import { calculateSeniority } from '../utils/networkBuilder';
import { enrichCompanyWithAI } from '../utils/aiExtractor';

const COLOR_PRESETS = [
  "#00E5A0", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#E879F9", "#FFD700", "#22D3EE", "#A3E635",
];

const INDUSTRIES = [
  "Technologie",
  "Finanzdienstleistungen",
  "Beratung",
  "Marketing & Werbung",
  "E-Commerce",
  "Gesundheitswesen",
  "Bildung",
  "Produktion",
  "Immobilien",
  "Sonstiges",
];

export function Sidebar({
  selectedCompany,
  setSelectedCompany,
  selectedContact,
  setSelectedContact,
  topInfluencers,
  companyNodes,
  companyColors,
  companyRelationships,
  onStartLinking,
  onDeleteRelationship,
  userCompany,
  updateCompany,
  renameCompany,
  deleteCompanyContacts,
  onEditContact,
  onDeleteContact,
  onFocusNode,
  contacts,
  getCompanyEnrichment,
  saveCompanyEnrichment,
}) {
  // Format large numbers
  const formatSize = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n;
  };

  // Edit state for company detail view
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editHQ, setEditHQ] = useState('');
  const [editFoundedYear, setEditFoundedYear] = useState('');
  const [editCompanyType, setEditCompanyType] = useState('');
  const [editLinkedinUrl, setEditLinkedinUrl] = useState('');

  // Enrichment state
  const [enrichment, setEnrichment] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const [suggestedSize, setSuggestedSize] = useState(null);

  // Load enrichment when company changes
  useEffect(() => {
    if (selectedCompany && getCompanyEnrichment) {
      const data = getCompanyEnrichment(selectedCompany.name);
      setEnrichment(data);
    } else {
      setEnrichment(null);
    }
    setEnrichError(null);
    setSuggestedSize(null);
  }, [selectedCompany?.name, getCompanyEnrichment]);

  const handleEnrich = async () => {
    if (!selectedCompany) return;
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      setEnrichError('Kein OpenAI API-Key gespeichert. Bitte im AI-Chat konfigurieren.');
      return;
    }
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const companyContacts = (contacts || []).filter(
        c => c.company?.toLowerCase() === selectedCompany.name.toLowerCase()
      );

      // Build relationship context with readable names
      const rels = (companyRelationships || [])
        .filter(r => r.source === selectedCompany.id || r.target === selectedCompany.id)
        .map(r => {
          const otherId = r.source === selectedCompany.id ? r.target : r.source;
          const otherNode = companyNodes.find(c => c.id === otherId);
          const info = RELATIONSHIP_TYPES[r.type] || { label: r.type };
          return {
            source: r.source,
            target: r.target,
            sourceName: r.source === selectedCompany.id ? selectedCompany.name : (otherNode?.name || 'Unbekannt'),
            targetName: r.target === selectedCompany.id ? selectedCompany.name : (otherNode?.name || 'Unbekannt'),
            typeLabel: info.label,
          };
        });

      const context = {
        contacts: companyContacts,
        relationships: rels,
        userCompany: userCompany ? { name: userCompany.name, industry: userCompany.industry } : null,
        estimatedSize: selectedCompany.estimatedSize,
        currentIndustry: enrichment?.industry || selectedCompany.industry || null,
      };

      const result = await enrichCompanyWithAI(selectedCompany.name, context, apiKey);
      const saved = await saveCompanyEnrichment(selectedCompany.name, result);
      setEnrichment(saved);

      // Always prompt user with AI's employee count suggestion
      const aiSize = result.estimated_size ? Number(result.estimated_size) : null;
      if (aiSize) {
        setSuggestedSize(aiSize);
      }
    } catch (err) {
      console.error('Enrichment failed:', err);
      setEnrichError('Anreicherung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsEnriching(false);
    }
  };

  const isUserCompany = selectedCompany && userCompany && selectedCompany.name === userCompany.name;

  const startEditing = () => {
    setEditName(selectedCompany.name);
    setEditSize(selectedCompany.estimatedSize || '');
    setEditIndustry(enrichment?.industry || (isUserCompany ? (userCompany.industry || '') : ''));
    setEditColor(isUserCompany ? (userCompany.color || P.accent) : '');
    setEditDescription(enrichment?.description || '');
    setEditWebsite(enrichment?.website || '');
    setEditHQ(enrichment?.headquarters || '');
    setEditFoundedYear(enrichment?.founded_year || '');
    setEditCompanyType(enrichment?.company_type || '');
    setEditLinkedinUrl(enrichment?.linkedin_url || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveEditing = async () => {
    const newName = editName.trim();
    if (!newName) return;
    const newSize = editSize ? Number(editSize) : null;
    const oldName = selectedCompany.name;

    try {
      if (isUserCompany) {
        await updateCompany({ name: newName, estimated_size: newSize, industry: editIndustry || null, color: editColor || null });
      }
      await renameCompany(oldName, newName, newSize);

      // Save enrichment data for all companies
      const enrichmentData = {
        description: editDescription.trim() || null,
        website: editWebsite.trim() || null,
        headquarters: editHQ.trim() || null,
        founded_year: editFoundedYear ? Number(editFoundedYear) : null,
        company_type: editCompanyType.trim() || null,
        linkedin_url: editLinkedinUrl.trim() || null,
        industry: editIndustry || null,
        estimated_size: newSize,
      };
      const saved = await saveCompanyEnrichment(newName, enrichmentData);
      setEnrichment(saved);

      setSelectedCompany(prev => prev ? {
        ...prev,
        id: `company_${newName}`,
        name: newName,
        estimatedSize: newSize || prev.estimatedSize,
      } : null);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save company edit:', err);
    }
  };

  if (selectedCompany) {
    return (
      <div style={{ width: 280, borderLeft: `1px solid ${P.border}`, background: P.surface, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button
              onClick={() => { setSelectedCompany(null); setIsEditing(false); }}
              style={{
                background: "none", border: "none", color: P.textDim,
                fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                padding: 0, letterSpacing: "0.5px",
              }}
            >
              ← ZURÜCK
            </button>
            {!isEditing && (
              <button
                onClick={startEditing}
                style={{
                  background: P.accent + "15",
                  border: `1px solid ${P.accent}40`,
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 9,
                  color: P.accent,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.5px",
                }}
              >
                BEARBEITEN
              </button>
            )}
          </div>

          {isEditing ? (
            /* Edit form */
            <div>
              {(() => {
                const inputStyle = {
                  width: "100%", padding: "7px 10px", background: P.bg,
                  border: `1px solid ${P.border}`, borderRadius: 5,
                  color: P.text, fontSize: 12, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                };
                const labelStyle = { display: "block", fontSize: 9, color: P.textDim, marginBottom: 4, letterSpacing: "0.5px" };
                const fieldStyle = { marginBottom: 10 };

                return (
                  <>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>FIRMENNAME</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>BESCHREIBUNG</label>
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        placeholder="Was macht die Firma?"
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 40 }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>MITARBEITER</label>
                        <input type="number" value={editSize} onChange={e => setEditSize(e.target.value)} placeholder="z.B. 50" min="1" style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>GEGRÜNDET</label>
                        <input type="number" value={editFoundedYear} onChange={e => setEditFoundedYear(e.target.value)} placeholder="z.B. 2015" min="1800" max="2030" style={inputStyle} />
                      </div>
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>BRANCHE</label>
                      <select
                        value={editIndustry}
                        onChange={e => setEditIndustry(e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer", color: editIndustry ? P.text : P.textMuted }}
                      >
                        <option value="">Branche auswählen...</option>
                        {INDUSTRIES.map(ind => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>FIRMENTYP</label>
                      <select
                        value={editCompanyType}
                        onChange={e => setEditCompanyType(e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer", color: editCompanyType ? P.text : P.textMuted }}
                      >
                        <option value="">Typ auswählen...</option>
                        {["Startup", "Mittelstand", "Enterprise", "Konzern", "Agentur", "Beratung"].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>HAUPTSITZ</label>
                      <input type="text" value={editHQ} onChange={e => setEditHQ(e.target.value)} placeholder="z.B. Berlin, Deutschland" style={inputStyle} />
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>WEBSITE</label>
                      <input type="url" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://..." style={inputStyle} />
                    </div>

                    <div style={fieldStyle}>
                      <label style={labelStyle}>LINKEDIN URL</label>
                      <input type="url" value={editLinkedinUrl} onChange={e => setEditLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." style={inputStyle} />
                    </div>

                    {isUserCompany && (
                      <div style={fieldStyle}>
                        <label style={labelStyle}>BUBBLE-FARBE</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {COLOR_PRESETS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              style={{
                                width: 22, height: 22, borderRadius: 5,
                                background: c,
                                border: editColor === c ? `2px solid ${P.text}` : `2px solid transparent`,
                                cursor: "pointer", outline: "none",
                                boxShadow: editColor === c ? `0 0 6px ${c}60` : "none",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <button
                        onClick={saveEditing}
                        style={{
                          flex: 1, padding: "7px 0",
                          background: P.accent, border: "none", borderRadius: 5,
                          color: "#000", fontSize: 10, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                          letterSpacing: "0.5px",
                        }}
                      >
                        SPEICHERN
                      </button>
                      <button
                        onClick={cancelEditing}
                        style={{
                          flex: 1, padding: "7px 0",
                          background: "transparent", border: `1px solid ${P.border}`,
                          borderRadius: 5, color: P.textDim, fontSize: 10,
                          cursor: "pointer", fontFamily: "inherit",
                          letterSpacing: "0.5px",
                        }}
                      >
                        ABBRECHEN
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            /* Display view */
            <>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: (companyColors[selectedCompany.id] || P.accent) + "18",
                border: `2px solid ${(companyColors[selectedCompany.id] || P.accent)}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
                color: companyColors[selectedCompany.id] || P.accent,
                marginBottom: 12,
              }}>
                {selectedCompany.name[0]}
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5" }}>
                {selectedCompany.name}
              </div>
              <div style={{ fontSize: 11, color: companyColors[selectedCompany.id], marginTop: 3 }}>
                {selectedCompany.memberCount} Kontakte in deinem Netzwerk
              </div>
              <div style={{ fontSize: 10, color: P.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: P.textDim }}>Geschätzte Firmengröße:</span>
                <span style={{ color: P.text, fontWeight: 600 }}>
                  {selectedCompany.estimatedSize?.toLocaleString('de-DE')} Mitarbeiter
                </span>
              </div>
              {/* Show industry from enrichment or user company */}
              {(enrichment?.industry || (isUserCompany && userCompany.industry)) && (
                <div style={{ fontSize: 10, color: P.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: P.textDim }}>Branche:</span>
                  <span style={{ color: P.text, fontWeight: 600 }}>
                    {enrichment?.industry || userCompany?.industry}
                  </span>
                </div>
              )}

              {/* Enrichment data */}
              {enrichment?.enriched_at && (
                <div style={{
                  marginTop: 10, padding: 10, background: P.bg,
                  borderRadius: 7, border: `1px solid ${P.border}`,
                }}>
                  {enrichment.description && (
                    <div style={{ fontSize: 10, color: P.text, lineHeight: 1.5, marginBottom: 8 }}>
                      {enrichment.description}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {enrichment.company_type && (
                      <span style={{
                        fontSize: 8, padding: "3px 7px", borderRadius: 10,
                        background: P.purple + "15", color: P.purple, fontWeight: 600,
                      }}>
                        {enrichment.company_type}
                      </span>
                    )}
                    {enrichment.headquarters && (
                      <span style={{
                        fontSize: 8, padding: "3px 7px", borderRadius: 10,
                        background: P.blue + "15", color: P.blue, fontWeight: 600,
                      }}>
                        📍 {enrichment.headquarters}
                      </span>
                    )}
                    {enrichment.founded_year && (
                      <span style={{
                        fontSize: 8, padding: "3px 7px", borderRadius: 10,
                        background: P.orange + "15", color: P.orange, fontWeight: 600,
                      }}>
                        Gegr. {enrichment.founded_year}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {enrichment.website && (
                      <a
                        href={enrichment.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 8, color: P.accent, textDecoration: "none", fontWeight: 600,
                        }}
                      >
                        Website ↗
                      </a>
                    )}
                    {enrichment.linkedin_url && (
                      <a
                        href={enrichment.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 8, color: "#0A66C2", textDecoration: "none", fontWeight: 600,
                        }}
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: 7, color: P.textDim, marginTop: 6 }}>
                    Angereichert: {new Date(enrichment.enriched_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
              )}

              {/* Enrich button */}
              <button
                onClick={handleEnrich}
                disabled={isEnriching}
                style={{
                  width: "100%", marginTop: 10, padding: "7px 0",
                  background: isEnriching ? P.border : (enrichment?.enriched_at ? P.bg : P.purple + "15"),
                  border: `1px solid ${enrichment?.enriched_at ? P.border : P.purple + "40"}`,
                  borderRadius: 6,
                  color: isEnriching ? P.textDim : (enrichment?.enriched_at ? P.textMuted : P.purple),
                  fontSize: 9, fontWeight: 600,
                  cursor: isEnriching ? "wait" : "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.5px",
                  transition: "all 0.15s",
                }}
              >
                {isEnriching ? "WIRD ANGEREICHERT..." : (enrichment?.enriched_at ? "ERNEUT ANREICHERN" : "MIT KI ANREICHERN")}
              </button>
              {enrichError && (
                <div style={{ fontSize: 8, color: P.red, marginTop: 4 }}>
                  {enrichError}
                </div>
              )}

              {/* Suggested size prompt */}
              {suggestedSize && (
                <div style={{
                  marginTop: 8, padding: 10, background: P.accent + "10",
                  borderRadius: 6, border: `1px solid ${P.accent}30`,
                }}>
                  <div style={{ fontSize: 9, color: P.text, marginBottom: 6 }}>
                    KI schlägt <span style={{ fontWeight: 700, color: P.accent }}>{suggestedSize.toLocaleString('de-DE')}</span> Mitarbeiter vor
                    <span style={{ color: P.textDim }}> (aktuell: {selectedCompany.estimatedSize?.toLocaleString('de-DE') || '?'})</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={async () => {
                        await renameCompany(selectedCompany.name, selectedCompany.name, suggestedSize);
                        setSelectedCompany(prev => prev ? { ...prev, estimatedSize: suggestedSize } : null);
                        setSuggestedSize(null);
                      }}
                      style={{
                        flex: 1, padding: "5px 0",
                        background: P.accent, border: "none", borderRadius: 4,
                        color: "#000", fontSize: 9, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      ÜBERNEHMEN
                    </button>
                    <button
                      onClick={() => setSuggestedSize(null)}
                      style={{
                        flex: 1, padding: "5px 0",
                        background: "transparent", border: `1px solid ${P.border}`,
                        borderRadius: 4, color: P.textDim, fontSize: 9,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      IGNORIEREN
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Relationship linking buttons */}
          <div style={{
            marginTop: 14, padding: 10, background: P.bg,
            borderRadius: 7, border: `1px solid ${P.border}`,
          }}>
            <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1px", marginBottom: 8 }}>
              BEZIEHUNG ERSTELLEN
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(RELATIONSHIP_TYPES).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => onStartLinking(selectedCompany.id, type)}
                  style={{
                    background: info.color + "15",
                    border: `1px solid ${info.color}40`,
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 9,
                    color: info.color,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 8, color: P.textDim, marginTop: 6 }}>
              Klicke auf Button, dann auf Ziel-Firma
            </div>
          </div>

          {/* Existing relationships */}
          {companyRelationships.filter(r => r.source === selectedCompany.id || r.target === selectedCompany.id).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1px", marginBottom: 6 }}>
                BEZIEHUNGEN
              </div>
              {companyRelationships.map((rel, idx) => {
                if (rel.source !== selectedCompany.id && rel.target !== selectedCompany.id) return null;
                const otherId = rel.source === selectedCompany.id ? rel.target : rel.source;
                const otherCompany = companyNodes.find(c => c.id === otherId);
                const info = RELATIONSHIP_TYPES[rel.type] || { label: rel.type, color: P.textMuted, icon: "?" };
                const isSource = rel.source === selectedCompany.id;
                return (
                  <div key={idx} style={{
                    padding: "6px 8px",
                    background: info.color + "10",
                    border: `1px solid ${info.color}30`,
                    borderRadius: 5,
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 9,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: info.color }}>{info.icon}</span>
                      <span style={{ color: P.text }}>{isSource ? (info.label + " von") : ((info.reverseLabel || info.label) + " für")}</span>
                      <span style={{ color: info.color, fontWeight: 600 }}>{otherCompany?.name || "Unknown"}</span>
                    </div>
                    <button
                      onClick={() => onDeleteRelationship(rel.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: P.textDim,
                        cursor: "pointer",
                        fontSize: 10,
                        padding: "2px 4px",
                      }}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Company members */}
          {(() => {
            const members = (selectedCompany.members || []).map(m => ({
              ...m,
              _seniority: m.seniority || calculateSeniority(m.position),
            })).sort((a, b) => b._seniority - a._seniority);
            const keyPlayers = members.filter(m => m._seniority >= 4);
            const others = members.filter(m => m._seniority < 4);
            const companyColor = companyColors[selectedCompany.id] || P.accent;

            const renderMember = (m, i, isKey) => (
              <div key={m.id || i}
                onClick={() => { setSelectedContact(m); onFocusNode?.(m.id); }}
                style={{
                padding: "10px 11px",
                background: isKey ? companyColor + "08" : P.bg,
                borderRadius: 7,
                marginBottom: 5,
                border: `1px solid ${isKey ? companyColor + "25" : P.border}`,
                cursor: "pointer",
                transition: "transform 0.12s",
              }}
                onMouseOver={e => e.currentTarget.style.transform = "translateX(3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "none"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    {isKey && (
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: companyColor,
                        flexShrink: 0,
                        boxShadow: `0 0 4px ${companyColor}60`,
                      }} />
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    {m._seniority >= 8 && (
                      <div style={{
                        fontSize: 7, color: P.gold, background: P.goldDim,
                        padding: "2px 6px", borderRadius: 10, fontWeight: 700,
                      }}>C-LEVEL</div>
                    )}
                    {m._seniority >= 5 && m._seniority < 8 && (
                      <div style={{
                        fontSize: 7, color: companyColor, background: companyColor + "15",
                        padding: "2px 6px", borderRadius: 10, fontWeight: 700,
                      }}>SENIOR</div>
                    )}
                    <button
                      onClick={() => onEditContact(m)}
                      title="Bearbeiten"
                      style={{
                        background: P.blue + "20", border: `1px solid ${P.blue}40`,
                        borderRadius: 3, padding: "2px 5px", fontSize: 8,
                        color: P.blue, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >✎</button>
                    <button
                      onClick={() => {
                        if (confirm(`"${m.name}" wirklich löschen?`)) {
                          onDeleteContact(m.id);
                        }
                      }}
                      title="Löschen"
                      style={{
                        background: P.red + "20", border: `1px solid ${P.red}40`,
                        borderRadius: 3, padding: "2px 5px", fontSize: 8,
                        color: P.red, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >×</button>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: P.textMuted, marginTop: 3 }}>
                  {m.position || 'Connection'}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  {m.connectedOn && (
                    <span style={{ fontSize: 8, color: P.textDim }}>
                      Verbunden: {m.connectedOn}
                    </span>
                  )}
                  {m.linkedinUrl && (
                    <a
                      href={m.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: 8, color: "#0A66C2", textDecoration: "none", fontWeight: 600,
                      }}
                    >
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            );

            return (
              <div style={{ marginTop: 14, maxHeight: 350, overflowY: "auto" }}>
                {keyPlayers.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 9, color: companyColor, letterSpacing: "1px", marginBottom: 6,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{ width: 8, height: 2, background: companyColor, borderRadius: 1 }} />
                      KEY PLAYER ({keyPlayers.length})
                    </div>
                    {keyPlayers.map((m, i) => renderMember(m, i, true))}
                  </>
                )}
                {others.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 9, color: P.textDim, letterSpacing: "1px",
                      marginBottom: 6, marginTop: keyPlayers.length > 0 ? 10 : 0,
                    }}>
                      WEITERE KONTAKTE ({others.length})
                    </div>
                    {others.map((m, i) => renderMember(m, i, false))}
                  </>
                )}
              </div>
            );
          })()}

          {/* Delete company button (not for user's own company) */}
          {!isUserCompany && (
            <button
              onClick={() => {
                const count = selectedCompany.memberCount || 0;
                if (confirm(`"${selectedCompany.name}" und alle ${count} Kontakte wirklich löschen?`)) {
                  deleteCompanyContacts(selectedCompany.name);
                  setSelectedCompany(null);
                  setIsEditing(false);
                }
              }}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "8px 0",
                background: P.red + "12",
                border: `1px solid ${P.red}30`,
                borderRadius: 6,
                color: P.red,
                fontSize: 9,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.5px",
              }}
            >
              FIRMA LÖSCHEN ({selectedCompany.memberCount} Kontakte)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default view: Influencers and Companies
  return (
    <div style={{ width: 280, borderLeft: `1px solid ${P.border}`, background: P.surface, overflowY: "auto", flexShrink: 0 }}>
      <div style={{ padding: 16 }}>
        {/* Top Influencers */}
        <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1.5px", marginBottom: 12 }}>
          TOP INFLUENCER
        </div>
        {topInfluencers.slice(0, 12).map((c, i) => (
          <div
            key={c.id}
            onClick={() => {
              setSelectedContact(c);
              const co = companyNodes.find(n => n.name === c.company);
              setSelectedCompany(co || null);
              onFocusNode?.(c.id);
            }}
            style={{
              padding: "8px 10px",
              background: i < 3 ? P.goldDim : P.bg,
              borderRadius: 7,
              marginBottom: 5,
              border: `1px solid ${i < 3 ? P.gold + "25" : P.border}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 9,
              transition: "transform 0.12s",
            }}
            onMouseOver={e => e.currentTarget.style.transform = "translateX(3px)"}
            onMouseOut={e => e.currentTarget.style.transform = "none"}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: i < 3 ? P.gold + "20" : P.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700,
              color: i < 3 ? P.gold : P.textMuted,
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: P.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.name}
              </div>
              <div style={{
                fontSize: 8, color: P.textDim, marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.position || 'Connection'} · {c.company}
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: i < 3 ? P.gold : P.textMuted }}>
              {(c.normalizedInfluence * 100).toFixed(0)}
            </div>
          </div>
        ))}

        {/* Largest Companies */}
        <div style={{ fontSize: 9, color: P.textDim, letterSpacing: "1.5px", marginTop: 22, marginBottom: 12 }}>
          GRÖßTE FIRMEN
        </div>
        {companyNodes.slice(0, 12).map(c => (
          <div
            key={c.id}
            onClick={() => { setSelectedCompany(c); setSelectedContact(null); onFocusNode?.(c.id); }}
            style={{
              padding: "8px 10px",
              background: P.bg,
              borderRadius: 7,
              marginBottom: 4,
              border: `1px solid ${P.border}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "border-color 0.12s",
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = companyColors[c.id]}
            onMouseOut={e => e.currentTarget.style.borderColor = P.border}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: companyColors[c.id] || P.accent,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10, color: P.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: P.textDim }}>{c.memberCount}×</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: P.textMuted, minWidth: 32, textAlign: "right" }}>
                {formatSize(c.estimatedSize)}
              </span>
            </div>
          </div>
        ))}

        {/* Help text */}
        <div style={{
          marginTop: 18, padding: 10,
          background: P.accentDim, borderRadius: 7,
          border: `1px solid ${P.accent}20`,
        }}>
          <div style={{ fontSize: 9, color: P.accent, lineHeight: 1.7 }}>
            Bubble-Größe = geschätzte Firmengröße. Klicken für Details. Kontakte hovern für Influence-Score.
          </div>
        </div>
      </div>
    </div>
  );
}
