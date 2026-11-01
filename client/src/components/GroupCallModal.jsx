import React, { useState, useEffect, useRef } from 'react';
import './GroupCallModal.css';
import {
  BsCameraVideoFill,
  BsCameraVideoOffFill,
  BsMicFill,
  BsMicMuteFill,
  BsTelephoneXFill,
  BsDisplay,
  BsPeopleFill,
} from 'react-icons/bs';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

function GroupCallModal({ room, username, socket, onLeave }) {
  const [callDuration, setCallDuration] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeers, setRemotePeers] = useState({}); // socketId -> { username, avatar, stream }

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const peersRef = useRef({}); // socketId -> { peer, pendingIce }
  const timerRef = useRef(null);

  // Helper to attach local video
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current]);

  // Call timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Initialize Media and Mesh WebRTC
  useEffect(() => {
    let isMounted = true;

    async function initGroupCall() {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
          });
        } catch (e) {
          console.warn('Strict getUserMedia failed for group call, using fallback:', e);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join room channel call
        socket.emit('join_channel_call', { room });
      } catch (err) {
        console.error('Failed to access media for group call:', err);
      }
    }

    initGroupCall();

    const createPeerConnection = (targetSocketId, targetUsername, isInitiator) => {
      const peer = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[targetSocketId] = { peer, pendingIce: [], username: targetUsername };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peer.addTrack(track, localStreamRef.current);
        });
      }

      peer.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        setRemotePeers((prev) => ({
          ...prev,
          [targetSocketId]: {
            username: targetUsername,
            stream: remoteStream,
          },
        }));
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('channel_call_ice', {
            toSocketId: targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      return peer;
    };

    // When joining, receive list of existing peers to initiate offers to
    const handleJoined = async ({ existingParticipants }) => {
      if (!existingParticipants || !localStreamRef.current) return;

      for (const p of existingParticipants) {
        const peer = createPeerConnection(p.socketId, p.username, true);
        try {
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await peer.setLocalDescription(offer);
          socket.emit('channel_call_signal', {
            toSocketId: p.socketId,
            signal: offer,
          });
        } catch (e) {
          console.error('Error creating offer for group peer:', e);
        }
      }
    };

    // When another peer joins after us
    const handlePeerJoined = ({ socketId, username: peerName }) => {
      // Peer will send us an offer
      setRemotePeers((prev) => ({
        ...prev,
        [socketId]: { username: peerName, stream: null },
      }));
    };

    // Handle signaling (Offer or Answer)
    const handleSignal = async ({ fromSocketId, fromUsername, signal }) => {
      if (signal.type === 'offer') {
        const peer = createPeerConnection(fromSocketId, fromUsername, false);
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));

          // Flush queued ICE
          const peerObj = peersRef.current[fromSocketId];
          if (peerObj && peerObj.pendingIce) {
            while (peerObj.pendingIce.length > 0) {
              const c = peerObj.pendingIce.shift();
              await peer.addIceCandidate(new RTCIceCandidate(c));
            }
          }

          const answer = await peer.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await peer.setLocalDescription(answer);

          socket.emit('channel_call_signal', {
            toSocketId: fromSocketId,
            signal: answer,
          });
        } catch (err) {
          console.error('Error handling offer in group call:', err);
        }
      } else if (signal.type === 'answer') {
        const peerObj = peersRef.current[fromSocketId];
        if (peerObj && peerObj.peer) {
          try {
            await peerObj.peer.setRemoteDescription(new RTCSessionDescription(signal));
            while (peerObj.pendingIce.length > 0) {
              const c = peerObj.pendingIce.shift();
              await peerObj.peer.addIceCandidate(new RTCIceCandidate(c));
            }
          } catch (e) {
            console.error('Error setting remote answer:', e);
          }
        }
      }
    };

    // Handle incoming ICE Candidate
    const handleIce = async ({ fromSocketId, candidate }) => {
      const peerObj = peersRef.current[fromSocketId];
      if (!peerObj) return;

      if (!peerObj.peer.remoteDescription) {
        peerObj.pendingIce.push(candidate);
      } else {
        try {
          await peerObj.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding group ICE candidate:', e);
        }
      }
    };

    // Handle peer leaving
    const handlePeerLeft = ({ socketId }) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].peer.close();
        delete peersRef.current[socketId];
      }
      setRemotePeers((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    };

    socket.on('channel_call_joined', handleJoined);
    socket.on('channel_call_peer_joined', handlePeerJoined);
    socket.on('channel_call_signal', handleSignal);
    socket.on('channel_call_ice', handleIce);
    socket.on('channel_call_peer_left', handlePeerLeft);

    return () => {
      isMounted = false;
      socket.off('channel_call_joined', handleJoined);
      socket.off('channel_call_peer_joined', handlePeerJoined);
      socket.off('channel_call_signal', handleSignal);
      socket.off('channel_call_ice', handleIce);
      socket.off('channel_call_peer_left', handlePeerLeft);

      // Cleanup tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (cameraTrackRef.current) {
        cameraTrackRef.current.stop();
      }
      Object.values(peersRef.current).forEach((p) => {
        if (p.peer) p.peer.close();
      });
    };
  }, [room]);

  const handleLeaveCall = () => {
    socket.emit('leave_channel_call', { room });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop();
    }
    Object.values(peersRef.current).forEach((p) => {
      if (p.peer) p.peer.close();
    });
    onLeave();
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const vTrack = localStreamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = !vTrack.enabled;
        setIsCameraOn(vTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const aTrack = localStreamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = !aTrack.enabled;
        setIsMicOn(aTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      if (cameraTrackRef.current && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        localStreamRef.current.addTrack(cameraTrackRef.current);

        // Replace track across all mesh peers
        for (const { peer } of Object.values(peersRef.current)) {
          const sender = peer.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(cameraTrackRef.current);
        }
        cameraTrackRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        if (localStreamRef.current) {
          const camTrack = localStreamRef.current.getVideoTracks()[0];
          if (camTrack) cameraTrackRef.current = camTrack;

          localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current.removeTrack(t));
          localStreamRef.current.addTrack(screenTrack);
        }

        // Replace on all mesh peers
        for (const { peer } of Object.values(peersRef.current)) {
          const sender = peer.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }

        setIsScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn('Screen share cancelled in group call:', err);
      }
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const totalParticipants = Object.keys(remotePeers).length + 1;

  // Grid layout class based on participant count
  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-1';
    if (totalParticipants === 2) return 'grid-2';
    if (totalParticipants <= 4) return 'grid-4';
    return 'grid-6';
  };

  return (
    <div className="group-call-overlay">
      {/* Header Bar */}
      <div className="group-call-header">
        <div className="group-call-info">
          <span className="group-live-indicator" />
          <span className="group-call-channel">#{room} Channel Call</span>
          <span className="group-call-timer">{formatTimer(callDuration)}</span>
        </div>
        <div className="group-call-count">
          <BsPeopleFill />
          <span>{totalParticipants} {totalParticipants === 1 ? 'person' : 'people'}</span>
        </div>
      </div>

      {/* Responsive Multi-Peer Video Grid */}
      <div className={`group-call-grid ${getGridClass()}`}>
        {/* Local Participant Card */}
        <div className="group-peer-card local-card">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`group-video-feed ${!isScreenSharing ? 'mirrored' : ''}`}
          />
          <div className="group-peer-meta">
            <span className="group-peer-name">You {isScreenSharing ? '(Sharing Screen)' : ''}</span>
            {!isMicOn && <span className="peer-muted-badge">Muted</span>}
          </div>
        </div>

        {/* Remote Participants Cards */}
        {Object.entries(remotePeers).map(([socketId, peer]) => (
          <div key={socketId} className="group-peer-card">
            {peer.stream ? (
              <RemoteVideoView stream={peer.stream} />
            ) : (
              <div className="group-peer-placeholder">
                <img
                  src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${peer.username}`}
                  alt={peer.username}
                  className="placeholder-avatar"
                />
                <span className="placeholder-status">Connecting...</span>
              </div>
            )}
            <div className="group-peer-meta">
              <span className="group-peer-name">@{peer.username}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Call Controls Bar */}
      <div className="group-controls-bar">
        <button
          type="button"
          className={`group-ctrl-btn ${!isCameraOn ? 'muted' : ''}`}
          onClick={toggleCamera}
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {isCameraOn ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
        </button>

        <button
          type="button"
          className={`group-ctrl-btn ${isScreenSharing ? 'active-share' : ''}`}
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <BsDisplay />
        </button>

        <button
          type="button"
          className={`group-ctrl-btn ${!isMicOn ? 'muted' : ''}`}
          onClick={toggleMic}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <BsMicFill /> : <BsMicMuteFill />}
        </button>

        <button
          type="button"
          className="group-ctrl-btn hangup"
          onClick={handleLeaveCall}
          title="Leave Call"
        >
          <BsTelephoneXFill />
        </button>
      </div>
    </div>
  );
}

// Subcomponent to bind dynamic MediaStream to <video> element
function RemoteVideoView({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="group-video-feed"
    />
  );
}

export default GroupCallModal;

