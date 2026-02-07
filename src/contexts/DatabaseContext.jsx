import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initDatabase, hasUser, getUser, persistDatabase, query, execute } from '../db/database';
import { hashPassword, verifyPassword } from '../utils/crypto';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initDatabase();
        if (mounted) {
          const userExists = hasUser();
          if (userExists) {
            const user = getUser();
            setCurrentUser(user);
            // If user has no password set (legacy), auto-authenticate
            if (!user.password_hash) {
              setIsAuthenticated(true);
            }
          }
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

  // Mark onboarding as complete (also auto-authenticate)
  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    setIsAuthenticated(true);
    const user = getUser();
    setCurrentUser(user);
  }, []);

  // Reset account and go back to onboarding
  const resetToOnboarding = useCallback(() => {
    setNeedsOnboarding(true);
  }, []);

  // Login with password
  const login = useCallback(async (password) => {
    const user = getUser();
    if (!user || !user.password_hash) return false;
    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (valid) {
      setIsAuthenticated(true);
      setCurrentUser(user);
    }
    return valid;
  }, []);

  // Logout
  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  // Set password for existing user without one
  const setUserPassword = useCallback(async (password) => {
    const user = getUser();
    if (!user) return;
    const { hash, salt } = await hashPassword(password);
    await execute(
      'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?',
      [hash, salt, user.id]
    );
    setCurrentUser({ ...user, password_hash: hash, password_salt: salt });
    setIsAuthenticated(true);
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
    isAuthenticated,
    currentUser,
    login,
    logout,
    setUserPassword,
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
