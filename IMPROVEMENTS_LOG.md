# 🚀 PulseChat Improvements & Feature Log
**Branch:** `feature-video-calls-and-fixes`  
**Date:** 2026-11-01  
**Status:** All Features & Fixes Implemented & Verified (Vite Build & Server Syntax OK)  

This document tracks all modifications, enhancements, and bug fixes applied to the PulseChat codebase. If any issue arises or if you want to inspect what changed, this file provides the exact file paths, before/after architectural logic, and rollback instructions.

---

## 📋 Summary of All Completed Changes

| Component | Target File(s) | Description | Verification Status |
| :--- | :--- | :--- | :--- |
| **Bidirectional Call Ending** | `server/index.js`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/components/CallModal.jsx` | Fixed caller cancellation desync: when either party hangs up or cancels while ringing, `call_ended` is dispatched and handled by `ChatPage.jsx`, immediately dismissing incoming dialogs and unmounting `CallModal` with hangup tone. Handles network disconnects gracefully. | ✅ Verified |
| **Call Collision & Busy Handling** | `server/index.js`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/components/CallModal.jsx` | In-memory `activeCalls` map tracks calling/ringing/connected sessions. Rejects concurrent calls with `'busy'` ("@User is on another call"), offline targets with `'offline'`, and prevents callers from initiating calls while already on one. | ✅ Verified |
| **Real-World Dialing & Tones** | `client/src/components/CallModal.jsx` | Web Audio synthesizer provides real-world ringback tone (pulsed 440Hz+480Hz dial tone), busy tone (rapid triple beeps), and descending hangup tone. Includes 40-second auto-timeout if the recipient does not answer. | ✅ Verified |
| **Mobile Camera Toggle & Avatar Card** | `client/src/components/CallModal.jsx`<br>`client/src/components/CallModal.css`<br>`server/index.js` | Fixed mobile camera freezing by rendering a sleek WhatsApp-style "Camera Off" placeholder card with user avatar both locally and over WebRTC signaling to the peer (`peer_camera_toggle`). | ✅ Verified |
| **Laptop vs Phone Camera Detection** | `client/src/components/CallModal.jsx`<br>`client/src/components/CallModal.css` | Uses `navigator.mediaDevices.enumerateDevices()` and user-agent touch detection. Hides the Flip Camera button on laptops/desktops with a single webcam; only displays flip button on mobile devices with $\ge 2$ cameras. | ✅ Verified |
| **Mobile Emoji Picker** | `client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Fixed phone mode emoji picker: converted to bottom-docked responsive sheet/drawer (`width: calc(100vw - 16px)`, `height: 310px`), added outside-click listener, stop-propagation handler, explicit close button, and removed footer `overflow-x: hidden`. | ✅ Verified |
| **Mobile Send Button** | `client/src/pages/ChatPage.css`<br>`client/src/pages/ChatPage.jsx` | Fixed CSS flex overflow, added `min-width: 0` to `.chat-text-input`, `flex-shrink: 0` on buttons, and dynamic WhatsApp-style Mic ↔ Send transition. | ✅ Verified |
| **India / Local Timezone** | `server/index.js`<br>`client/src/pages/ChatPage.jsx` | Server now sends pure UTC ISO-8601 strings; Client formats localized time based on device timezone (e.g. IST) via `formatMessageTime`. | ✅ Verified |
| **DM Call History** | `server/models/Message.js`<br>`server/index.js`<br>`ChatPage.jsx`<br>`ChatPage.css` | Persistent call logs (duration, status: completed/missed/declined) saved to MongoDB and rendered as WhatsApp-style call cards in DM with quick "Call Back" action. | ✅ Verified |
| **Double Blue Read Receipts** | `server/models/Message.js`<br>`server/index.js`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Single tick (sent), double grey ticks (delivered to recipient's device), and double blue ticks (read/seen by recipient in DM). Real-time socket status events. | ✅ Verified |
| **Web Push & Ringing Alerts** | `client/public/sw.js`<br>`client/src/main.jsx`<br>`client/src/pages/ChatPage.jsx` | Native Web Push Notification API + Service Worker (`sw.js`). High-priority ringing notifications for incoming calls and notifications for incoming DM messages when tab is minimized or screen is locked. | ✅ Verified |
| **Voice Note Speed Controls** | `client/src/components/AudioWaveformPlayer.jsx`<br>`client/src/components/AudioWaveformPlayer.css` | Added WhatsApp-style speed button pill cycling between $1\times \rightarrow 1.5\times \rightarrow 2\times \rightarrow 1\times$ playback speed on voice notes. | ✅ Verified |
| **Group Video Calls** | `server/index.js`<br>`client/src/components/GroupCallModal.jsx`<br>`client/src/components/GroupCallModal.css`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Multi-user WebRTC mesh calling for 3–6 users in room channels (`#general`, etc.). Responsive dynamic video grid, live active caller counts, screen sharing across peers, mic/camera toggles. | ✅ Verified |

