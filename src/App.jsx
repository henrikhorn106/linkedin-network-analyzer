import { useState, useEffect, useMemo, useCallback } from "react";

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
  const { isLoading: dbLoading, error: dbError, needsOnboarding, completeOnboarding, resetToOnboarding } = useDatabase();

  // User & Company hooks
  const { user, isLoading: userLoading, deleteUser } = useUser();
  const { company, updateCompany, deleteCompany } = useCompany(user?.id);

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
    deleteRelationshipByIndex,
  } = useCompanyRelationships(user?.id);

  // UI State
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [minCompanySize, setMinCompanySize] = useState(1);
  const [seniorityFilter, setSeniorityFilter] = useState(0);
  const [showCompanyLinks, setShowCompanyLinks] = useState(true);
  const [linkingMode, setLinkingMode] = useState(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusNode, setFocusNode] = useState(null);
  const [industryFilter, setIndustryFilter] = useState("all");

  // Auto-adjust filters for large networks
  useEffect(() => {
    if (contacts.length > 500) {
      setMinCompanySize(2);
    }
    if (contacts.length > 1000) {
      setMinCompanySize(3);
    }
  }, [contacts.length]);

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

  // Build network (pass user's company to always show it centered)
  const network = useMemo(() =>
    buildNetwork(filteredContacts, minCompanySize, company?.name, industryFilter),
    [filteredContacts, minCompanySize, company?.name, industryFilter]
  );

  // Top influencers
  const topInfluencers = useMemo(() =>
    [...network.contactNodes].sort((a, b) => b.influenceScore - a.influenceScore).slice(0, 15)
  , [network]);

  // Inferred company connections
  const inferredCompanyLinks = useMemo(() =>
    inferCompanyConnections(filteredContacts, network.companyNodes, Math.max(2, minCompanySize))
  , [filteredContacts, network.companyNodes, minCompanySize]);

  // All company links (inferred + manual)
  const allCompanyLinks = useMemo(() => {
    const links = [...inferredCompanyLinks];
    companyRelationships.forEach(rel => {
      const exists = links.find(l =>
        (l.source === rel.source && l.target === rel.target) ||
        (l.source === rel.target && l.target === rel.source)
      );
      if (!exists) {
        links.push({ ...rel, strength: 1 });
      }
    });
    return links;
  }, [inferredCompanyLinks, companyRelationships]);

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
      setSelectedCompany(prev => prev?.id === company.id ? null : company);
      setSelectedContact(null);
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

  const deleteRelationship = useCallback((index) => {
    deleteRelationshipByIndex(index);
  }, [deleteRelationshipByIndex]);

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
      <TopBar
        contacts={contacts}
        network={network}
        minCompanySize={minCompanySize}
        setMinCompanySize={setMinCompanySize}
        seniorityFilter={seniorityFilter}
        setSeniorityFilter={setSeniorityFilter}
        showCompanyLinks={showCompanyLinks}
        setShowCompanyLinks={setShowCompanyLinks}
        allCompanyLinksCount={allCompanyLinks.length}
        industryFilter={industryFilter}
        setIndustryFilter={setIndustryFilter}
        availableIndustries={network.allIndustries || []}
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

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
        {/* Network visualization */}
        <div style={{ flex: 1, position: "relative", height: "100%" }}>
          <NetworkGraph
              network={network}
              companyColors={companyColors}
              showCompanyLinks={showCompanyLinks}
              allCompanyLinks={allCompanyLinks}
              linkingMode={linkingMode}
              onCompanyClick={handleCompanyClick}
              setSelectedContact={setSelectedContact}
              userCompanyColor={company?.color || null}
              focusNode={focusNode}
              selectedCompany={selectedCompany}
            />

            {/* Overlays */}
            <StatsCards
              filteredContacts={network.filteredContacts}
              companyCount={network.companyNodes.length}
              cLevelCount={topInfluencers.filter(t => t.seniority >= 8).length}
            />

            {selectedContact && !selectedCompany && (
              <ContactTooltip
                contact={selectedContact}
                onEdit={setEditingContact}
                onDelete={deleteContact}
              />
            )}

            <Legend
              showCompanyLinks={showCompanyLinks}
              companyLinkCount={allCompanyLinks.length}
            />

            <LinkingModeIndicator
              linkingMode={linkingMode}
              onCancel={() => setLinkingMode(null)}
            />

            <PerformanceHint
              contactCount={contacts.length}
              linkingMode={linkingMode}
            />
          </div>

          {/* Right panel */}
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
          />
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
