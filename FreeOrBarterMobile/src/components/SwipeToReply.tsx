import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanGestureHandler,
  State,
} from 'react-native';
import { PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface SwipeToReplyProps {
  messageId: string;
  messageContent: string;
  senderName: string;
  onReply: (messageId: string, content: string, senderName: string) => void;
  children: React.ReactNode;
}

export default function SwipeToReply({
  messageId,
  messageContent,
  senderName,
  onReply,
  children,
}: SwipeToReplyProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isReplying, setIsReplying] = useState(false);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // If swiped left with sufficient velocity or distance
      if (translationX < -50 || velocityX < -500) {
        handleReply();
      } else {
        // Snap back to original position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReplying(true);
    
    // Animate to show reply action
    Animated.timing(translateX, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Trigger reply action
      onReply(messageId, messageContent, senderName);
      
      // Reset after a short delay
      setTimeout(() => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => {
          setIsReplying(false);
        });
      }, 1000);
    });
  };

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
      >
        <Animated.View
          style={[
            styles.messageContainer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
      
      {/* Reply Action Background */}
      <View style={styles.replyActionBackground}>
        <View style={styles.replyAction}>
          <Text style={styles.replyActionText}>Reply</Text>
        </View>
      </View>
      
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
  replyActionBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  replyAction: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
