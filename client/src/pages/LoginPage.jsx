import React, {useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// import { useAuth } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth.jsx'; // Updated import path
import api from '../services/api'; // CORRECTED: Import with a lowercase 'a'
function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      // Make API call to the backend login endpoint
    //   const res = await axios.post('http://localhost:3001/api/auth/login', { 
    //     username, 
    //     password 
     const res = await api.post('/auth/login', { username, password });

     
      if (res.data.token) {
        // Use the login function from AuthContext to store the token
        login(res.data.token);
        
        // Redirect the user to the chat page on successful login
        navigate('/chat');
      }
    } catch (err) {
      console.error('Login failed', err);
      // Set an error message to display to the user
      setError(err.response?.data?.msg || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="join-chat-container">
      <div className="welcome-panel">
          <h1>Welcome Back!</h1>
          <p>Connect with friends and colleagues instantly. We're glad to see you again.</p>
          <ul>
            <li>Real-time Messaging</li>
            {/* <li>Share Images and Files</li> */}
            <li>Join Public or Private Rooms</li>
          </ul>
        </div>
      <form onSubmit={handleSubmit}>
        <h3>Login</h3>
        
        {/* Display error message if login fails */}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="submit">Login</button>

        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;