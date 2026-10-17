import React, { useState, useEffect, useRef } from 'react';
import './CallModal.css';
import {
  BsCameraVideoFill,
  BsCameraVideoOffFill,
  BsMicFill,
  BsMicMuteFill,
  BsTelephoneXFill,
  BsVolumeUpFill,
} from 'react-icons/bs';

const ICE_SERVERS = {
  iceServers: [
    // Standard Google STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },

    // Free OpenRelay TURN servers by Metered for mobile carrier (4G/5G) NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

function CallModal({ callState, socket, onEndCall, earlyIceCandidatesRef }) {
  const { isCaller, targetUser, callType, signal } = callState;

  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(callType !== 'audio');
  const [isMicOn, setIsMicOn] = useState(true);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerRef = useRef(null);
  const timerRef = useRef(null);

  // WebRTC ICE Candidate queue to avoid race conditions
  const pendingCandidatesRef = useRef([]);
  const hasRemoteDescRef = useRef(false);

  const addCandidateSafely = async (candidate) => {
    if (!peerRef.current) return;
    if (!hasRemoteDescRef.current || !peerRef.current.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  };

  const flushQueuedCandidates = async () => {
    if (!peerRef.current || !peerRef.current.remoteDescription) return;

    // 1. First add any candidates that arrived while the call was ringing in ChatPage
    if (earlyIceCandidatesRef && earlyIceCandidatesRef.current) {
      while (earlyIceCandidatesRef.current.length > 0) {
        const candidate = earlyIceCandidatesRef.current.shift();
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error flushing early candidate:', err);
        }
      }
    }

    // 2. Add candidates queued inside this modal
    while (pendingCandidatesRef.current.length > 0) {
      const candidate = pendingCandidatesRef.current.shift();
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Error flushing modal candidate:', err);
      }
    }
  };

  const playRemoteMedia = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().then(() => {
        setAudioAutoplayBlocked(false);
      }).catch((e) => {
        console.warn('Mobile audio autoplay blocked:', e);
        setAudioAutoplayBlocked(true);
      });
    }
    if (remoteVideoRef.current && callType !== 'audio') {
      remoteVideoRef.current.play().catch((e) => console.warn('Mobile video autoplay blocked:', e));
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        // Request media with flexible fallback for mobile camera drivers
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: callType !== 'audio' ? {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            } : false,
          });
        } catch (e) {
          console.warn('Strict getUserMedia failed, using generic constraints:', e);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType !== 'audio',
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && callType !== 'audio') {
          localVideoRef.current.srcObject = stream;
        }

        const peer = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = peer;

        // Add local tracks to WebRTC peer
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // When remote stream tracks arrive
        peer.ontrack = (event) => {
          let remoteStream = event.streams && event.streams[0];
          if (!remoteStream) {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = new MediaStream();
            }
            remoteStreamRef.current.addTrack(event.track);
            remoteStream = remoteStreamRef.current;
          } else {
            remoteStreamRef.current = remoteStream;
          }

          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          if (remoteVideoRef.current && callType !== 'audio') {
            remoteVideoRef.current.srcObject = remoteStream;
          }

          playRemoteMedia();
          setCallConnected(true);
        };

        // Emit local ICE candidates
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice_candidate', {
              to: targetUser,
              candidate: event.candidate,
            });
          }
        };

        // Connection state monitoring
        peer.onconnectionstatechange = () => {
          const state = peer.connectionState;
          if (state === 'connected') {
            setCallConnected(true);
            playRemoteMedia();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            console.log('WebRTC connection state ended:', state);
          }
        };

        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
            setCallConnected(true);
            playRemoteMedia();
          }
        };

        if (isCaller) {
          // Caller generates SDP Offer
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType !== 'audio',
          });
          await peer.setLocalDescription(offer);

          socket.emit('call_user', {
            userToCall: targetUser,
            signalData: offer,
            callType,
          });
        } else if (signal) {
          // Callee accepts Offer and generates SDP Answer
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          hasRemoteDescRef.current = true;
          await flushQueuedCandidates();

          const answer = await peer.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType !== 'audio',
          });
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

    // Socket listeners for signaling progression
    const handleCallAccepted = async (data) => {
      if (peerRef.current && data.signal) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(data.signal)
          );
          hasRemoteDescRef.current = true;
          await flushQueuedCandidates();
          setCallConnected(true);
        } catch (e) {
          console.error('Error setting remote description:', e);
        }
      }
    };

    const handleIceCandidate = async (data) => {
      if (data.candidate) {
        await addCandidateSafely(data.candidate);
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

  // Ensure remote streams are bound whenever call connects or stage renders
  useEffect(() => {
    if (remoteStreamRef.current) {
      if (remoteVideoRef.current && callType !== 'audio') {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      playRemoteMedia();
    }
  }, [callConnected, callType]);

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
    <div className="call-modal-overlay" onClick={playRemoteMedia}>
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

      {/* Autoplay Unlock Button for Mobile Browsers */}
      {audioAutoplayBlocked && (
        <button
          type="button"
          className="audio-unlock-btn"
          onClick={(e) => {
            e.stopPropagation();
            playRemoteMedia();
          }}
        >
          <BsVolumeUpFill /> Tap to Unmute Audio
        </button>
      )}

      {/* Main Remote Video or Audio Avatar */}
      <div className="call-video-stage">
        {/* Permanent Unmuted Remote Audio Output */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
        />

        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
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
              {callConnected ? 'Connected • Voice Call' : 'Ringing...'}
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
              webkit-playsinline="true"
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
