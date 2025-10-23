import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Square, Send, X } from 'lucide-react';

interface VoiceMessageProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  isVisible: boolean;
}

export function VoiceMessage({ onSend, onCancel, isVisible }: VoiceMessageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Request microphone permission when component becomes visible
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          streamRef.current = stream;
        })
        .catch(err => {
          console.error('Error accessing microphone:', err);
          alert('Microphone access is required for voice messages');
        });
    } else {
      // Clean up when component is hidden
      stopRecording();
      stopPlayback();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isVisible]);

  const startRecording = async () => {
    if (!streamRef.current) {
      alert('Microphone not available');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        setDuration(recordingTime);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (!recordedAudio) return;
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio();
      audioRef.current = audio;
      audio.src = URL.createObjectURL(recordedAudio);
      
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };
      
      audio.play();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const sendVoiceMessage = () => {
    if (recordedAudio && duration > 0) {
      onSend(recordedAudio, duration);
      // Reset state
      setRecordedAudio(null);
      setDuration(0);
      setCurrentTime(0);
      setRecordingTime(0);
      stopPlayback();
    }
  };

  const cancelRecording = () => {
    stopRecording();
    stopPlayback();
    setRecordedAudio(null);
    setDuration(0);
    setCurrentTime(0);
    setRecordingTime(0);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Voice Message</h3>
          <button
            onClick={cancelRecording}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Status */}
        <div className="text-center mb-6">
          {isRecording ? (
            <div className="space-y-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Mic className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Recording...</p>
                <p className="text-2xl font-mono text-red-600">{formatTime(recordingTime)}</p>
              </div>
            </div>
          ) : recordedAudio ? (
            <div className="space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Play className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Voice Message Ready</p>
                <p className="text-sm text-gray-600">Duration: {formatTime(duration)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Mic className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-lg font-medium text-gray-900">Ready to Record</p>
            </div>
          )}
        </div>

        {/* Audio Waveform Visualization */}
        {isRecording && (
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 40 + 10}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${Math.random() * 0.5 + 0.5}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Playback Controls */}
        {recordedAudio && !isRecording && (
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={playRecording}
                className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center space-x-4">
          {!recordedAudio ? (
            <>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-4 rounded-full text-white transition-colors ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startRecording}
                className="p-4 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
              >
                <Mic className="w-6 h-6" />
              </button>
              <button
                onClick={sendVoiceMessage}
                className="p-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                <Send className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isRecording
              ? 'Tap the square to stop recording'
              : recordedAudio
              ? 'Tap play to listen, or record a new message'
              : 'Tap the microphone to start recording'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
