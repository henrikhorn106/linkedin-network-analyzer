import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// Styles
import { P, CC } from "./styles/theme";


// Utils
import { buildNetwork, inferCompanyConnections, calculateSeniority } from "./utils/networkBuilder";

// Database & Hooks
import { useDatabase } from "./contexts/DatabaseContext";
import { useUser } from "./hooks/useUser";
import { useCompany } from "./hooks/useCompany";
import { useContacts } from "./hooks/useContacts";
import { useCompanyRelationships } from "./hooks/useCompanyRelationships";

// Components
import { TopBar } from "./components/TopBar";
import { NetworkGraph } from "./components/NetworkGraph";
import { Sidebar } from "./components/Sidebar";
import { AIChatAssistant } from "./components/AIChatAssistant";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { LoginScreen } from "./components/LoginScreen";
import { SetPasswordScreen } from "./components/SetPasswordScreen";

// UI Components
import { StatsCards } from "./components/ui/StatsCards";
import { ContactTooltip } from "./components/ui/ContactTooltip";
import { Legend } from "./components/ui/Legend";
import { LinkingModeIndicator } from "./components/ui/LinkingModeIndicator";
import { PerformanceHint } from "./components/ui/PerformanceHint";

// Modals
import { AddContactModal } from "./components/modals/AddContactModal";
import { AddCompanyModal } from "./components/modals/AddCompanyModal";
import { SettingsModal } from "./components/modals/SettingsModal";

