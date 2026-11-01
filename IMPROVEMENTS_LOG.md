# 🚀 PulseChat Improvements & Feature Log
**Branch:** `feature-video-calls-and-fixes`  
**Date:** 2026-11-01  
**Status:** Implemented & Verified (Build Succeeded)  

This document tracks all modifications, enhancements, and bug fixes applied to the PulseChat codebase. If any issue arises or if you want to inspect what changed, this file provides the exact file paths, before/after architectural logic, and rollback instructions.

---

## 📋 Summary of Changes

| Component | Target File(s) | Description | Verification Status |
| :--- | :--- | :--- | :--- |
| **Mobile Send Button** | `client/src/pages/ChatPage.css`<br>`client/src/pages/ChatPage.jsx` | Fixed CSS flex overflow, added `min-width: 0` to `.chat-text-input`, `flex-shrink: 0` on buttons, and dynamic WhatsApp-style Mic ↔ Send transition. | ✅ Verified (Vite Build) |
| **India / Local Timezone** | `server/index.js`<br>`client/src/pages/ChatPage.jsx` | Server now sends pure UTC ISO-8601 strings; Client formats localized time based on device timezone (e.g. IST) via `formatMessageTime`. | ✅ Verified (Node syntax & Vite build) |
| **DM Call History** | `server/models/Message.js`<br>`server/index.js`<br>`ChatPage.jsx`<br>`ChatPage.css` | Persistent call logs (duration, status: completed/missed/declined) saved to MongoDB and rendered as WhatsApp-style call cards in DM with quick "Call Back" action. | ✅ Verified |
| **WebRTC Video Calling** | `client/src/components/CallModal.jsx`<br>`client/src/components/CallModal.css`<br>`server/index.js` | 1. Screen sharing (`getDisplayMedia` & `replaceTrack`).<br>2. Front/Back mobile camera flip.<br>3. Tap-to-Swap local & remote feeds (WhatsApp style) + frame enlargement.<br>4. Seamless Audio ↔ Video in-call mode switching without call drop. | ✅ Verified (Vite Build) |

---

## 🔍 Detailed Change Log

### 1. Mobile Send Button Visibility
- **File:** [`client/src/pages/ChatPage.css`](file:///c:/Users/piyus/Desktop/chat-app/client/src/pages/ChatPage.css) & [`client/src/pages/ChatPage.jsx`](file:///c:/Users/piyus/Desktop/chat-app/client/src/pages/ChatPage.jsx)
- **Problem:**
  On mobile devices ($< 400\text{px}$), `.chat-text-input` did not have `min-width: 0`. Since flex items default to `min-width: auto`, the input plus emoji, attachment, mic, and send buttons exceeded the viewport width, pushing the Send button off-screen.
- **Solution:**
  - Added `min-width: 0; flex: 1 1 auto;` to `.chat-text-input`.
  - Added `flex-shrink: 0;` to `.send-message-btn`, `.action-btn.mic-btn`, `.attachment-trigger-btn`, and `.emoji-toggle-btn`.
  - Implemented the standard **WhatsApp mobile pattern**: When the message input is empty and no file is staged, the **Voice Recorder Mic button** is shown; the moment the user types or stages a file, it seamlessly swaps to the **Send button** (`IoSend`).
  - Added mobile media queries guaranteeing touch targets and zero horizontal overflow.

### 2. Timezone Correction (India Standard Time & Global)
- **File:** [`server/index.js`](file:///c:/Users/piyus/Desktop/chat-app/server/index.js) & [`client/src/pages/ChatPage.jsx`](file:///c:/Users/piyus/Desktop/chat-app/client/src/pages/ChatPage.jsx)
- **Problem:**
  The server formatted timestamps using `new Date(msg.timestamp).toLocaleTimeString(...)` inside Node.js. In production/cloud/Docker environments running in UTC, this evaluated to UTC time (e.g. `02:30 PM`), broadcasting a stale UTC string to Indian users whose local time is 5 hours and 30 minutes ahead (`08:00 PM`).
- **Solution:**
  - Server now normalizes and transmits clean ISO 8601 UTC strings:
    ```javascript
    timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
    ```
  - Added a client-side device timezone formatter `formatMessageTime(msg.timestamp || msg.time)` in `ChatPage.jsx`:
    ```javascript
    const formatMessageTime = (dateInput) => {
      if (!dateInput) return '';
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    ```
  - Now, users in India see exact IST time (`08:35 PM`), and users in other timezones automatically see their respective local device times.

### 3. DM Call History Logs
- **Files:**
  - Model: [`server/models/Message.js`](file:///c:/Users/piyus/Desktop/chat-app/server/models/Message.js)
  - Signaling: [`server/index.js`](file:///c:/Users/piyus/Desktop/chat-app/server/index.js)
  - UI Component: [`client/src/pages/ChatPage.jsx`](file:///c:/Users/piyus/Desktop/chat-app/client/src/pages/ChatPage.jsx)
  - Styles: [`client/src/pages/ChatPage.css`](file:///c:/Users/piyus/Desktop/chat-app/client/src/pages/ChatPage.css)
- **Solution:**
  - Added `callLog` sub-schema in `Message.js` (`callType`, `status`, `duration`, `caller`, `receiver`) and `messageType: { type: String, enum: ['text', 'call'] }`.
  - Added socket event `log_call_event` in `server/index.js` to persist completed, missed, or declined calls in the DM room (`dm__userA__userB`).
  - Added call cards in `ChatPage.jsx`:
    - Shows incoming/outgoing status, video/audio icon, call duration (e.g. `2m 45s`), and local timestamp.
    - Includes an instant **"Call Back"** button to restart a call directly from the chat log.
    - Styled with status borders: Emerald green for completed, Red for missed/cancelled, Amber for declined.

### 4. Advanced WebRTC Video Call Features
- **Files:** [`client/src/components/CallModal.jsx`](file:///c:/Users/piyus/Desktop/chat-app/client/src/components/CallModal.jsx) & [`client/src/components/CallModal.css`](file:///c:/Users/piyus/Desktop/chat-app/client/src/components/CallModal.css)
- **Features Implemented:**
  1. **Camera Toggle & Dual-Camera Flip:**
     - Video Mute/Unmute toggle.
     - Mobile Camera Flip (`flipCamera`): switches between `'user'` (front) and `'environment'` (rear) cameras, replacing the track on the WebRTC RTCRtpSender.
  2. **Screen Sharing:**
     - Toggle screen sharing via `navigator.mediaDevices.getDisplayMedia`.
     - Automatically replaces video track on the active peer connection (`videoSender.replaceTrack(screenTrack)`).
     - Handles `screenTrack.onended` to restore the camera feed when sharing is stopped from the browser UI or toolbar.
  3. **WhatsApp-Style PiP Tap-to-Swap & Frame Enlargement:**
     - Clicking or tapping the small PiP box swaps the feeds: your own camera feed takes over the main stage so you can inspect your video in full screen, while the remote feed transitions to the PiP box.
     - Includes a resize button to expand the PiP frame from compact to enlarged (`pipSize: 'normal' | 'expanded'`).
     - Added Fit toggle (`BsAspectRatio`): switch between `cover` (fills entire viewport) and `contain` (shows complete uncropped camera aspect ratio).
  4. **Dynamic Audio ↔ Video In-Call Mode Switching:**
     - Seamlessly transition from Voice Call to Video Call or Video Call to Voice Call during an active call using live signaling (`call_type_change`) without disconnecting.

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
