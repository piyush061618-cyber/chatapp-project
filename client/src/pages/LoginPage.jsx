import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api';
import './Auth.css';
import { FaFacebook, FaApple, FaGooglePlay } from 'react-icons/fa';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Dynamic phone mock preview chat messages
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveScreenIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        username: username.trim(),
        password,
      });

      if (res.data.token) {
        login(res.data.token, res.data.user);
        navigate('/chat');
      }
    } catch (err) {
      console.error('Login failed', err);
      setError(err.response?.data?.msg || 'Incorrect username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setUsername('alex_design');
    setPassword('demo123456');
    setError('');
    setLoading(true);
    try {
      // Try login first
      let res;
      try {
        res = await api.post('/auth/login', { username: 'alex_design', password: 'demo123456' });
      } catch (err) {
        // If demo user doesn't exist yet, auto-register
        res = await api.post('/auth/register', {
          username: 'alex_design',
          password: 'demo123456',
          fullName: 'Alex Rivera',
          bio: 'UI/UX Designer & Realtime Web Enthusiast 🎨✨',
        });
      }
      if (res.data.token) {
        login(res.data.token, res.data.user);
        navigate('/chat');
      }
    } catch (err) {
      setError('Failed to log in as demo user.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = username.trim().length > 0 && password.length >= 1;

  return (
    <div className="insta-page-wrapper">
      <div className="insta-main-content">
        {/* Left Side: Realistic Smartphone Frame Mockup */}
        <div className="insta-phone-container">
          <div className="insta-phone-island" />
          <div className="insta-phone-screen">
            <div className="insta-screen-header">
              <span className="insta-screen-logo">PulseChat</span>
              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>Direct</span>
            </div>

            {/* Stories Row */}
            <div className="insta-mock-stories">
              {['sophia', 'marcus', 'elena', 'david', 'chloe'].map((name, i) => (
                <div key={name} className="insta-mock-story-item">
                  <div className="insta-mock-ring">
                    <img src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${name}`} alt="story" />
                  </div>
                  <span className="insta-mock-story-name">{name}</span>
                </div>
              ))}
            </div>

            {/* Dynamic Chat Messages Feed */}
            <div className="insta-mock-chat-feed">
              <div className="insta-mock-bubble received">
                Hey! Did you check out the new chat app design? 🔥
              </div>
              <div className="insta-mock-bubble sent">
                Yes! PulseChat is lightning fast and messages arrive in under 5ms ⚡
              </div>
              {activeScreenIndex >= 1 && (
                <div className="insta-mock-bubble received">
                  The animations and profile customization are super clean ✨
                </div>
              )}
              {activeScreenIndex >= 2 && (
                <div className="insta-mock-bubble sent">
                  Jump into #general, everyone is online right now! 🚀
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Dual Card Stack */}
        <div className="insta-forms-col">
          {/* Main Card */}
          <div className="insta-box">
            <h1 className="insta-brand-logo">PulseChat</h1>

            {error && <div className="insta-error-msg">{error}</div>}

            <form onSubmit={handleSubmit} className="insta-form">
              <div className="insta-input-wrapper">
                <input
                  type="text"
                  placeholder="Phone number, username, or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="insta-input"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="insta-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="insta-input"
                  autoComplete="current-password"
                  required
                />
                {password && (
                  <button
                    type="button"
                    className="insta-toggle-pwd"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormValid || loading}
                className="insta-btn-submit"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <div className="insta-divider">
                <div className="insta-divider-line" />
                <span className="insta-divider-text">or</span>
                <div className="insta-divider-line" />
              </div>

              <button
                type="button"
                className="insta-fb-btn"
                onClick={handleDemoLogin}
                title="Instant access with pre-configured demo account"
              >
                <FaFacebook style={{ fontSize: '18px' }} />
                <span>Log in with Demo Account</span>
              </button>

              <a
                href="#forgot"
                className="insta-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  alert('To reset your password, contact your workspace administrator or log in with demo account.');
                }}
              >
                Forgot password?
              </a>
            </form>
          </div>

          {/* Secondary Switch Box */}
          <div className="insta-switch-box">
            <span>Don't have an account?</span>
            <Link to="/register" className="insta-switch-link">
              Sign up
            </Link>
          </div>

          {/* App Download Section */}
          <div className="insta-app-section">
            <div className="insta-app-text">Get the app.</div>
            <div className="insta-app-badges">
              <div className="insta-app-badge-btn" onClick={() => alert('PulseChat iOS App coming soon!')}>
                <FaApple className="insta-badge-icon" />
                <div className="insta-badge-col">
                  <span className="insta-badge-sub">Download on the</span>
                  <span className="insta-badge-bold">App Store</span>
                </div>
              </div>
              <div className="insta-app-badge-btn" onClick={() => alert('PulseChat Android App coming soon!')}>
                <FaGooglePlay className="insta-badge-icon" />
                <div className="insta-badge-col">
                  <span className="insta-badge-sub">GET IT ON</span>
                  <span className="insta-badge-bold">Google Play</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instagram Official Style Footer */}
      <footer className="insta-footer">
        <div className="insta-footer-links">
          <a href="#meta" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Meta</a>
          <a href="#about" className="insta-footer-link" onClick={(e) => e.preventDefault()}>About</a>
          <a href="#blog" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Blog</a>
          <a href="#jobs" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Jobs</a>
          <a href="#help" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Help</a>
          <a href="#api" className="insta-footer-link" onClick={(e) => e.preventDefault()}>API</a>
          <a href="#privacy" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Privacy</a>
          <a href="#terms" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#locations" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Locations</a>
          <a href="#lite" className="insta-footer-link" onClick={(e) => e.preventDefault()}>PulseChat Web</a>
          <a href="#threads" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Threads</a>
          <a href="#meta-verified" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Meta Verified</a>
        </div>
        <div className="insta-footer-copy">
          <span>English (UK)</span>
          <span>© 2026 PulseChat Official</span>
        </div>
      </footer>
    </div>
  );
}

export default LoginPage;
