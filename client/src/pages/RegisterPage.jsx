import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';
import './Auth.css';
import { FaFacebook, FaApple, FaGooglePlay } from 'react-icons/fa';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Username is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        username: cleanUsername,
        password,
        fullName: fullName.trim() || cleanUsername,
        bio: bio.trim(),
      });

      if (res.data.token) {
        login(res.data.token, res.data.user);
        navigate('/chat');
      }
    } catch (err) {
      console.error('Registration failed', err);
      setError(err.response?.data?.msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = username.trim().length >= 3 && password.length >= 6;

  return (
    <div className="insta-page-wrapper">
      <div className="insta-main-content" style={{ justifyContent: 'center' }}>
        <div className="insta-forms-col">
          {/* Main Card */}
          <div className="insta-box">
            <h1 className="insta-brand-logo">Instagram</h1>
            <p className="insta-brand-sub">
              Sign up to see photos and messages from your friends.
            </p>

            <button
              type="button"
              className="insta-btn-submit"
              style={{ backgroundColor: '#1877f2', marginBottom: '14px' }}
              onClick={() => {
                setUsername('insta_user_' + Math.floor(Math.random() * 1000));
                setFullName('Instagram Explorer');
                setBio('Living life in real-time 📸💬');
                setPassword('password123');
              }}
            >
              <FaFacebook style={{ fontSize: '18px' }} />
              <span>Fill with Instant Profile</span>
            </button>

            <div className="insta-divider">
              <div className="insta-divider-line" />
              <span className="insta-divider-text">or</span>
              <div className="insta-divider-line" />
            </div>

            {error && <div className="insta-error-msg">{error}</div>}

            <form onSubmit={handleSubmit} className="insta-form">
              <div className="insta-input-wrapper">
                <input
                  type="text"
                  placeholder="Username (handle)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="insta-input"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="insta-input-wrapper">
                <input
                  type="text"
                  placeholder="Full Name (display name)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="insta-input"
                />
              </div>

              <div className="insta-input-wrapper">
                <input
                  type="text"
                  placeholder="Bio / Status (optional)"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="insta-input"
                  maxLength={150}
                />
              </div>

              <div className="insta-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="insta-input"
                  autoComplete="new-password"
                  required
                  minLength="6"
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

              <p className="insta-terms">
                People who use our service may have uploaded your contact information to ChatApp.{' '}
                <a href="#learn" onClick={(e) => e.preventDefault()}>Learn More</a>
              </p>

              <p className="insta-terms" style={{ marginTop: '4px' }}>
                By signing up, you agree to our{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a>,{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a> and{' '}
                <a href="#cookies" onClick={(e) => e.preventDefault()}>Cookies Policy</a>.
              </p>

              <button
                type="submit"
                disabled={!isFormValid || loading}
                className="insta-btn-submit"
                style={{ marginTop: '14px' }}
              >
                {loading ? 'Creating account...' : 'Sign up'}
              </button>
            </form>
          </div>

          {/* Secondary Switch Box */}
          <div className="insta-switch-box">
            <span>Have an account?</span>
            <Link to="/login" className="insta-switch-link">
              Log in
            </Link>
          </div>

          {/* App Badges */}
          <div className="insta-app-section">
            <div className="insta-app-text">Get the app.</div>
            <div className="insta-app-badges">
              <div className="insta-app-badge-btn" onClick={() => alert('ChatApp iOS app coming soon!')}>
                <FaApple className="insta-badge-icon" />
                <div className="insta-badge-col">
                  <span className="insta-badge-sub">Download on the</span>
                  <span className="insta-badge-bold">App Store</span>
                </div>
              </div>
              <div className="insta-app-badge-btn" onClick={() => alert('ChatApp Android app coming soon!')}>
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
          <a href="#lite" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Instagram Lite</a>
          <a href="#threads" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Threads</a>
          <a href="#meta-verified" className="insta-footer-link" onClick={(e) => e.preventDefault()}>Meta Verified</a>
        </div>
        <div className="insta-footer-copy">
          <span>English (UK)</span>
          <span>© 2026 ChatApp from Meta</span>
        </div>
      </footer>
    </div>
  );
}

export default RegisterPage;
