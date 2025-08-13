import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { ApiService } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = 'current_user';

const getCurrentUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveCurrentUser = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (error) {
    console.error('Failed to save current user:', error);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const apiUser = await ApiService.getCurrentUser();
        if (apiUser && apiUser.user) {
          const appUser: User = {
            id: apiUser.user.id,
            email: apiUser.user.email || '',
            displayName: apiUser.user.name || apiUser.user.email || '',
            photoURL: undefined,
            createdAt: new Date()
          };
          setUser(appUser);
          saveCurrentUser(appUser);
        } else {
          // Fallback to local storage
          const existingUser = getCurrentUser();
          if (existingUser) {
            setUser(existingUser);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // Fallback to local storage
        const existingUser = getCurrentUser();
        if (existingUser) {
          setUser(existingUser);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const clearError = () => setError(null);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ApiService.login(email, password);
      
      if (response.user) {
        const appUser: User = {
          id: response.user.id,
          email: response.user.email || '',
          displayName: response.user.name || response.user.email || '',
          photoURL: undefined,
          createdAt: new Date()
        };
        setUser(appUser);
        saveCurrentUser(appUser);
      } else {
        throw new Error('Login failed - no user data received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (displayName.trim().length < 2) {
        throw new Error('Display name must be at least 2 characters long');
      }

      const response = await ApiService.register(email, password, displayName);
      
      if (response.user) {
        const appUser: User = {
          id: response.user.id,
          email: response.user.email || '',
          displayName: response.user.name || displayName.trim(),
          photoURL: undefined,
          createdAt: new Date()
        };
        setUser(appUser);
        saveCurrentUser(appUser);
      } else {
        throw new Error('Registration failed - no user data received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await ApiService.logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    
    // Always clear local state regardless of API success/failure
    setUser(null);
    saveCurrentUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      loading, 
      error, 
      clearError 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};