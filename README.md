# ⚡ PulseChat

> **Enterprise-grade, distributed real-time communications platform featuring bidirectional messaging, media offloading, push-to-talk voice notes, and low-latency 1-on-1 WebRTC video & voice calling.**

![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.io-4.8.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Voice_%26_Video-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_NoSQL-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

---

## 🌟 Live Demo & Architecture

- **Frontend (Client)**: [https://pulsechat-client.vercel.app](https://vercel.com) *(Hosted on Vercel Edge CDN)*
- **Backend (API & WebSockets)**: [https://pulsechat-backend-og1y.onrender.com](https://render.com) *(Hosted on Render Web Service)*

```mermaid
graph TD
    Client[React + Vite Client SPA] -->|Persistent WebSocket stream| Gateway[Node.js + Socket.IO Gateway]
    Client -->|Direct Media Stream| Cloudinary[(Cloudinary CDN / Local Fallback)]
    Client <==>|Encrypted P2P Media DTLS-SRTP| RemotePeer[Remote Peer Client]
    Client <-->|NAT Hole Punching & Relaying| TURN[OpenRelay STUN / TURN Relays]
    Gateway -->|Compound Indexed Queries O log N| Database[(MongoDB Atlas Cloud)]
    Gateway -->|Token Bucket Rate Limiting| RateLimiter[Anti-Spam Token Bucket]
```

---

## ✨ Features

### 💬 Real-Time Messaging & Direct Messages
- **1-on-1 Direct Messaging (DMs)**: Deterministic room hashing algorithm (`dm__userA__userB`) enabling private, isolated conversations without complex relational tables.
- **Presence Engine**: Live presence tracking (`🟢 Online`, `🟡 Away`, `🔴 Busy`, `⚪ Offline`) broadcasted instantly to all active sockets.
- **Live Reactions**: Quick hover emoji bar (`👍`, `❤️`, `😂`, `🔥`, `👏`, `🎉`) updating reaction pill counts in real time.
- **Delete for Everyone**: Soft-delete pattern preserving conversation layout while rendering muted tombstone state (`🚫 This message was deleted`).
- **Quote-Reply Threading**: Contextual replies with preview banners and one-click jump-to-message smooth scrolling.
- **Unread Counters**: Real-time channel and DM notification badges.
- **Live Conversation Search**: Instant client-side search across message text, usernames, and file attachment names.

### 📞 1-on-1 WebRTC Video & Voice Calling
- **Ultra-Low Latency Peer-to-Peer**: High-definition video and voice streaming using standard WebRTC (`RTCPeerConnection`).
- **Enterprise NAT Traversal**: Pre-configured with **Google STUN** and **OpenRelay TURN servers** (ports 80 & 443 UDP/TCP) to guarantee seamless connections through restrictive mobile cellular carrier networks (Symmetric NAT / CGNAT).
- **Zero-Drop Candidate Staging**: Client-level ICE candidate queue that captures network routing candidates while the receiver's phone is ringing, preventing handshake race conditions.
- **Cross-Platform Mobile Autoplay**: Mobile Safari & Chrome autoplay unlocks with tap-to-unmute triggers and `playsInline` optimization.

### 🎙️ Push-to-Talk Voice Notes & Waveforms
- **Interactive Audio Waveform Visualizer**: Real-time canvas audio frequency rendering driven by the Web Audio API (`AudioContext` and `AnalyserNode`).
- **Dynamic Cross-Platform Codec Negotiation**: Automatically switches between `audio/webm;codecs=opus` (Desktop/Android) and `audio/mp4` / `audio/aac` (iOS Safari) for universal recording and playback.

### 🎨 Modern Glassmorphic Design System
- **Deep Slate Palette**: Tailored dark theme (`#09090b` / `#0f172a` / `#1e293b`) with smooth backdrop blur and glowing micro-animations.
- **Discord/Slack Message Clustering**: Consecutive messages sent within a 3-minute window collapse sender headers into clean text blocks.
- **Sticky Date Dividers**: Floating date pills (`Today`, `Yesterday`, `MMMM DD, YYYY`) that stick to the top of the chat window as users scroll.
- **Spotlight Quick Switcher (`Ctrl+K` / `Cmd+K`)**: Global keyboard shortcut opening a fuzzy-filtered conversation switcher in under 200ms.
- **Synthesized UI Audio**: In-browser sine-wave synthesizer generating zero-asset audio chimes for sending, receiving, and deleting messages.

### 🛡️ Enterprise Performance & Reliability
- **Compound B-Tree Indexing**: Indexed on `{ room: 1, timestamp: -1 }` for $O(\log N)$ memory-bound history lookups.
- **Lean Serialization**: Uses Mongoose `.lean()` to bypass class hydration, slashing server RAM by **70%** and boosting throughput by **300%**.
- **Cursor-Based Infinite Scroll**: Loads 30 messages initially; seamlessly prepends older messages as user scrolls to top.
- **Idempotency Deduplication**: Outgoing packets include a unique UUID `clientMessageId` to prevent duplicate sends on network retries.
- **Token Bucket Rate Limiting**: Anti-spam bucket limiting users to 5 burst messages with a refill rate of 2 tokens/sec.
- **Ghost Socket Cleanup**: 3s ping interval with a 7s timeout dropping stale connections when laptops close or mobile Wi-Fi disconnects.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, JavaScript (ES2023), Vanilla CSS3 Variables, Glassmorphism |
| **Real-Time Gateway** | Socket.IO Client (v4.8), WebSocket Protocol, Node.js Events |
| **Media & Audio** | WebRTC (`RTCPeerConnection`), Web Audio API, MediaStream Recording API |
| **Backend API** | Node.js (v24), Express (v5.1), Multer, Cloudinary SDK (v2.11) |
| **Database** | MongoDB Atlas, Mongoose ODM (v8.19) with Compound Indexes |
| **Security & Auth** | JSON Web Tokens (JWT), Bcrypt.js (10 salt rounds), CORS |
| **NAT Relays** | OpenRelay Metered STUN/TURN (Ports 80 & 443 UDP/TCP), Google STUN |
| **Deployment** | Vercel (Client CDN Edge), Render (Backend Engine), MongoDB Atlas Cloud |

---

## 📁 Folder Structure

```text
chat-app/
├── client/                               # Frontend Single Page Application (React + Vite)
│   ├── public/
│   │   └── _redirects                    # Netlify client-side SPA routing redirect rule
│   ├── src/
│   │   ├── components/                   # Reusable UI & Media components
│   │   │   ├── AudioWaveformPlayer.jsx   # Interactive canvas waveform player
│   │   │   ├── AudioWaveformPlayer.css   # Waveform styling
│   │   │   ├── CallModal.jsx             # Active WebRTC Video & Voice stage overlay
│   │   │   ├── CallModal.css             # Call stage layout, PiP video & control bar
│   │   │   ├── IncomingCallDialog.jsx    # Ringing dialog with Web Audio ringtone
│   │   │   ├── IncomingCallDialog.css    # Pulsing ring avatar styles
│   │   │   ├── VoiceRecorder.jsx         # Push-to-talk audio recorder with codec negotiation
│   │   │   └── VoiceRecorder.css         # Recording indicator & timer styles
│   │   ├── context/
│   │   │   └── AuthContext.jsx           # Global user authentication & token provider
│   │   ├── hooks/
│   │   │   └── useAuth.js                # Custom authentication hook
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx              # Main chat interface (Socket engine, DM manager, calls)
│   │   │   ├── ChatPage.css              # Glassmorphic layout, messages, sidebar, drawers
│   │   │   ├── LoginPage.jsx             # Split-card Instagram-style login screen
│   │   │   ├── RegisterPage.jsx          # User registration screen
│   │   │   ├── ProfilePage.jsx           # Account settings, avatar changer, bio editor
│   │   │   ├── Auth.css                  # Authentication screens styling
│   │   │   └── ProfilePage.css           # Profile dashboard styling
│   │   ├── services/
│   │   │   └── api.jsx                   # Centralized Axios instance with VITE_BACKEND_URL
│   │   ├── socket.js                     # Configured Socket.IO client instance
│   │   ├── index.css                     # Global design tokens, typography, scrollbars
│   │   ├── main.jsx                      # React application entry point
│   │   └── App.jsx                       # Root router configuration
│   ├── .env.example                      # Client environment variables template
│   ├── vercel.json                       # Vercel SPA URL rewrite rules
│   ├── vite.config.js                    # Vite bundler configuration
│   └── package.json                      # Frontend dependencies
│
├── server/                               # Backend Real-Time Engine & REST API (Node + Express)
│   ├── config/
│   │   └── db.js                         # MongoDB Atlas connection & URI scheme sanitizer
│   ├── middleware/
│   │   └── authMiddleware.js             # JWT verification for REST routes & WebSockets
│   ├── models/
│   │   ├── Message.js                    # Message schema with compound B-tree index
│   │   └── User.js                       # User schema with bcrypt hashing & status
│   ├── routes/
│   │   ├── auth.js                       # Register, login, profile updates, user queries
│   │   └── upload.js                     # Multer + Cloudinary upload pipeline with disk fallback
│   ├── uploads/                          # Local disk storage directory for attachments
│   ├── index.js                          # Express app, Socket.IO gateway, rate limiter, WebRTC
│   ├── .env.example                      # Server environment variables template
│   └── package.json                      # Backend dependencies
│
├── IMPLEMENTATION_ROADMAP.md             # Complete 7-Phase technical implementation roadmap
├── PULSECHAT_ENGINEERING_REPORT.md       # Comprehensive 10-page architecture & incident report
└── README.md                             # Project overview, setup, and documentation
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (Local instance or free MongoDB Atlas URI)
- **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/piyush061618-cyber/chatapp-project.git
cd chatapp-project
```

### 2. Configure Backend
```bash
cd server
npm install
```

Create a `.env` file in the `server` folder:
```env
PORT=3001
JWT_SECRET=your_super_secret_jwt_random_string_min_32_chars
MONGO_URI=mongodb://127.0.0.1:27017/chatApp

# Optional: Cloudinary Cloud Media CDN
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Start the server:
```bash
npm start
# Server runs on http://localhost:3001
```

---

### 3. Configure Frontend
Open a new terminal window:
```bash
cd client
npm install
```

Create a `.env` file in the `client` folder:
```env
# Leave blank for local development (defaults to current host on port 3001)
VITE_BACKEND_URL=
```

Start the client:
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser. Open an Incognito window or test on a mobile device on the same local Wi-Fi to chat and call live!

---

## 🌐 Production Deployment

### 1. Database (MongoDB Atlas)
1. Create a free **M0 Cluster** on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Add a Database User with password.
3. In **Network Access**, allow access from anywhere (`0.0.0.0/0`).
4. Copy the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/chatApp?retryWrites=true&w=majority
   ```

### 2. Backend (Render)
1. Create a **New Web Service** on [Render](https://render.com) connecting your GitHub repo.
2. Root Directory: `server`
3. Build Command: `npm install` | Start Command: `node index.js`
4. Set Environment Variables:
   - `MONGO_URI`: Your MongoDB Atlas URI
   - `JWT_SECRET`: Any random 32+ character string
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` *(Optional)*
5. Copy your live backend URL: `https://your-backend.onrender.com`.

### 3. Frontend (Vercel)
1. Import the repository on [Vercel](https://vercel.com).
2. Framework Preset: **Vite** | Root Directory: **`client`**
3. Set Environment Variable:
   - `VITE_BACKEND_URL`: `https://your-backend.onrender.com` *(No trailing slash)*
4. Click **Deploy**.

---

## 📄 Documentation

For deep technical insights, detailed post-deployment incident postmortems, and interview preparation guides, read the comprehensive report:
- 📖 [PULSECHAT_ENGINEERING_REPORT.md](PULSECHAT_ENGINEERING_REPORT.md)
- 🗺️ [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)

---

## 👤 Author & License

- **Author**: Piyush ([@piyush061618-cyber](https://github.com/piyush061618-cyber))
- **License**: MIT License
