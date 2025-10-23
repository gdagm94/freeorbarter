import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface SwipeToReplyProps {
  messageId: string;
  messageContent: string;
  senderName: string;
  onReply: (messageId: string, content: string, senderName: string) => void;
  children: React.ReactNode;
}

export function SwipeToReply({
  messageId,
  messageContent,
  senderName,
  onReply,
  children,
}: SwipeToReplyProps) {
  const [isReplying, setIsReplying] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;

  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReplying(true);
    
    // Trigger reply action
    onReply(messageId, messageContent, senderName);
    
    // Reset after a short delay
    setTimeout(() => {
      setIsReplying(false);
    }, 1000);
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // Show reply icon when swiping
      Animated.timing(replyIconOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      
      // If swiped right more than 50px, trigger reply
      if (translationX > 50) {
        handleReply();
      }
      
      // Reset position and hide icon
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(replyIconOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={10}
        failOffsetY={[-5, 5]}
      >
        <Animated.View style={[
          styles.messageContainer,
          {
            transform: [{ translateX }],
          },
        ]}>
          {children}
        </Animated.View>
      </PanGestureHandler>
      
      {/* Reply Icon */}
      <Animated.View style={[
        styles.replyIcon,
        { opacity: replyIconOpacity },
      ]}>
        <Text style={styles.replyIconText}>↩️</Text>
      </Animated.View>
      
      {/* Reply Indicator */}
      {isReplying && (
        <View style={styles.replyIndicator}>
          <Text style={styles.replyIndicatorText}>
            Replying to {senderName}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  messageContainer: {
    backgroundColor: 'transparent',
  },
  replyIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: [{ translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  replyIconText: {
    fontSize: 16,
  },
  replyIndicator: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  replyIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
