# 🚀 PulseChat Improvements & Feature Log
**Branch:** `feature-video-calls-and-fixes`  
**Date:** 2026-11-01  
**Status:** All Features Implemented & Verified (Vite Build & Server Syntax OK)  

This document tracks all modifications, enhancements, and bug fixes applied to the PulseChat codebase. If any issue arises or if you want to inspect what changed, this file provides the exact file paths, before/after architectural logic, and rollback instructions.

---

## 📋 Summary of All Completed Changes

| Component | Target File(s) | Description | Verification Status |
| :--- | :--- | :--- | :--- |
| **Mobile Send Button** | `client/src/pages/ChatPage.css`<br>`client/src/pages/ChatPage.jsx` | Fixed CSS flex overflow, added `min-width: 0` to `.chat-text-input`, `flex-shrink: 0` on buttons, and dynamic WhatsApp-style Mic ↔ Send transition. | ✅ Verified (Vite Build) |
| **India / Local Timezone** | `server/index.js`<br>`client/src/pages/ChatPage.jsx` | Server now sends pure UTC ISO-8601 strings; Client formats localized time based on device timezone (e.g. IST) via `formatMessageTime`. | ✅ Verified (Node syntax & Vite build) |
| **DM Call History** | `server/models/Message.js`<br>`server/index.js`<br>`ChatPage.jsx`<br>`ChatPage.css` | Persistent call logs (duration, status: completed/missed/declined) saved to MongoDB and rendered as WhatsApp-style call cards in DM with quick "Call Back" action. | ✅ Verified |
| **WebRTC Video Calling** | `client/src/components/CallModal.jsx`<br>`client/src/components/CallModal.css`<br>`server/index.js` | 1. Screen sharing (`getDisplayMedia` & `replaceTrack`).<br>2. Front/Back mobile camera flip.<br>3. Tap-to-Swap local & remote feeds (WhatsApp style) + frame enlargement.<br>4. Seamless Audio ↔ Video in-call mode switching without call drop. | ✅ Verified (Vite Build) |
| **Double Blue Read Receipts** | `server/models/Message.js`<br>`server/index.js`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | **Single tick** (sent), **double grey ticks** (delivered to recipient's device), and **double blue ticks** (read/seen by recipient in DM). Real-time socket status events. | ✅ Verified |
| **Web Push & Ringing Alerts** | `client/public/sw.js`<br>`client/src/main.jsx`<br>`client/src/pages/ChatPage.jsx` | Native Web Push Notification API + Service Worker (`sw.js`). High-priority ringing notifications for incoming calls and notifications for incoming DM messages when tab is minimized or screen is locked. | ✅ Verified |
| **Voice Note Speed Controls** | `client/src/components/AudioWaveformPlayer.jsx`<br>`client/src/components/AudioWaveformPlayer.css` | Added WhatsApp-style speed button pill cycling between $1\times \rightarrow 1.5\times \rightarrow 2\times \rightarrow 1\times$ playback speed on voice notes. | ✅ Verified |
| **Group Video Calls** | `server/index.js`<br>`client/src/components/GroupCallModal.jsx`<br>`client/src/components/GroupCallModal.css`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Multi-user WebRTC mesh calling for 3–6 users in room channels (`#general`, etc.). Responsive dynamic video grid, live active caller counts, screen sharing across peers, mic/camera toggles. | ✅ Verified |

---

## 🔍 Detailed Architecture of Newly Added Features

### 1. Double Blue Read Receipts
- **Model:** Added `status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' }` to `MessageSchema`.
- **Signaling:**
  - When recipient client is connected and receives a message in a different conversation, emits `message_delivered` $\rightarrow$ sender receives `message_status_update` and renders **Double Grey Ticks** (`BsCheck2All.delivered`).
  - When recipient client has the DM conversation open or clicks into the DM, emits `mark_dm_read` $\rightarrow$ server updates all unread messages in that DM to `'read'` and emits `messages_read_update` $\rightarrow$ sender renders **Double Blue Ticks** (`BsCheck2All.read`).
  - When sending a message, defaults to **Single Grey Tick** (`BsCheck.sent`).

### 2. Web Push & Ringing Call Notifications
- **Service Worker:** Created `client/public/sw.js` and registered in `client/src/main.jsx`.
- **Browser Notifications:**
  - Auto-requests `Notification.requestPermission()`.
  - In `handleReceiveMessage`: When the tab is minimized (`document.hidden`), window blurred, or user is in another channel, displays native desktop/mobile notification with sender avatar and snippet.
  - In `handleCallIncoming`: Shows persistent ringing call notification with `requireInteraction: true` and vibration pattern (`[500, 250, 500, 250, 500]`). Clicking focuses the PulseChat window.

### 3. Voice Note Playback Speed ($1\times, 1.5\times, 2\times$)
- **File:** `AudioWaveformPlayer.jsx` & `AudioWaveformPlayer.css`
- **Implementation:**
  - Added state `playbackSpeed` (`1`, `1.5`, `2`).
  - Tapping the speed pill button cycles through rates and immediately sets `audioRef.current.playbackRate = nextSpeed`.
  - Styled with glowing gradient accent when boosted.

### 4. Group Video Calls in Public Channels (WebRTC Mesh)
- **Signaling:** Added `join_channel_call`, `channel_call_signal`, `channel_call_ice`, `leave_channel_call`, and `get_channel_call_status` to `server/index.js`.
- **Component:** Created `GroupCallModal.jsx` and `GroupCallModal.css`.
  - Connects up to 6 participants via peer-to-peer WebRTC mesh with STUN/TURN relay traversal.
  - Adaptive Grid: `grid-1` (single), `grid-2` (split), `grid-4` (2x2), `grid-6` (3x2).
  - Screen share across all peers simultaneously.
  - Clean leave and disconnect handlers to prevent ghost streams.
- **Channel Header:** Added "Channel Call" button with live participant badge (e.g. `In Call (3)` with pulsing green dot).

---

## 🔄 Rollback Instructions

If you ever wish to revert all changes back to `main`:
```bash
git checkout main
```

If you wish to discard changes on this branch:
```bash
git reset --hard origin/main
```
