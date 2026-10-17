import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './VoiceRecorder.css';
import { BsTrash, BsSendFill } from 'react-icons/bs';

function VoiceRecorder({ onSendAudio, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        
        // Detect supported audio MIME type across iOS Safari and Android Chrome
        let chosenMime = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            chosenMime = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            chosenMime = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            chosenMime = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            chosenMime = 'audio/aac';
          }
        }

        const mediaRecorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(200); // 200ms slice

        timerRef.current = setInterval(() => {
          setSeconds((s) => s + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access denied:', err);
        setError('Microphone access required to record voice notes.');
      }
    }

    startRecording();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    onCancel();
  };

  const handleSend = () => {
    if (!mediaRecorderRef.current || isUploading) return;
    setIsUploading(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const actualMime = recorder.mimeType || 'audio/webm';
        const isMp4 = actualMime.includes('mp4') || actualMime.includes('aac');
        const ext = isMp4 ? '.mp4' : '.webm';

        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}${ext}`, {
          type: actualMime,
        });

        const formData = new FormData();
        formData.append('file', audioFile);

        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.url) {
          onSendAudio({
            url: res.data.url,
            name: res.data.name || 'Voice Note',
            size: res.data.size || audioBlob.size,
            type: 'audio',
            duration: Math.max(1, seconds),
          });
        }
      } catch (err) {
        console.error('Failed to upload voice note:', err);
        setError('Failed to upload voice note. Please try again.');
        setIsUploading(false);
      } finally {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  if (error) {
    return (
      <div className="voice-recorder-bar" style={{ borderColor: '#ef4444' }}>
        <span style={{ fontSize: '13px', color: '#ef4444' }}>⚠️ {error}</span>
        <button type="button" className="record-btn-cancel" onClick={handleCancel}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="voice-recorder-bar">
      <div className="recorder-status-col">
        <span className="recording-live-dot" />
        <span className="recording-timer">{formatTimer(seconds)}</span>
      </div>

      <div className="recording-soundwaves">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="wave-bar" />
        ))}
      </div>

      <div className="recorder-actions">
        <button
          type="button"
          className="record-btn-cancel"
          onClick={handleCancel}
          disabled={isUploading}
          title="Cancel recording"
        >
          <BsTrash />
        </button>

        <button
          type="button"
          className="record-btn-send"
          onClick={handleSend}
          disabled={isUploading || seconds === 0}
          title={isUploading ? 'Uploading voice note...' : 'Send voice note'}
        >
          <BsSendFill />
        </button>
      </div>
    </div>
  );
}

export default VoiceRecorder;
