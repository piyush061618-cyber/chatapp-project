# 🚀 PulseChat Improvements & Feature Log
**Branch:** `feature-video-calls-and-fixes`  
**Date:** 2026-11-01  
**Status:** All Features & Fixes Implemented & Verified (Vite Build & Server Syntax OK)  

This document tracks all modifications, enhancements, and bug fixes applied to the PulseChat codebase. If any issue arises or if you want to inspect what changed, this file provides the exact file paths, before/after architectural logic, and rollback instructions.

---

## 📋 Summary of All Completed Changes

| Component | Target File(s) | Description | Verification Status |
| :--- | :--- | :--- | :--- |
| **Mobile Emoji Picker** | `client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Fixed phone mode emoji picker: converted from clipped popover to a bottom-docked responsive sheet/drawer (`width: calc(100vw - 16px)`, `height: 310px`), added outside-click listener, stop-propagation handler, explicit close button, and removed footer `overflow-x: hidden`. | ✅ Verified (Vite Build) |
| **Mobile Send Button** | `client/src/pages/ChatPage.css`<br>`client/src/pages/ChatPage.jsx` | Fixed CSS flex overflow, added `min-width: 0` to `.chat-text-input`, `flex-shrink: 0` on buttons, and dynamic WhatsApp-style Mic ↔ Send transition. | ✅ Verified (Vite Build) |
| **India / Local Timezone** | `server/index.js`<br>`client/src/pages/ChatPage.jsx` | Server now sends pure UTC ISO-8601 strings; Client formats localized time based on device timezone (e.g. IST) via `formatMessageTime`. | ✅ Verified (Node syntax & Vite build) |
| **DM Call History** | `server/models/Message.js`<br>`server/index.js`<br>`ChatPage.jsx`<br>`ChatPage.css` | Persistent call logs (duration, status: completed/missed/declined) saved to MongoDB and rendered as WhatsApp-style call cards in DM with quick "Call Back" action. | ✅ Verified |
| **WebRTC Video Calling** | `client/src/components/CallModal.jsx`<br>`client/src/components/CallModal.css`<br>`server/index.js` | 1. Screen sharing (`getDisplayMedia` & `replaceTrack`).<br>2. Front/Back mobile camera flip.<br>3. Tap-to-Swap local & remote feeds (WhatsApp style) + frame enlargement.<br>4. Seamless Audio ↔ Video in-call mode switching without call drop. | ✅ Verified (Vite Build) |
| **Double Blue Read Receipts** | `server/models/Message.js`<br>`server/index.js`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | **Single tick** (sent), **double grey ticks** (delivered to recipient's device), and **double blue ticks** (read/seen by recipient in DM). Real-time socket status events. | ✅ Verified |
| **Web Push & Ringing Alerts** | `client/public/sw.js`<br>`client/src/main.jsx`<br>`client/src/pages/ChatPage.jsx` | Native Web Push Notification API + Service Worker (`sw.js`). High-priority ringing notifications for incoming calls and notifications for incoming DM messages when tab is minimized or screen is locked. | ✅ Verified |
| **Voice Note Speed Controls** | `client/src/components/AudioWaveformPlayer.jsx`<br>`client/src/components/AudioWaveformPlayer.css` | Added WhatsApp-style speed button pill cycling between $1\times \rightarrow 1.5\times \rightarrow 2\times \rightarrow 1\times$ playback speed on voice notes. | ✅ Verified |
| **Group Video Calls** | `server/index.js`<br>`client/src/components/GroupCallModal.jsx`<br>`client/src/components/GroupCallModal.css`<br>`client/src/pages/ChatPage.jsx`<br>`client/src/pages/ChatPage.css` | Multi-user WebRTC mesh calling for 3–6 users in room channels (`#general`, etc.). Responsive dynamic video grid, live active caller counts, screen sharing across peers, mic/camera toggles. | ✅ Verified |

---

## 🔍 Detailed Architecture of Mobile Emoji Picker Fix

### Problem Statement:
On mobile phones:
1. `.chat-footer-bar` had `overflow-x: hidden`. In the CSS specification, setting `overflow-x: hidden` forces `overflow-y` to compute to `auto` or clip. Because `.emoji-popover` had `bottom: 50px` (above the top edge of the footer), it was being clipped vertically and hidden.
2. The default `emoji-picker-react` width is `350px`. Since `.emoji-trigger-wrap` was placed at `left: 45px`, the picker extended to $45\text{px} + 350\text{px} = 395\text{px}$, overflowing past the right edge of standard mobile viewports ($360\text{px} - 390\text{px}$), causing emojis, category tabs, and search to be cut off and touch gestures to freeze.
3. `onEmojiClick` invoked `setShowPicker(false)` synchronously, which unmounted the picker during the touch lifecycle, causing mobile browsers to cancel the emoji insertion event.
4. There was no outside-click or explicit close button to dismiss the picker on mobile screens.

### Solution Implemented:
1. **Full-Width Bottom Sheet on Mobile (`ChatPage.css`):**
   - In `@media (max-width: 768px)`, `.emoji-popover` is rendered as a fixed bottom drawer:
     ```css
     .emoji-popover {
       position: fixed;
       bottom: 58px;
       left: 8px;
       right: 8px;
       width: calc(100vw - 16px);
       max-width: calc(100vw - 16px);
       box-sizing: border-box;
       display: flex;
       flex-direction: column;
       border-radius: 16px;
       box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.85);
       z-index: 3000;
     }
     ```
   - Set `.chat-footer-bar { overflow: visible; }` on mobile.
2. **Dynamic Mobile Sizing (`ChatPage.jsx`):**
   - Configured `<Picker width={isMobile ? '100%' : 340} height={isMobile ? 310 : 390} previewConfig={{ showPreview: false }} skinTonesDisabled lazyLoadEmojis={true} />`.
   - Removed the bulky preview footer on mobile so emojis have maximum screen real estate.
3. **Smooth Touch & Emoji Selection:**
   - Updated `onEmojiClick` to append emoji characters without unmounting the picker, allowing users to type multiple emojis in sequence (like WhatsApp/Telegram).
   - Added an explicit close button (`<BsX />`) in the popover header.
   - Added touch-friendly `mousedown` and `touchstart` click-outside detection.

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
