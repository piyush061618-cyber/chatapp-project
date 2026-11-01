import React, { useState, useEffect, useRef } from 'react';
import './CallModal.css';
import {
  BsCameraVideoFill,
  BsCameraVideoOffFill,
  BsMicFill,
  BsMicMuteFill,
  BsTelephoneXFill,
  BsVolumeUpFill,
  BsDisplay,
  BsArrowRepeat,
  BsArrowsAngleExpand,
  BsAspectRatio,
  BsTelephoneFill,
  BsArrowLeftRight,
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
  const { isCaller, targetUser, callType: initialCallType, signal } = callState;

  // Active call type can dynamically switch between 'video' and 'audio'
  const [activeCallType, setActiveCallType] = useState(initialCallType || 'video');
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(initialCallType !== 'audio');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [isSwapped, setIsSwapped] = useState(false); // WhatsApp style: swap PiP and Main stage
  const [pipSize, setPipSize] = useState('normal'); // 'normal' | 'expanded'
  const [fitMode, setFitMode] = useState('cover'); // 'cover' (fill) | 'contain' (fit letterbox)
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);

  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
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
    if (mainVideoRef.current) {
      mainVideoRef.current.play().catch(() => {});
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.play().catch(() => {});
    }
  };

  // Re-bind video element srcObject whenever feeds or swap mode changes
  const updateVideoBindings = () => {
    if (activeCallType !== 'video') return;

    const mainFeed = isSwapped ? localStreamRef.current : remoteStreamRef.current;
    const pipFeed = isSwapped ? remoteStreamRef.current : localStreamRef.current;

    if (mainVideoRef.current && mainFeed) {
      if (mainVideoRef.current.srcObject !== mainFeed) {
        mainVideoRef.current.srcObject = mainFeed;
      }
    }
    if (pipVideoRef.current && pipFeed) {
      if (pipVideoRef.current.srcObject !== pipFeed) {
        pipVideoRef.current.srcObject = pipFeed;
      }
    }
  };

  useEffect(() => {
    updateVideoBindings();
  }, [isSwapped, activeCallType, callConnected]);

  // Main WebRTC Initialization
  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: activeCallType !== 'audio' ? {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            } : false,
          });
        } catch (e) {
          console.warn('Strict getUserMedia failed, using generic constraints:', e);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: activeCallType !== 'audio',
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        const peer = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = peer;

        // Add local tracks to WebRTC peer
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // Always reserve video transceiver in sendrecv mode for seamless audio <-> video upgrade
        if (peer.addTransceiver) {
          const senders = peer.getSenders();
          const hasVideoSender = senders.some((s) => s.track && s.track.kind === 'video');
          if (!hasVideoSender) {
            peer.addTransceiver('video', { direction: 'sendrecv' });
          }
        }

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

          updateVideoBindings();
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
            updateVideoBindings();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            console.log('WebRTC connection state ended:', state);
          }
        };

        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
            setCallConnected(true);
            playRemoteMedia();
            updateVideoBindings();
          }
        };

        if (isCaller) {
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await peer.setLocalDescription(offer);

          socket.emit('call_user', {
            userToCall: targetUser,
            signalData: offer,
            callType: activeCallType,
          });
        } else if (signal) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          hasRemoteDescRef.current = true;
          await flushQueuedCandidates();

          const answer = await peer.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await peer.setLocalDescription(answer);

          socket.emit('answer_call', {
            to: targetUser,
            signal: answer,
          });
          setCallConnected(true);
        }

        updateVideoBindings();
      } catch (err) {
        console.error('Failed to initialize WebRTC call:', err);
      }
    }

    initWebRTC();

    // Socket signaling listeners
    const handleCallAccepted = async (data) => {
      if (peerRef.current && data.signal) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(data.signal)
          );
          hasRemoteDescRef.current = true;
          await flushQueuedCandidates();
          setCallConnected(true);
          updateVideoBindings();
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

    const handleCallTypeChange = (data) => {
      if (data && data.callType) {
        setActiveCallType(data.callType);
        if (data.callType === 'video') {
          setIsCameraOn(true);
        }
      }
    };

    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_type_change', handleCallTypeChange);

    return () => {
      isMounted = false;
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_type_change', handleCallTypeChange);
      cleanupStream();
    };
  }, []);

  // Timer when call is connected
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
    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop();
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
    // Notify peer and log call history
    socket.emit('end_call', { to: targetUser });
    socket.emit('log_call_event', {
      to: targetUser,
      callType: activeCallType,
      status: callConnected ? 'completed' : 'missed',
      duration: callDuration,
    });
    cleanupAndExit();
  };

  // Toggle Camera Mute/Unmute
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // Toggle Microphone Mute/Unmute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Mobile Camera Flip (Front ↔ Back)
  const flipCamera = async () => {
    if (isScreenSharing || !peerRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';

    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newFacing } },
        });
      } catch (err) {
        // Fallback without exact constraint if device has single camera
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Replace track on WebRTC sender
      const videoSender = peerRef.current.getSenders().find(
        (s) => (s.track && s.track.kind === 'video') || s.kind === 'video'
      );
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

      // Update local stream
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newVideoTrack);
      }

      setFacingMode(newFacing);
      updateVideoBindings();
    } catch (err) {
      console.warn('Could not flip camera:', err);
    }
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (!peerRef.current) return;

    if (isScreenSharing) {
      // Stop Screen Share and restore Camera
      if (cameraTrackRef.current) {
        const videoSender = peerRef.current.getSenders().find(
          (s) => (s.track && s.track.kind === 'video') || s.kind === 'video'
        );
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrackRef.current);
        }
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
          localStreamRef.current.addTrack(cameraTrackRef.current);
        }
        cameraTrackRef.current = null;
      }
      setIsScreenSharing(false);
      updateVideoBindings();
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Save active camera track
        if (localStreamRef.current) {
          const currentCamTrack = localStreamRef.current.getVideoTracks()[0];
          if (currentCamTrack) {
            cameraTrackRef.current = currentCamTrack;
          }
        }

        const videoSender = peerRef.current.getSenders().find(
          (s) => (s.track && s.track.kind === 'video') || s.kind === 'video'
        );
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        if (localStreamRef.current) {
          const oldTracks = localStreamRef.current.getVideoTracks();
          oldTracks.forEach((t) => localStreamRef.current.removeTrack(t));
          localStreamRef.current.addTrack(screenTrack);
        }

        setIsScreenSharing(true);
        updateVideoBindings();

        // Native stop sharing button handler
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn('Screen share cancelled or unsupported:', err);
      }
    }
  };

  // Dynamic Audio ↔ Video In-Call Switching
  const toggleAudioVideoMode = async () => {
    const newType = activeCallType === 'video' ? 'audio' : 'video';

    if (newType === 'video') {
      try {
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (!videoTrack) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
          });
          videoTrack = stream.getVideoTracks()[0];
          if (localStreamRef.current && videoTrack) {
            localStreamRef.current.addTrack(videoTrack);
          }
        } else {
          videoTrack.enabled = true;
        }

        const videoSender = peerRef.current?.getSenders().find(
          (s) => (s.track && s.track.kind === 'video') || s.kind === 'video'
        );
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }

        setIsCameraOn(true);
        setActiveCallType('video');
        socket.emit('call_type_change', { to: targetUser, callType: 'video' });
        updateVideoBindings();
      } catch (err) {
        console.warn('Failed to switch to video:', err);
      }
    } else {
      // Switch to Audio Only
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = false;
        }
      }
      setIsCameraOn(false);
      setActiveCallType('audio');
      socket.emit('call_type_change', { to: targetUser, callType: 'audio' });
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
            <>
              In call with @{targetUser} &bull;{' '}
              <span className="call-timer-text">{formatTimer(callDuration)}</span>
              <span className="call-mode-pill">{activeCallType === 'video' ? 'Video' : 'Voice'}</span>
            </>
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

      {/* Main Video / Audio Stage */}
      <div className="call-video-stage">
        {/* Remote Audio Track (Plays continuously, independent of video swap) */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
        />

        {activeCallType === 'video' ? (
          <div className="main-feed-container">
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              muted={isSwapped} // Mute if local feed is in main stage to avoid self-echo
              className={`main-video-feed ${fitMode === 'contain' ? 'contain-mode' : 'cover-mode'} ${
                isSwapped && !isScreenSharing ? 'mirrored' : ''
              }`}
            />
            {isSwapped && (
              <div className="main-feed-badge">
                You (Tap PiP to switch back)
              </div>
            )}
          </div>
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

        {/* WhatsApp-Style Adjustable & Swappable PiP Box */}
        {activeCallType === 'video' && (
          <div
            className={`local-pip-box ${pipSize === 'expanded' ? 'expanded' : ''} ${
              isSwapped ? 'swapped-view' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setIsSwapped((prev) => !prev);
            }}
            title="Tap to swap main and mini video feeds (WhatsApp style)"
          >
            <video
              ref={pipVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              muted={!isSwapped} // Local feed in PiP must be muted
              className={`local-pip-video ${
                !isSwapped && !isScreenSharing ? 'mirrored' : ''
              }`}
            />
            <div className="pip-header-bar">
              <span className="local-pip-label">
                {isSwapped ? `@${targetUser}` : 'You'}
              </span>
              <button
                type="button"
                className="pip-resize-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPipSize((s) => (s === 'normal' ? 'expanded' : 'normal'));
                }}
                title={pipSize === 'normal' ? 'Enlarge frame' : 'Compact frame'}
              >
                <BsArrowsAngleExpand />
              </button>
            </div>
            <span className="pip-tap-hint">
              <BsArrowLeftRight /> Tap to swap
            </span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="call-controls-bar">
        {/* Camera Toggle on/off */}
        {activeCallType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${!isCameraOn ? 'muted' : ''}`}
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraOn ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
          </button>
        )}

        {/* Flip Front/Back Camera (Mobile) */}
        {activeCallType === 'video' && !isScreenSharing && (
          <button
            type="button"
            className="ctrl-btn"
            onClick={flipCamera}
            title="Flip Camera (Front / Rear)"
          >
            <BsArrowRepeat />
          </button>
        )}

        {/* Screen Share */}
        {activeCallType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${isScreenSharing ? 'active-share' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <BsDisplay />
          </button>
        )}

        {/* Switch Audio ↔ Video Mode */}
        <button
          type="button"
          className="ctrl-btn switch-mode"
          onClick={toggleAudioVideoMode}
          title={
            activeCallType === 'video'
              ? 'Switch to Voice Call'
              : 'Switch to Video Call'
          }
        >
          {activeCallType === 'video' ? <BsTelephoneFill /> : <BsCameraVideoFill />}
        </button>

        {/* Fit Mode Toggle (Cover vs Contain) */}
        {activeCallType === 'video' && (
          <button
            type="button"
            className={`ctrl-btn ${fitMode === 'contain' ? 'active-toggle' : ''}`}
            onClick={() => setFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))}
            title={
              fitMode === 'cover'
                ? 'Fit Full Aspect Ratio (Contain)'
                : 'Fill Stage (Cover)'
            }
          >
            <BsAspectRatio />
          </button>
        )}

        {/* Mic Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${!isMicOn ? 'muted' : ''}`}
          onClick={toggleMic}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <BsMicFill /> : <BsMicMuteFill />}
        </button>

        {/* End Call */}
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
