import React, { useState, useRef, useEffect } from 'react';
import './AudioWaveformPlayer.css';
import { BsPlayFill, BsPauseFill } from 'react-icons/bs';

const BAR_HEIGHTS = [
  8, 14, 20, 12, 18, 24, 16, 22, 10, 18, 26, 14,
  20, 12, 22, 16, 26, 14, 18, 10, 20, 15, 12, 8
];

function AudioWaveformPlayer({ src, duration = 0, fromMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error('Audio playback error:', err);
      });
    }
  };

  const handleSeek = (index) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;

    const targetFraction = index / BAR_HEIGHTS.length;
    const targetTime = targetFraction * totalDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const progressFraction = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div className="audio-player-card">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        className="audio-play-toggle-btn"
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <BsPauseFill /> : <BsPlayFill style={{ marginLeft: '2px' }} />}
      </button>

      <div className="audio-center-col">
        {/* Waveform Scrubber */}
        <div className="audio-waveform-bars" title="Click to seek">
          {BAR_HEIGHTS.map((height, i) => {
            const barFraction = i / BAR_HEIGHTS.length;
            const isActive = barFraction <= progressFraction;
            return (
              <div
                key={i}
                className={`player-wave-bar ${isActive ? 'active' : ''}`}
                style={{ height: `${height}px` }}
                onClick={() => handleSeek(i)}
              />
            );
          })}
        </div>

        <div className="audio-time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}

export default AudioWaveformPlayer;
