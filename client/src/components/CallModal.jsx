import React, { useState, useEffect, useRef } from 'react';
import './CallModal.css';
import {
  BsCameraVideoFill,
  BsCameraVideoOffFill,
  BsMicFill,
  BsMicMuteFill,
  BsTelephoneXFill,
} from 'react-icons/bs';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function CallModal({ callState, socket, onEndCall }) {
  const { isCaller, targetUser, callType, signal } = callState;

  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(callType !== 'audio');
  const [isMicOn, setIsMicOn] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType !== 'audio',
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peer = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = peer;

        // Add local tracks to peer
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // When remote stream arrives
        peer.ontrack = (event) => {
          const stream = event.streams[0];
          if (remoteAudioRef.current && stream) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch((err) => console.warn('Audio auto-play prevented:', err));
          }
          if (remoteVideoRef.current && stream) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.play().catch((err) => console.warn('Video auto-play prevented:', err));
          }
          setCallConnected(true);
        };

        // When ICE candidates generated
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice_candidate', {
              to: targetUser,
              candidate: event.candidate,
            });
          }
        };

        if (isCaller) {
          // Caller generates SDP Offer
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);

          socket.emit('call_user', {
            userToCall: targetUser,
            signalData: offer,
            callType,
          });
        } else if (signal) {
          // Callee accepts Offer and generates SDP Answer
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socket.emit('answer_call', {
            to: targetUser,
            signal: answer,
          });
          setCallConnected(true);
        }
      } catch (err) {
        console.error('Failed to initialize WebRTC call:', err);
      }
    }

    initWebRTC();

    // Socket listeners for call progression
    const handleCallAccepted = async (data) => {
      if (peerRef.current && data.signal) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(data.signal)
          );
          setCallConnected(true);
        } catch (e) {
          console.error('Error setting remote description:', e);
        }
      }
    };

    const handleIceCandidate = async (data) => {
      if (peerRef.current && data.candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    };

    const handleCallEnded = () => {
      cleanupAndExit();
    };

    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);

    return () => {
      isMounted = false;
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      cleanupStream();
    };
  }, []);

  // Timer when call connected
  useEffect(() => {
    if (callConnected) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callConnected]);

  const cleanupStream = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
  };

  const cleanupAndExit = () => {
    cleanupStream();
    onEndCall();
  };

  const handleHangUp = () => {
    socket.emit('end_call', { to: targetUser });
    cleanupAndExit();
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="call-modal-overlay">
      {/* Top Status Banner */}
      <div className="call-header-status">
        <span className="call-live-dot" />
        <span>
          {callConnected ? (
            <>In call with @{targetUser} &bull; <span className="call-timer-text">{formatTimer(callDuration)}</span></>
          ) : (
            <>Calling @{targetUser}...</>
          )}
        </span>
      </div>

      {/* Main Remote Video or Audio Avatar */}
      <div className="call-video-stage">
        {/* Permanent Unmuted Remote Audio Output */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video-feed"
          />
        ) : (
          <div className="audio-call-stage">
            <img
              src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${targetUser}`}
              alt={targetUser}
              className="audio-stage-avatar"
            />
            <div className="audio-stage-name">@{targetUser}</div>
            <div className="audio-stage-status">
              {callConnected ? 'Connected &bull; Voice Call' : 'Ringing...'}
            </div>
          </div>
        )}

        {/* Local Camera PiP Window */}
        {callType === 'video' && (
          <div className="local-pip-box">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-pip-video"
            />
            <span className="local-pip-label">You</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="call-controls-bar">
        {callType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${!isCameraOn ? 'muted' : ''}`}
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraOn ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
          </button>
        )}

        <button
          type="button"
          className={`ctrl-btn ${!isMicOn ? 'muted' : ''}`}
          onClick={toggleMic}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <BsMicFill /> : <BsMicMuteFill />}
        </button>

        <button
          type="button"
          className="ctrl-btn hangup"
          onClick={handleHangUp}
          title="End Call"
        >
          <BsTelephoneXFill />
        </button>
      </div>
    </div>
  );
}

export default CallModal;
