import { useState, useCallback, useEffect } from 'react';
import { query, execute, lastInsertRowId } from '../db/database';
import { useDatabase } from '../contexts/DatabaseContext';

export function useUser() {
  const { isInitialized } = useDatabase();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(() => {
    if (!isInitialized) return;
    setIsLoading(true);
    try {
      const users = query('SELECT * FROM users LIMIT 1');
      setUser(users[0] || null);
    } catch (err) {
      console.error('Failed to load user:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Load user when database is initialized
  useEffect(() => {
    if (isInitialized) {
      loadUser();
    }
  }, [isInitialized, loadUser]);

  const createUser = useCallback(async (userData) => {
    const { name, email, role } = userData;
    await execute(
      'INSERT INTO users (name, email, role) VALUES (?, ?, ?)',
      [name, email || null, role || null]
    );
    const id = lastInsertRowId('users');
    const newUser = { id, name, email, role };
    setUser(newUser);
    return newUser;
  }, []);

  const updateUser = useCallback(async (userData) => {
    if (!user) return null;
    const { name, email, role } = userData;
    await execute(
      'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
      [name, email || null, role || null, user.id]
    );
    const updatedUser = { ...user, name, email, role };
    setUser(updatedUser);
    return updatedUser;
  }, [user]);

  const deleteUser = useCallback(async () => {
    if (!user) return;
    await execute('DELETE FROM users WHERE id = ?', [user.id]);
    setUser(null);
  }, [user]);

  return {
    user,
    isLoading,
    createUser,
    updateUser,
    deleteUser,
    reloadUser: loadUser,
  };
}
