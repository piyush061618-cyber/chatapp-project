import axios from 'axios';

// Automatically determine backend URL from environment or current device hostname
const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
export const BASE_SERVER_URL = import.meta.env.VITE_BACKEND_URL || `http://${defaultHost}:3001`;

const Api = axios.create({
  baseURL: `${BASE_SERVER_URL}/api`,
});

Api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default Api;
