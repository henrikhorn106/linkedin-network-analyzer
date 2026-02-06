import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initDatabase, hasUser, persistDatabase, query } from '../db/database';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initDatabase();
        if (mounted) {
          const userExists = hasUser();


          setNeedsOnboarding(!userExists);
          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize database:', err);
        if (mounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  // Reset account and go back to onboarding
  const resetToOnboarding = useCallback(() => {
    setNeedsOnboarding(true);
  }, []);

  // Force persist database
  const persist = useCallback(async () => {
    await persistDatabase();
  }, []);

  const value = {
    isInitialized,
    isLoading,
    error,
    needsOnboarding,
    completeOnboarding,
    resetToOnboarding,
    persist,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