// Loading Screen Component
function LoadingScreen() {
  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: P.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      color: P.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`,
        marginBottom: 20,
        animation: "pulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ fontSize: 14, color: P.textMuted }}>
        Datenbank wird geladen...
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// Error Screen Component
function ErrorScreen({ error }) {
  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: P.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      color: P.text,
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: P.red,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
        fontSize: 24,
      }}>!</div>
      <div style={{ fontSize: 14, color: P.text, marginBottom: 8 }}>
        Fehler beim Laden der Datenbank
      </div>
      <div style={{ fontSize: 11, color: P.textMuted, textAlign: "center", maxWidth: 400 }}>
        {error?.message || "Ein unbekannter Fehler ist aufgetreten."}
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: P.surface,
          border: `1px solid ${P.border}`,
          borderRadius: 6,
          color: P.text,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Neu laden
      </button>
    </div>
  );
}

export default function App() {
  // Database context
  const { isLoading: dbLoading, error: dbError, needsOnboarding, completeOnboarding, resetToOnboarding, isAuthenticated, currentUser, logout } = useDatabase();

  // User & Company hooks
  const { user, isLoading: userLoading, deleteUser } = useUser();
  const { company, updateCompany, deleteCompany, getCompanyEnrichment, getAllCompanyEnrichments, saveCompanyEnrichment } = useCompany(user?.id);

  // Contacts hook with userId
  const {
    contacts,
    isLoading: contactsLoading,
    addContact: dbAddContact,
    updateContact: dbUpdateContact,
    deleteContact: dbDeleteContact,
    addContacts: dbAddContacts,
    setAllContacts: dbSetAllContacts,
    existingCompanies,
    renameCompany: dbRenameCompany,
    deleteCompanyContacts: dbDeleteCompanyContacts,
  } = useContacts(user?.id);

  // Company relationships hook
  const {
    relationships: companyRelationships,
    addRelationship,
    deleteRelationship,
  } = useCompanyRelationships(user?.id);

  // UI State
  const [selectedCompany, setSelectedCompany] = useState(null);
  const selectedCompanyRef = useRef(null);
  selectedCompanyRef.current = selectedCompany;
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [minCompanySize, setMinCompanySize] = useState(1);
  const [seniorityFilter, setSeniorityFilter] = useState(0);
  const [companyLinkFilter, setCompanyLinkFilter] = useState("all");
  const [linkingMode, setLinkingMode] = useState(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusNode, setFocusNode] = useState(null);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [agarFullscreen, setAgarFullscreen] = useState(false);
  const [focusConnections, setFocusConnections] = useState(false);
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(true);
  const [showContactDots, setShowContactDots] = useState(true);
  const [showContactLines, setShowContactLines] = useState(true);
  const [showCompanyText, setShowCompanyText] = useState(true);
  const [showCompanyLinks, setShowCompanyLinks] = useState(true);
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const graphRef = useRef(null);

  // Listen for agar fullscreen toggle events
  useEffect(() => {
    const onAgarFullscreen = (e) => setAgarFullscreen(e.detail?.active ?? false);
    window.addEventListener("agar-fullscreen", onAgarFullscreen);
    return () => window.removeEventListener("agar-fullscreen", onAgarFullscreen);
  }, []);

  // Fokus defaults to off so all companies show initially
  // (Users can enable Fokus/Direkt manually when needed)

  // Filter contacts by seniority (always keep user's own contact + user's company contacts)
  const filteredContacts = useMemo(() => {
    if (seniorityFilter === 0) return contacts;
    const userCompanyName = company?.name?.toLowerCase();
    return contacts.filter(c => {
      // Always keep user's own contact
      if (typeof c.id === 'string' && c.id.startsWith('user_')) return true;
      // Always keep contacts at user's company
      if (userCompanyName && c.company?.trim().toLowerCase() === userCompanyName) return true;
      const seniority = calculateSeniority(c.position);
      return seniority >= seniorityFilter;
    });
  }, [contacts, seniorityFilter, company?.name]);

  // Get all enrichment data for companies
  const companyEnrichments = useMemo(() => getAllCompanyEnrichments(), [getAllCompanyEnrichments, contacts]);

  // Compute set of company names connected to user's company (for Direkt filter)
  // When a specific link type is selected, only shows companies connected via that type
  const focusCompanyNames = useMemo(() => {
    if (!focusConnections || !company?.name) return null;
    const userCompanyId = `company_${company.name}`;
    const names = new Set();
    companyRelationships.forEach(rel => {
      // When a specific link type is selected, only include that type
      if (companyLinkFilter !== "all" && companyLinkFilter !== "none" && rel.type !== companyLinkFilter) return;
      if (rel.source === userCompanyId) {
        names.add(rel.target.replace(/^company_/, '').trim().toLowerCase());
      }
      if (rel.target === userCompanyId) {
        names.add(rel.source.replace(/^company_/, '').trim().toLowerCase());
      }
    });
    return names.size > 0 ? names : null;
  }, [focusConnections, company?.name, companyRelationships, companyLinkFilter]);

  // Build network (pass user's company to always show it centered)
  const network = useMemo(() =>
    buildNetwork(filteredContacts, minCompanySize, company?.name, industryFilter, companyRelationships, companyEnrichments, focusCompanyNames),
    [filteredContacts, minCompanySize, company?.name, industryFilter, companyRelationships, companyEnrichments, focusCompanyNames]
  );

  // Top influencers
  const topInfluencers = useMemo(() =>
    [...network.contactNodes].sort((a, b) => b.influenceScore - a.influenceScore)
  , [network]);

  // Inferred company connections
  const inferredCompanyLinks = useMemo(() =>
    inferCompanyConnections(filteredContacts, network.companyNodes, Math.max(2, minCompanySize))
  , [filteredContacts, network.companyNodes, minCompanySize]);

  // All company links (inferred + manual)
  const allCompanyLinks = useMemo(() => {
    const links = [...inferredCompanyLinks];
    companyRelationships.forEach(rel => {
      // Only skip if exact same pair AND same type already exists
      const exists = links.find(l =>
        l.type === rel.type &&
        ((l.source === rel.source && l.target === rel.target) ||
         (l.source === rel.target && l.target === rel.source))
      );
      if (!exists) {
        links.push({ ...rel, strength: 1 });
      }
    });
    return links;
  }, [inferredCompanyLinks, companyRelationships]);

  // Filter company links by relationship type
  const filteredCompanyLinks = useMemo(() => {
    if (companyLinkFilter === "all") return allCompanyLinks;
    return allCompanyLinks.filter(l => l.type === companyLinkFilter);
  }, [allCompanyLinks, companyLinkFilter]);

  // Company colors — stable hash per company name so colors don't shift on re-render
  const companyColors = useMemo(() => {
    const hash = (str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      }
      return Math.abs(h);
    };
    const m = {};
    network.companyNodes.forEach(c => { m[c.id] = CC[hash(c.name) % CC.length]; });
    // Override user's company with custom color if set
    if (company?.color && company?.name) {
      m[`company_${company.name}`] = company.color;
    }
    return m;
  }, [network, company?.color, company?.name]);

  // Search results (contacts + companies)
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const t = searchTerm.toLowerCase();
    const matchedCompanies = network.companyNodes
      .filter(c => c.name.toLowerCase().includes(t))
      .slice(0, 4);
    const matchedContacts = network.contactNodes.filter(c =>
      c.name.toLowerCase().includes(t) ||
      (c.company || '').toLowerCase().includes(t) ||
      (c.position || '').toLowerCase().includes(t)
    ).slice(0, 10);
    return [...matchedCompanies, ...matchedContacts].slice(0, 12);
  }, [network, searchTerm]);

  // Handlers
  const handleCSVUpload = useCallback(async (uploadedContacts) => {
    await dbSetAllContacts(uploadedContacts);
    setSelectedCompany(null);
    setSelectedContact(null);
  }, [dbSetAllContacts]);

  const addContact = useCallback(async (contact) => {
    await dbAddContact(contact);
  }, [dbAddContact]);

  const updateContact = useCallback(async (updatedContact) => {
    await dbUpdateContact(updatedContact);
    setEditingContact(null);
  }, [dbUpdateContact]);

  const deleteContact = useCallback(async (contactId) => {
    await dbDeleteContact(contactId);
    setSelectedContact(null);
  }, [dbDeleteContact]);

  const handleContactClick = useCallback((contact) => {
    setSelectedContact(contact);
    if (contact?.id) {
      setFocusNode({ id: contact.id, ts: Date.now() });
    }
  }, []);

  const handleCompanyClick = useCallback((company) => {
    if (linkingMode) {
      if (linkingMode.from !== company.id) {
        const newRel = {
          source: linkingMode.from,
          target: company.id,
          type: linkingMode.type,
        };
        addRelationship(newRel);
      }
      setLinkingMode(null);
    } else {
      const isDeselect = selectedCompanyRef.current?.id === company.id;
      setSelectedCompany(isDeselect ? null : company);
      setSelectedContact(null);
      if (!isDeselect) {
        setFocusNode({ id: company.id, ts: Date.now() });
      }
    }
  }, [linkingMode, addRelationship]);

  const startLinking = useCallback((fromCompanyId, relType) => {
    setLinkingMode({ from: fromCompanyId, type: relType });
    setSelectedCompany(null);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await dbSetAllContacts([]);
      await deleteCompany();
      await deleteUser();
      setSelectedCompany(null);
      setSelectedContact(null);
      resetToOnboarding();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  }, [dbSetAllContacts, deleteCompany, deleteUser, resetToOnboarding]);


  // Show loading screen while database initializes
  if (dbLoading || userLoading) {
    return <LoadingScreen />;
  }

  // Show error screen if database failed to load
  if (dbError) {
    return <ErrorScreen error={dbError} />;
  }

  // Show onboarding flow for new users
  if (needsOnboarding) {
    return (
      <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <OnboardingFlow onComplete={completeOnboarding} />
      </div>
    );
  }

  // Existing user without password — prompt to set one
  if (currentUser && !currentUser.password_hash && !isAuthenticated) {
    return <SetPasswordScreen userName={currentUser.name} />;
  }

  // User exists but not authenticated — show login
  if (!isAuthenticated) {
    return <LoginScreen userName={currentUser?.name} />;
  }

  const handleScreenshot = () => {
    const svgEl = graphRef.current?.getSvgElement();
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true);
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", P.bg);
    clone.insertBefore(bgRect, clone.firstChild);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const w = svgEl.clientWidth;
      const h = svgEl.clientHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "netzwerk.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  };

  // Render main app
  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: P.bg,
      fontFamily: "'JetBrains Mono', monospace",
      color: P.text,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{
        transform: (agarFullscreen || graphFullscreen) ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        marginBottom: (agarFullscreen || graphFullscreen) ? "-48px" : 0,
        position: "relative",
        zIndex: 10,
      }}>
        <TopBar
          contacts={contacts}
          network={network}
          minCompanySize={minCompanySize}
          setMinCompanySize={setMinCompanySize}
          seniorityFilter={seniorityFilter}
          setSeniorityFilter={setSeniorityFilter}
          companyLinkFilter={companyLinkFilter}
          setCompanyLinkFilter={setCompanyLinkFilter}
          allCompanyLinks={allCompanyLinks}
          industryFilter={industryFilter}
          setIndustryFilter={setIndustryFilter}
          availableIndustries={network.allIndustries || []}
          focusConnections={focusConnections}
          setFocusConnections={setFocusConnections}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchResults={searchResults}
          setSelectedContact={setSelectedContact}
          setSelectedCompany={setSelectedCompany}
          onFocusNode={(id) => setFocusNode({ id, ts: Date.now() })}
          onCSVUpload={handleCSVUpload}
          onShowAIChat={() => setShowAIChat(true)}
          onShowAddContact={() => setShowAddContactModal(true)}
          onShowAddCompany={() => setShowAddCompanyModal(true)}
          onShowSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
        {/* Network visualization */}
        <div style={{ flex: 1, position: "relative", height: "100%" }}>
          <NetworkGraph
              ref={graphRef}
              network={network}
              companyColors={companyColors}
              showCompanyLinks={showCompanyLinks}
              allCompanyLinks={filteredCompanyLinks}
              dimRelationships={allCompanyLinks}
              linkingMode={linkingMode}
              onCompanyClick={handleCompanyClick}
              onContactClick={handleContactClick}
              setSelectedContact={setSelectedContact}
              userCompanyColor={company?.color || null}
              focusNode={focusNode}
              selectedCompany={selectedCompany}
              showRelationshipLabels={showRelationshipLabels}
              showContactDots={showContactDots}
              showContactLines={showContactDots && showContactLines}
              showCompanyText={showCompanyText}
            />

            {/* Overlays */}
            <div style={{
              opacity: agarFullscreen ? 0 : 1,
              pointerEvents: agarFullscreen ? "none" : "auto",
              transition: "opacity 0.4s ease",
            }}>
              <StatsCards
                filteredContacts={network.filteredContacts}
                companyCount={network.companyNodes.length}
                cLevelCount={topInfluencers.filter(t => t.seniority >= 8).length}
              />

              {selectedContact && (
                <ContactTooltip
                  contact={selectedContact}
                  onEdit={setEditingContact}
                  onDelete={deleteContact}
                />
              )}

              <Legend
                showCompanyLinks={showCompanyLinks}
                companyLinkCount={filteredCompanyLinks.length}
              />

              <LinkingModeIndicator
                linkingMode={linkingMode}
                onCancel={() => setLinkingMode(null)}
              />

              <PerformanceHint
                totalContacts={contacts.length}
                renderedNodes={network.contactNodes.length + network.companyNodes.length}
                linkingMode={linkingMode}
              />

              {/* Graph toolbar — bottom-right, left of sidebar */}
              {(() => {
                const tbtn = (active, onClick, title, icon) => (
                  <button
                    onClick={onClick}
                    title={title}
                    style={{
                      width: 32, height: 32,
                      background: active ? P.accent + "15" : P.surface + "CC",
                      border: `1px solid ${active ? P.accent + "40" : P.border}`,
                      borderRadius: 6, padding: 0,
                      color: active ? P.accent : P.textMuted,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backdropFilter: "blur(8px)",
                      transition: "all 0.15s",
                    }}
                  >{icon}</button>
                );
                const S = (ch) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ch}</svg>;
                return (
                  <div style={{
                    position: "absolute", right: 12, bottom: 12,
                    display: "flex", flexDirection: "column", gap: 4,
                    background: P.surface + "99", border: `1px solid ${P.border}`,
                    borderRadius: 8, padding: 4,
                    backdropFilter: "blur(8px)",
                  }}>
                    {/* Visibility toggles */}
                    {tbtn(showCompanyLinks,
                      () => setShowCompanyLinks(!showCompanyLinks),
                      showCompanyLinks ? "Beziehungen ausblenden" : "Beziehungen einblenden",
                      S(<><path d="M2 8h4" /><path d="M10 8h4" /><circle cx="8" cy="8" r="2" /><path d="M2 4l3 2" /><path d="M13 4l-3 2" /><path d="M2 12l3-2" /><path d="M13 12l-3-2" /></>)
                    )}
                    {showCompanyLinks && tbtn(showRelationshipLabels,
                      () => setShowRelationshipLabels(!showRelationshipLabels),
                      showRelationshipLabels ? "Labels ausblenden" : "Labels einblenden",
                      S(<><path d="M1 3.5h10l3.5 4.5-3.5 4.5H1V3.5z" /><line x1="5" y1="6.5" x2="8" y2="6.5" /><line x1="5" y1="9.5" x2="7" y2="9.5" /></>)
                    )}
                    {tbtn(showContactDots,
                      () => setShowContactDots(!showContactDots),
                      showContactDots ? "Kontakte ausblenden" : "Kontakte einblenden",
                      S(<><circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="11" cy="4" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="13" cy="11" r="1" fill="currentColor" stroke="none" /></>)
                    )}
                    {showContactDots && tbtn(showContactLines,
                      () => setShowContactLines(!showContactLines),
                      showContactLines ? "Verbindungen ausblenden" : "Verbindungen einblenden",
                      S(<><circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" /><line x1="4" y1="4" x2="12" y2="4" /><line x1="4" y1="4" x2="8" y2="12" /><line x1="12" y1="4" x2="8" y2="12" /></>)
                    )}
                    {tbtn(showCompanyText,
                      () => setShowCompanyText(!showCompanyText),
                      showCompanyText ? "Firmennamen ausblenden" : "Firmennamen einblenden",
                      S(<><text x="8" y="6" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700" fontFamily="monospace">Aa</text><line x1="3" y1="10" x2="13" y2="10" /><line x1="4.5" y1="12.5" x2="11.5" y2="12.5" /></>)
                    )}

                    {/* Separator */}
                    <div style={{ height: 1, background: P.border, margin: "2px 4px" }} />

                    {/* Navigation */}
                    {tbtn(false,
                      () => graphRef.current?.centerOnCompany(),
                      "Auf meine Firma zentrieren",
                      S(<><circle cx="8" cy="8" r="3" /><line x1="8" y1="2" x2="8" y2="5" /><line x1="8" y1="11" x2="8" y2="14" /><line x1="2" y1="8" x2="5" y2="8" /><line x1="11" y1="8" x2="14" y2="8" /></>)
                    )}
                    {tbtn(false,
                      () => graphRef.current?.zoomToFit(),
                      "Alles anzeigen",
                      S(<><path d="M2 5.5V3a1 1 0 011-1h2.5" /><path d="M10.5 2H13a1 1 0 011 1v2.5" /><path d="M14 10.5V13a1 1 0 01-1 1h-2.5" /><path d="M5.5 14H3a1 1 0 01-1-1v-2.5" /><rect x="5" y="5" width="6" height="6" rx="0.5" /></>)
                    )}

                    {/* Separator */}
                    <div style={{ height: 1, background: P.border, margin: "2px 4px" }} />

                    {/* Actions */}
                    {tbtn(false,
                      handleScreenshot,
                      "Screenshot exportieren",
                      S(<><rect x="2" y="4.5" width="12" height="9" rx="1.5" /><circle cx="8" cy="9.5" r="2.5" /><path d="M5.5 4.5L6.5 2.5h3l1 2" /></>)
                    )}
                    {tbtn(graphFullscreen,
                      () => setGraphFullscreen(!graphFullscreen),
                      graphFullscreen ? "Vollbild beenden" : "Vollbild",
                      graphFullscreen
                        ? S(<><path d="M5 2.5H2.5V5" /><path d="M11 2.5h2.5V5" /><path d="M13.5 11V13.5H11" /><path d="M2.5 11V13.5H5" /><line x1="2.5" y1="2.5" x2="6" y2="6" /><line x1="13.5" y1="2.5" x2="10" y2="6" /><line x1="13.5" y1="13.5" x2="10" y2="10" /><line x1="2.5" y1="13.5" x2="6" y2="10" /></>)
                        : S(<><path d="M2 5.5V2.5h3" /><path d="M11 2.5h3V5.5" /><path d="M14 10.5v3h-3" /><path d="M5 13.5H2v-3" /></>)
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right panel */}
          <div style={{
            transform: (agarFullscreen || graphFullscreen) ? "translateX(100%)" : "translateX(0)",
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), margin 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            marginLeft: (agarFullscreen || graphFullscreen) ? "-280px" : 0,
            height: "100%",
            overflow: "hidden",
          }}>
            <Sidebar
              selectedCompany={selectedCompany}
              setSelectedCompany={setSelectedCompany}
              selectedContact={selectedContact}
              setSelectedContact={setSelectedContact}
              topInfluencers={topInfluencers}
              companyNodes={network.companyNodes}
              companyColors={companyColors}
              companyRelationships={companyRelationships}
              onStartLinking={startLinking}
              onDeleteRelationship={deleteRelationship}
              userCompany={company}
              updateCompany={updateCompany}
              renameCompany={dbRenameCompany}
              deleteCompanyContacts={dbDeleteCompanyContacts}
              onEditContact={setEditingContact}
              onDeleteContact={deleteContact}
              onFocusNode={(id) => setFocusNode({ id, ts: Date.now() })}
              contacts={contacts}
              getCompanyEnrichment={getCompanyEnrichment}
              saveCompanyEnrichment={saveCompanyEnrichment}
            />
          </div>
      </div>

      {/* Modals */}
      {showAddContactModal && (
        <AddContactModal
          onAdd={addContact}
          onClose={() => setShowAddContactModal(false)}
          companies={existingCompanies}
        />
      )}

      {editingContact && (
        <AddContactModal
          onAdd={updateContact}
          onClose={() => setEditingContact(null)}
          companies={existingCompanies}
          editContact={editingContact}
        />
      )}

      {showAddCompanyModal && (
        <AddCompanyModal
          onAdd={addContact}
          onClose={() => setShowAddCompanyModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={user}
          company={company}
          onDeleteAccount={handleDeleteAccount}
          onLogout={logout}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAIChat && (
        <AIChatAssistant
          onAddContact={addContact}
          onAddCompany={addContact}
          existingContacts={contacts}
          existingCompanies={existingCompanies}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </div>
  );
}
