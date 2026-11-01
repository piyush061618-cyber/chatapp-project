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

function CallModal({
  callState,
  socket,
  onEndCall,
  earlyIceCandidatesRef,
  currentUser,
  targetUserAvatar,
}) {
  const { isCaller, targetUser, callType: initialCallType, signal } = callState;

  // Active call type can dynamically switch between 'video' and 'audio'
  const [activeCallType, setActiveCallType] = useState(initialCallType || 'video');
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [callStatusNotice, setCallStatusNotice] = useState(null);

  // Camera states
  const [isCameraOn, setIsCameraOn] = useState(initialCallType !== 'audio');
  const [isPeerCameraOn, setIsPeerCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [canFlipCamera, setCanFlipCamera] = useState(false); // Only true on mobile with >= 2 cameras

  // Layout states
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
  const ringingTimeoutRef = useRef(null);

  // Web Audio Synthesizer for Phone Ringback, Busy, and Hangup tones
  const audioCtxRef = useRef(null);
  const dialIntervalRef = useRef(null);

  // WebRTC ICE Candidate queue to avoid race conditions
  const pendingCandidatesRef = useRef([]);
  const hasRemoteDescRef = useRef(false);

  const myUsername = currentUser?.username || 'You';
  const myAvatar =
    currentUser?.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${myUsername}`;
  const peerAvatar =
    targetUserAvatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${targetUser}`;

  // ==================== Audio Synthesizer ====================
  const getAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  };

  const startDialTone = () => {
    stopDialTone();
    const ctx = getAudioContext();
    if (!ctx) return;

    const playPulse = () => {
      try {
        if (!ctx || ctx.state === 'closed') return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.4);
        osc2.stop(now + 1.4);
      } catch (e) {}
    };

    playPulse();
    dialIntervalRef.current = setInterval(playPulse, 3200);
  };

  const stopDialTone = () => {
    if (dialIntervalRef.current) {
      clearInterval(dialIntervalRef.current);
      dialIntervalRef.current = null;
    }
  };

  const playBusyTone = () => {
    stopDialTone();
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.4, 0.8].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now + offset);
        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    } catch (e) {}
  };

  const playHangupTone = () => {
    stopDialTone();
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  };

  // ==================== Camera Capability Detection ====================
  // Detect whether the device is a mobile phone with >= 2 cameras (front + rear)
  // Laptop/Desktop webcams will NOT show the flip camera button!
  useEffect(() => {
    let isCancelled = false;

    const detectCameraCapabilities = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        const isMobile =
          /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);

        if (!isCancelled) {
          // Can flip only if mobile AND device has at least 2 cameras
          setCanFlipCamera(Boolean(isMobile && videoInputs.length >= 2));
        }
      } catch (e) {
        if (!isCancelled) setCanFlipCamera(false);
      }
    };

    detectCameraCapabilities();

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', detectCameraCapabilities);
      return () => {
        isCancelled = true;
        navigator.mediaDevices.removeEventListener('devicechange', detectCameraCapabilities);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  // ==================== WebRTC Candidate Queue ====================
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
      remoteAudioRef.current
        .play()
        .then(() => {
          setAudioAutoplayBlocked(false);
        })
        .catch((e) => {
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

  // ==================== Main WebRTC Lifecycle ====================
  useEffect(() => {
    let isMounted = true;

    // Start Dialing Ringback tone for caller
    if (isCaller) {
      startDialTone();
    }

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
            video:
              activeCallType !== 'audio'
                ? {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }
                : false,
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

          stopDialTone();
          setCallConnected(true);
          updateVideoBindings();
          playRemoteMedia();
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
            stopDialTone();
            setCallConnected(true);
            playRemoteMedia();
            updateVideoBindings();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            console.log('WebRTC connection state ended:', state);
          }
        };

        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
            stopDialTone();
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
          stopDialTone();
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
      stopDialTone();
      if (peerRef.current && data.signal) {
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
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

    const handleCallEnded = (data) => {
      stopDialTone();
      playHangupTone();
      setCallStatusNotice(
        data?.reason === 'disconnected' ? `@${targetUser} disconnected` : 'Call ended'
      );
      setTimeout(() => {
        cleanupAndExit();
      }, 1200);
    };

    const handleCallRejected = (data) => {
      stopDialTone();
      playBusyTone();
      const message =
        data?.message ||
        (data?.reason === 'busy' ? `@${targetUser} is on another call` : 'Call declined');
      setCallStatusNotice(message);
      setTimeout(() => {
        cleanupAndExit();
      }, 2500);
    };

    const handleCallTypeChange = (data) => {
      if (data && data.callType) {
        setActiveCallType(data.callType);
        if (data.callType === 'video') {
          setIsCameraOn(true);
        }
      }
    };

    const handlePeerCameraToggle = (data) => {
      if (data && typeof data.isCameraOn === 'boolean') {
        setIsPeerCameraOn(data.isCameraOn);
      }
    };

    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_type_change', handleCallTypeChange);
    socket.on('peer_camera_toggle', handlePeerCameraToggle);

    return () => {
      isMounted = false;
      stopDialTone();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_type_change', handleCallTypeChange);
      socket.off('peer_camera_toggle', handlePeerCameraToggle);
      cleanupStream();
    };
  }, []);

  // 40-second Ringing Timeout for Outgoing Calls
  useEffect(() => {
    if (!isCaller || callConnected) {
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      return;
    }

    ringingTimeoutRef.current = setTimeout(() => {
      stopDialTone();
      playHangupTone();
      setCallStatusNotice('No answer');
      socket.emit('end_call', { to: targetUser });
      socket.emit('log_call_event', {
        to: targetUser,
        callType: activeCallType,
        status: 'missed',
        duration: 0,
      });
      setTimeout(() => {
        cleanupAndExit();
      }, 2000);
    }, 40000);

    return () => {
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    };
  }, [isCaller, callConnected]);

  // Call duration counter once connected
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
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    stopDialTone();
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
    playHangupTone();
    socket.emit('end_call', { to: targetUser });
    socket.emit('log_call_event', {
      to: targetUser,
      callType: activeCallType,
      status: callConnected ? 'completed' : 'missed',
      duration: callDuration,
    });
    cleanupAndExit();
  };

  // Toggle Camera on phone & desktop with real-time peer notification
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsCameraOn(nextState);
        socket.emit('peer_camera_toggle', { to: targetUser, isCameraOn: nextState });
      } else if (!isCameraOn) {
        toggleAudioVideoMode();
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
    if (isScreenSharing || !peerRef.current || !canFlipCamera) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';

    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newFacing } },
        });
      } catch (err) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const videoSender = peerRef.current
        .getSenders()
        .find((s) => (s.track && s.track.kind === 'video') || s.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

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
      if (cameraTrackRef.current) {
        const videoSender = peerRef.current
          .getSenders()
          .find((s) => (s.track && s.track.kind === 'video') || s.kind === 'video');
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
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        if (localStreamRef.current) {
          const currentCamTrack = localStreamRef.current.getVideoTracks()[0];
          if (currentCamTrack) {
            cameraTrackRef.current = currentCamTrack;
          }
        }

        const videoSender = peerRef.current
          .getSenders()
          .find((s) => (s.track && s.track.kind === 'video') || s.kind === 'video');
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
        socket.emit('peer_camera_toggle', { to: targetUser, isCameraOn: true });
        updateVideoBindings();
      } catch (err) {
        console.warn('Failed to switch to video:', err);
      }
    } else {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = false;
        }
      }
      setIsCameraOn(false);
      setActiveCallType('audio');
      socket.emit('call_type_change', { to: targetUser, callType: 'audio' });
      socket.emit('peer_camera_toggle', { to: targetUser, isCameraOn: false });
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // Determine whether the main video and pip video should show the camera-off avatar
  const isMainCameraOff = isSwapped ? !isCameraOn : !isPeerCameraOn;
  const isPipCameraOff = isSwapped ? !isPeerCameraOn : !isCameraOn;
  const mainAvatar = isSwapped ? myAvatar : peerAvatar;
  const mainLabel = isSwapped ? 'Your camera is off' : `@${targetUser}'s camera is off`;
  const pipAvatar = isSwapped ? peerAvatar : myAvatar;
  const pipLabel = isSwapped ? `@${targetUser}` : 'You';

  return (
    <div className="call-modal-overlay" onClick={playRemoteMedia}>
      {/* Top Status Banner */}
      <div className="call-header-status">
        <span className={`call-live-dot ${callStatusNotice ? 'alert' : ''}`} />
        <span>
          {callStatusNotice ? (
            <span className="status-notice-text">{callStatusNotice}</span>
          ) : callConnected ? (
            <>
              In call with @{targetUser} &bull;{' '}
              <span className="call-timer-text">{formatTimer(callDuration)}</span>
              <span className="call-mode-pill">
                {activeCallType === 'video' ? 'Video' : 'Voice'}
              </span>
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
        <audio ref={remoteAudioRef} autoPlay playsInline webkit-playsinline="true" />

        {activeCallType === 'video' ? (
          <div className="main-feed-container">
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              muted={isSwapped} // Mute if local feed is in main stage to avoid self-echo
              className={`main-video-feed ${
                fitMode === 'contain' ? 'contain-mode' : 'cover-mode'
              } ${isSwapped && !isScreenSharing ? 'mirrored' : ''}`}
            />

            {/* Camera Off Placeholder Overlay for Main Stage */}
            {isMainCameraOff && (
              <div className="camera-off-overlay">
                <img src={mainAvatar} alt="Camera Off" className="camera-off-avatar" />
                <div className="camera-off-text">{mainLabel}</div>
              </div>
            )}

            {isSwapped && (
              <div className="main-feed-badge">You (Tap PiP to switch back)</div>
            )}
          </div>
        ) : (
          <div className="audio-call-stage">
            <img src={peerAvatar} alt={targetUser} className="audio-stage-avatar" />
            <div className="audio-stage-name">@{targetUser}</div>
            <div className="audio-stage-status">
              {callStatusNotice
                ? callStatusNotice
                : callConnected
                ? 'Connected • Voice Call'
                : 'Calling...'}
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

            {/* Camera Off Placeholder Overlay for PiP Box */}
            {isPipCameraOff && (
              <div className="pip-camera-off-overlay">
                <img src={pipAvatar} alt="Camera Off" className="pip-camera-off-avatar" />
                <span className="pip-camera-off-text">Camera Off</span>
              </div>
            )}

            <div className="pip-header-bar">
              <span className="local-pip-label">{pipLabel}</span>
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

        {/* Flip Front/Back Camera (Mobile Only: hidden on laptops/desktops with 1 webcam) */}
        {activeCallType === 'video' && !isScreenSharing && canFlipCamera && (
          <button
            type="button"
            className="ctrl-btn flip-btn"
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
            activeCallType === 'video' ? 'Switch to Voice Call' : 'Switch to Video Call'
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