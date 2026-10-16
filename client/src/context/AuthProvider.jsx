import React, { useState, useEffect } from 'react';
import { AuthContext } from './auth-context.js';
import api from '../services/api';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Fetch fresh profile on mount or token change
  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          }
        })
        .catch((err) => {
          console.error('Failed to sync auth user profile:', err);
        });
    }
  }, [token]);

  const login = (newToken, userData = null) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const updateUser = (userData, newToken = null) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
    }
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = { token, user, login, updateUser, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