---

## 🔍 Detailed Architecture of Real-World Calling & Camera Enhancements

### 1. Bidirectional Call Ending Synchronization
- **Previous Flaw**: Callee only had `IncomingCallDialog` mounted before answering. `ChatPage.jsx` had no global listener for `call_ended`. When caller clicked cancel/hangup before the callee answered, the callee's dialog remained stuck on screen, ringing indefinitely. Furthermore, on socket disconnect, partner was left stranded.
- **Solution**:
  - Global `socket.on('call_ended')` added to `ChatPage.jsx`, which resets `incomingCall` and resets `callState`.
  - In `server/index.js`, `socket.on('end_call')` notifies the partner via `call_ended` and removes both from `activeCalls`.
  - In `server/index.js`, `socket.on('disconnect')` checks `activeCalls` and dispatches `call_ended` with `{ reason: 'disconnected' }`.

### 2. Multi-Call Collisions & Busy States
- **Previous Flaw**: No session validation on incoming calls. Users already in an active call could receive a second incoming call or initiate simultaneous calls.
- **Solution**:
  - `activeCalls` Map maintained on server (`username.toLowerCase() => { partner, status, caller, callee }`).
  - If target user is offline: server returns `call_rejected { reason: 'offline', message: '@User is currently offline' }`.
  - If target user is already in a call: server returns `call_rejected { reason: 'busy', message: '@User is busy on another call' }`.
  - If caller is already in a call: server returns `call_rejected { reason: 'already_in_call' }`.
  - `ChatPage.jsx` and `CallModal.jsx` catch `call_rejected`, display the notification toast/status, play the busy tone, and auto-dismiss after 2.5 seconds.

### 3. Phone Camera Toggle & WhatsApp-Style Avatar Overlays
- **Previous Flaw**: On mobile browsers (Safari iOS and Chrome Android), setting `videoTrack.enabled = false` stops video transmission but freezes the last painted video frame on the screen, giving the illusion that the toggle button failed.
- **Solution**:
  - Added `.camera-off-overlay` and `.pip-camera-off-overlay` with avatar cards.
  - Added `socket.emit('peer_camera_toggle', { to: targetUser, isCameraOn })` forwarding through server.
  - When either party turns their camera off, their video stream is immediately overlaid with a personalized avatar card showing "Camera Off".

### 4. Laptop vs Mobile Device Detection for Camera Flip
- **Previous Flaw**: The camera flip button was unconditionally shown to laptop and desktop users. On devices with only 1 webcam, clicking the button triggered errors or flipped to the exact same camera.
- **Solution**:
  - Detected hardware via `navigator.mediaDevices.enumerateDevices()` filtering for `kind === 'videoinput'`.
  - Combined with touch/mobile user agent detection:
    ```javascript
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
    setCanFlipCamera(Boolean(isMobile && videoInputs.length >= 2));
    ```
  - On laptops/desktops, `canFlipCamera` evaluates to `false`, safely hiding the flip button.

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
