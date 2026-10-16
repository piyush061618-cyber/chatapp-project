import axios from 'axios';

// Create an Axios instance with a base URL for your backend
const Api = axios.create({
  baseURL: 'http://localhost:3001/api', // Your backend's base URL
});

// Use an interceptor to add the auth token to every request
Api.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage
    const token = localStorage.getItem('token');
    
    // If a token exists, add it to the Authorization header
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

export default Api;