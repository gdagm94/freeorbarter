import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  isOwnMessage?: boolean;
}

export function VoiceMessagePlayer({ audioUrl, duration, isOwnMessage = false }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [localDuration, setLocalDuration] = useState(duration);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume]);

  // Preload audio when component mounts
  useEffect(() => {
    // Reset duration when url changes
    setLocalDuration(duration);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleCanPlay = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleLoadedMetadata = () => {
      // If prop duration is 0, use the actual audio duration
      if (duration === 0) {
        setLocalDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Preload the audio
    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl, duration]);

  const playPause = () => {
    if (!audioRef.current || hasError) return;

    if (isLoading) {
      // Wait for audio to load
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => {
        console.error('Error playing audio:', error);
        setHasError(true);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * localDuration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
    setCurrentTime(audioRef.current.currentTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(localDuration, audioRef.current.currentTime + 15);
    setCurrentTime(audioRef.current.currentTime);
  };

  const togglePlaybackSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return localDuration > 0 ? (currentTime / localDuration) * 100 : 0;
  };

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg ${isOwnMessage
      ? 'bg-indigo-100 border border-indigo-200'
      : 'bg-gray-100 border border-gray-200'
      }`}>
      {/* Play/Pause Button */}
      <button
        onClick={playPause}
        disabled={isLoading || hasError}
        className={`p-2 rounded-full transition-colors ${isOwnMessage
          ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
          : 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400'
          }`}
        title={hasError ? 'Error loading audio' : isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
      >
        {hasError ? (
          <span className="w-4 h-4 text-xs">⚠️</span>
        ) : isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      {/* Skip Backward Button */}
      <button
        onClick={skipBackward}
        disabled={isLoading || hasError}
        className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Skip backward 15s"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>

      {/* Skip Forward Button */}
      <button
        onClick={skipForward}
        disabled={isLoading || hasError}
        className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Skip forward 15s"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      {/* Progress Bar */}
      <div className="flex-1 min-w-0">
        <div
          className="w-full bg-gray-300 rounded-full h-2 cursor-pointer overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className={`h-2 rounded-full transition-all duration-100 ${isOwnMessage ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(localDuration)}</span>
        </div>
      </div>

      {/* Playback Speed Button */}
      <button
        onClick={togglePlaybackSpeed}
        disabled={isLoading || hasError}
        className="px-2 py-1 rounded text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Playback speed"
      >
        {playbackSpeed}x
      </button>

      {/* Volume Control */}
      <button
        onClick={toggleMute}
        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>

      {/* Volume Slider */}
      {!isMuted && (
        <div className="w-16">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${isOwnMessage ? '#4F46E5' : '#4B5563'
                } 0%, ${isOwnMessage ? '#4F46E5' : '#4B5563'
                } ${volume * 100}%, #D1D5DB ${volume * 100}%, #D1D5DB 100%)`
            }}
          />
        </div>
      )}
    </div>
  );
}
