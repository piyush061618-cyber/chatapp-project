import axios from 'axios';

// Automatically determine backend IP based on current device's hostname
const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

const Api = axios.create({
  baseURL: `http://${host}:3001/api`,
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
