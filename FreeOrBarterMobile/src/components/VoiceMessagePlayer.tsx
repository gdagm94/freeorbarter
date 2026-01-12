import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  isOwnMessage: boolean;
}

export function VoiceMessagePlayer({ audioUrl, duration, isOwnMessage }: VoiceMessagePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sound]);

  const loadSound = async (): Promise<Audio.Sound | null> => {
    try {
      setIsLoading(true);
      
      // Set audio mode to use speaker instead of earpiece
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // Play through speaker
      });
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false }
      );
      
      setSound(newSound);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0);
          setIsPlaying(status.isPlaying || false);
          
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
          }
        }
      });

      return newSound;
    } catch (error) {
      console.error('Error loading audio:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startPositionUpdate = (activeSound: Audio.Sound) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(async () => {
      const status = await activeSound.getStatusAsync();
      if (status.isLoaded) {
        setPosition(status.positionMillis || 0);
      }
    }, 100);
  };

  const ensureSound = async (): Promise<Audio.Sound | null> => {
    if (sound) return sound;
    return loadSound();
  };

  const playPause = async () => {
    try {
      let currentSound = await ensureSound();
      if (!currentSound) return;

      const status = await currentSound.getStatusAsync();
      if (!status.isLoaded) {
        currentSound = await loadSound();
        if (!currentSound) return;
      }

      if (isPlaying) {
        await currentSound.pauseAsync();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else {
        await currentSound.playAsync();
        startPositionUpdate(currentSound);
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (!sound || duration === 0) return 0;
    return Math.min(position / (duration * 1000), 1);
  };

  const containerStyle = isOwnMessage ? styles.ownMessage : styles.otherMessage;
  const progressBarStyle = isOwnMessage ? styles.ownProgressBar : styles.otherProgressBar;

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={playPause}
        disabled={isLoading}
      >
        <Text style={styles.playIcon}>
          {isLoading ? '⏳' : isPlaying ? '⏸️' : '▶️'}
        </Text>
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              progressBarStyle,
              { width: `${getProgress() * 100}%` }
            ]} 
          />
        </View>
        
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>
            {formatTime(position)}
          </Text>
          <Text style={styles.durationText}>
            {formatTime(duration * 1000)}
          </Text>
        </View>
      </View>

      <View style={styles.waveform}>
        <Text style={styles.waveformIcon}>🎤</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    maxWidth: 250,
    marginVertical: 4,
  },
  ownMessage: {
    backgroundColor: '#3B82F6',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playIcon: {
    fontSize: 16,
    color: 'white',
  },
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  ownProgressBar: {
    backgroundColor: 'white',
  },
  otherProgressBar: {
    backgroundColor: '#3B82F6',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  durationText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  waveform: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformIcon: {
    fontSize: 16,
    opacity: 0.7,
  },
});
