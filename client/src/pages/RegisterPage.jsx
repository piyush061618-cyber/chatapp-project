import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation for matching passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Make API call to the backend register endpoint
      const res = await api.post('/auth/register', {
        username,
        password,
      });

      if (res.data.token) {
        // Use the login function from AuthContext to store the token
        login(res.data.token);
        
        // Redirect the user to the chat page on successful registration
        navigate('/chat');
      }
    } catch (err) {
      console.error('Registration failed', err);
      // Set an error message to display to the user
      setError(err.response?.data?.msg || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="join-chat-container">
        <div className="welcome-panel">
          <h1>Join ChatApp Today!</h1>
          <p>Sign up to start chatting in real-time. Create rooms, share ideas, and connect with people from all over the world.</p>
          <ul>
            <li>Free and Secure</li>
            <li>Easy to Use</li>
            <li>Cross-Platform</li>
          </ul>
        </div>
      <form onSubmit={handleSubmit}>
        <h3>Create Account</h3>

        
        {/* Display error message if registration fails */}
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
          minLength="6"
        />
        <input 
          type="password" 
          placeholder="Confirm Password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)} 
          required 
        />
        <button type="submit">Register</button>

        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;