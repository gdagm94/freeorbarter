import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onLongPress={handleReply}
        delayLongPress={500}
        style={styles.messageContainer}
      >
        {children}
      </TouchableOpacity>
      
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
