import React, { useEffect } from 'react';
import './IncomingCallDialog.css';
import { BsTelephoneFill, BsTelephoneXFill, BsCameraVideoFill } from 'react-icons/bs';

function IncomingCallDialog({ incomingCall, onAccept, onDecline }) {
  // Web Audio Synthesizer Ringtone
  useEffect(() => {
    let audioCtx = null;
    let ringInterval = null;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();

        const playChime = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, audioCtx.currentTime); // B4

          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(audioCtx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(audioCtx.currentTime + 1.2);
          osc2.stop(audioCtx.currentTime + 1.2);
        };

        playChime();
        ringInterval = setInterval(playChime, 2500);
      }
    } catch (e) {
      console.warn('Audio ringtone autoplay restricted:', e);
    }

    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, []);

  const callerName = incomingCall.callerFullName || incomingCall.from || 'User';
  const avatarUrl =
    incomingCall.callerAvatar ||
    `https://api.dicebear.com/8.x/adventurer/svg?seed=${incomingCall.from}`;

  const isVideo = incomingCall.callType !== 'audio';

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        {/* Pulsing Avatar Ring */}
        <div className="incoming-avatar-ring">
          <div className="ring-pulse" />
          <div className="ring-pulse delay" />
          <img src={avatarUrl} alt="caller" className="incoming-avatar-img" />
        </div>

        <div className="incoming-info">
          <h3 className="incoming-name">{callerName}</h3>
          <span className="incoming-sub">@{incomingCall.from} is calling you</span>
          <div className="incoming-type-pill">
            {isVideo ? <BsCameraVideoFill /> : <BsTelephoneFill />}
            <span>{isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="incoming-actions-row">
          <button
            type="button"
            className="call-act-btn decline"
            onClick={onDecline}
            title="Decline Call"
          >
            <BsTelephoneXFill />
          </button>

          <button
            type="button"
            className="call-act-btn accept"
            onClick={onAccept}
            title="Accept Call"
          >
            {isVideo ? <BsCameraVideoFill /> : <BsTelephoneFill />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallDialog;
