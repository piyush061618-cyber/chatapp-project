import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api';
import './ProfilePage.css';
import {
  BsArrowLeft,
  BsCheckCircleFill,
  BsGear,
  BsChatDots,
  BsGrid3X3,
  BsSliders,
  BsCamera,
  BsHash,
  BsPerson,
  BsX,
  BsSoundwave,
  BsVolumeUp,
  BsVolumeMute,
} from 'react-icons/bs';

function ProfilePage() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => user || {});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'media' | 'settings'
  const [showEditModal, setShowEditModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Edit form states
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const fileInputRef = useRef(null);

  // Settings states
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('chat_sound_enabled') !== 'false';
  });

  // Recent rooms and users
  const [joinedRooms, setJoinedRooms] = useState(['general']);
  const [registeredUsers, setRegisteredUsers] = useState([]);

  // Fetch fresh profile on mount
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        if (isMounted && res.data) {
          setProfile(res.data);
          updateUser(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchMeta = async () => {
      try {
        const [roomsRes, usersRes] = await Promise.all([
          api.get('/rooms').catch(() => ({ data: [] })),
          api.get('/auth/users').catch(() => ({ data: [] })),
        ]);
        if (isMounted) {
          const rooms = (roomsRes.data || []).filter(
            (r) => !r.startsWith('dm__') && !r.startsWith('user_')
          );
          if (!rooms.includes('general')) rooms.unshift('general');
          setJoinedRooms(rooms);
          setRegisteredUsers((usersRes.data || []).filter((u) => u.username !== profile.username));
        }
      } catch (err) {
        console.error('Failed fetching meta:', err);
      }
    };

    fetchProfile();
    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  const openEditModal = () => {
    setEditUsername(profile.username || '');
    setEditFullName(profile.fullName || profile.username || '');
    setEditBio(profile.bio || '');
    setEditAvatar(profile.avatar || '');
    setEditError('');
    setShowEditModal(true);
  };

  const handleAvatarFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Uploading photo...');
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setEditAvatar(res.data.url);
        showToast('Photo uploaded! Click Save to apply.');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setEditError('Photo upload failed. Please try a smaller image.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    const cleanUsername = editUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setEditError('Username cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/auth/profile', {
        username: cleanUsername,
        fullName: editFullName.trim(),
        bio: editBio.trim(),
        avatar: editAvatar.trim(),
      });

      if (res.data?.user) {
        setProfile(res.data.user);
        updateUser(res.data.user, res.data.token);
        setShowEditModal(false);
        showToast('Profile updated successfully! ✨');
      }
    } catch (err) {
      console.error('Save profile failed:', err);
      setEditError(err.response?.data?.msg || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('chat_sound_enabled', String(next));
    showToast(next ? 'Sound effects enabled 🔔' : 'Sound effects muted 🔕');
  };

  const currentAvatarSrc =
    profile.avatar ||
    `https://api.dicebear.com/8.x/adventurer/svg?seed=${profile.username || 'user'}`;

  const presetSeeds = ['pixel_ace', 'cyber_fox', 'luna_star', 'neon_wave', 'cosmo_pilot', 'astro_kid'];

  return (
    <div className="profile-page-wrapper">
      {/* Toast Notification */}
      {toastMessage && <div className="profile-toast">{toastMessage}</div>}

      {/* Top Navigation Bar */}
      <header className="profile-top-nav">
        <div className="profile-nav-left">
          <Link to="/chat" className="profile-back-btn">
            <BsArrowLeft style={{ fontSize: '16px' }} />
            <span>Back to Chat</span>
          </Link>
          <span className="profile-nav-logo">PulseChat</span>
        </div>

        <div className="profile-nav-right">
          <button
            type="button"
            className="profile-back-btn"
            onClick={toggleSound}
            title="Toggle synthesizer sounds"
          >
            {soundEnabled ? <BsVolumeUp /> : <BsVolumeMute />}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>
          <button
            type="button"
            className="profile-logout-btn"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="profile-container">
        {/* Profile Header */}
        <section className="profile-header">
          {/* Avatar with Instagram Rainbow Gradient Ring */}
          <div className="profile-avatar-wrap" onClick={openEditModal} title="Click to change profile photo">
            <div className="profile-ring">
              <img src={currentAvatarSrc} alt="Avatar" className="profile-avatar-img" />
            </div>
            <div className="avatar-hover-overlay">
              <BsCamera style={{ fontSize: '22px' }} />
              <span>Change</span>
            </div>
          </div>

          {/* Details Column */}
          <div className="profile-details">
            {/* Row 1: Username & Action Buttons */}
            <div className="profile-row-user">
              <span className="profile-username">
                {profile.username || 'username'}
                <BsCheckCircleFill className="verified-badge" title="Verified Chat Member" />
              </span>

              <button type="button" className="profile-action-btn" onClick={openEditModal}>
                Edit profile
              </button>

              <button
                type="button"
                className="profile-action-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.origin + '/chat');
                  showToast('Chat link copied to clipboard! 📋');
                }}
              >
                Share profile
              </button>

              <button
                type="button"
                className="profile-settings-btn"
                onClick={() => setActiveTab('settings')}
                title="Account Settings"
              >
                <BsGear />
              </button>
            </div>

            {/* Row 2: Stats Counts */}
            <div className="profile-row-stats">
              <div className="stat-item">
                <span className="stat-bold">{joinedRooms.length}</span> channels
              </div>
              <div className="stat-item">
                <span className="stat-bold">{registeredUsers.length}</span> contacts
              </div>
              <div className="stat-item">
                <span className="stat-pill">🟢 Online Presence</span>
              </div>
            </div>

            {/* Row 3: Name, Bio & Category */}
            <div className="profile-bio-box">
              <span className="profile-fullname">
                {profile.fullName || profile.username || 'Chat User'}
              </span>
              <span className="profile-category">PulseChat Creator · Realtime Member</span>
              <p className="profile-bio-text">
                {profile.bio || 'Living life in real-time. Feel free to send a DM! 🚀💬✨'}
              </p>
              <div className="profile-joined-badge">
                <span>🗓️ Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '2025'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <nav className="profile-tabs-header">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            <BsChatDots />
            <span>My Channels & Chats</span>
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <BsGrid3X3 />
            <span>Shared Media</span>
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <BsSliders />
            <span>Settings</span>
          </button>
        </nav>

        {/* Tab Content */}
        <section className="profile-tab-content">
          {activeTab === 'chats' && (
            <div className="chats-grid">
              {joinedRooms.map((ch) => (
                <div
                  key={ch}
                  className="chat-card"
                  onClick={() => navigate('/chat')}
                >
                  <div className="chat-card-left">
                    <div className="chat-card-icon">
                      <BsHash />
                    </div>
                    <div>
                      <div className="chat-card-name">#{ch}</div>
                      <div className="chat-card-sub">Public Channel</div>
                    </div>
                  </div>
                  <span className="chat-card-jump">Open →</span>
                </div>
              ))}

              {registeredUsers.slice(0, 6).map((u) => (
                <div
                  key={u._id}
                  className="chat-card"
                  onClick={() => navigate('/chat')}
                >
                  <div className="chat-card-left">
                    <img
                      src={u.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${u.username}`}
                      alt="avatar"
                      style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#222' }}
                    />
                    <div>
                      <div className="chat-card-name">@{u.username}</div>
                      <div className="chat-card-sub">{u.fullName || 'Direct Message'}</div>
                    </div>
                  </div>
                  <span className="chat-card-jump">DM →</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="media-grid">
              <div className="media-item-box" onClick={() => navigate('/chat')}>
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80"
                  alt="Shared art"
                />
                <div className="media-overlay">Chat Upload</div>
              </div>
              <div className="media-item-box" onClick={() => navigate('/chat')}>
                <img
                  src="https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80"
                  alt="Shared design"
                />
                <div className="media-overlay">Design Mockup</div>
              </div>
              <div className="media-item-box" onClick={() => navigate('/chat')}>
                <img
                  src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80"
                  alt="Tech setup"
                />
                <div className="media-overlay">Setup Snapshot</div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="chat-card" style={{ cursor: 'default' }}>
                <div>
                  <div className="chat-card-name">Synthesizer Sound Effects</div>
                  <div className="chat-card-sub">Play Web Audio chimes for sent and received messages</div>
                </div>
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={toggleSound}
                  style={{ background: soundEnabled ? '#0095f6' : '#262626' }}
                >
                  {soundEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="chat-card" style={{ cursor: 'default' }}>
                <div>
                  <div className="chat-card-name">Account ID & Handle</div>
                  <div className="chat-card-sub">Unique user identifier for direct routing</div>
                </div>
                <span style={{ fontSize: '13px', color: '#a8a8a8', fontFamily: 'monospace' }}>
                  {profile.username}
                </span>
              </div>

              <div className="chat-card" style={{ cursor: 'default' }}>
                <div>
                  <div className="chat-card-name">Cloud Storage Provider</div>
                  <div className="chat-card-sub">Offloading images from MongoDB to Cloudinary / Server Disk</div>
                </div>
                <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>Active (Phase 4)</span>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="edit-modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span className="edit-modal-title">Edit profile</span>
              <button
                type="button"
                className="edit-modal-close"
                onClick={() => setShowEditModal(false)}
              >
                <BsX />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="edit-modal-body">
                {editError && <div className="insta-error-msg">{editError}</div>}

                {/* Profile Photo Row */}
                <div className="edit-avatar-section">
                  <img
                    src={
                      editAvatar ||
                      `https://api.dicebear.com/8.x/adventurer/svg?seed=${editUsername || 'temp'}`
                    }
                    alt="preview"
                    className="edit-avatar-preview"
                  />
                  <div className="edit-avatar-actions">
                    <span className="edit-avatar-name">{editUsername || 'username'}</span>
                    <button
                      type="button"
                      className="edit-photo-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change profile photo
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFileUpload}
                      style={{ display: 'none' }}
                      accept="image/*"
                    />
                  </div>
                </div>

                {/* Preset Avatars Row */}
                <div className="edit-field-group">
                  <label className="edit-label">Or choose an avatar style:</label>
                  <div className="preset-avatars-row">
                    {presetSeeds.map((seed) => {
                      const url = `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;
                      const isSelected = editAvatar === url;
                      return (
                        <button
                          key={seed}
                          type="button"
                          className={`preset-avatar-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setEditAvatar(url)}
                          title={`Pick avatar: ${seed}`}
                        >
                          <img src={url} alt={seed} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name */}
                <div className="edit-field-group">
                  <label className="edit-label">Full Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Display name"
                    className="edit-input"
                    maxLength={50}
                  />
                </div>

                {/* Username */}
                <div className="edit-field-group">
                  <label className="edit-label">Username (handle)</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Username"
                    className="edit-input"
                    maxLength={30}
                    required
                  />
                </div>

                {/* Bio */}
                <div className="edit-field-group">
                  <label className="edit-label">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Write a bio to introduce yourself..."
                    className="edit-textarea"
                    maxLength={200}
                  />
                  <div className="char-counter">{editBio.length} / 200</div>
                </div>
              </div>

              <div className="edit-modal-footer">
                <button
                  type="button"
                  className="edit-cancel-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="edit-save-btn"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
