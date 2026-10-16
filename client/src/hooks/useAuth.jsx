import { useContext } from 'react';
import { AuthContext } from '../context/auth-context.js'; // Update this import path

// This hook's logic remains the same.
export const useAuth = () => {
  return useContext(AuthContext);
};