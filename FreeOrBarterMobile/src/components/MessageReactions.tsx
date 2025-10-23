import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface MessageReaction {
  id: string;
  emoji: string;
  user_id: string;
  created_at: string;
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
  onReactionChange?: () => void;
  showPicker?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👏'];

export function MessageReactions({ messageId, currentUserId, onReactionChange, showPicker = false }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReactions();
  }, [messageId]);

  useEffect(() => {
    if (showPicker) {
      setShowEmojiPicker(true);
    }
  }, [showPicker]);

  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching reactions:', error);
        return;
      }

      setReactions(data || []);
    } catch (err) {
      console.error('Error in fetchReactions:', err);
    }
  };

  const addReaction = async (emoji: string) => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Check if user already has this reaction
      const existingReaction = reactions.find(
        r => r.user_id === currentUserId && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove existing reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) {
          console.error('Error removing reaction:', error);
          return;
        }
      } else {
        // Add new reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: currentUserId,
            emoji: emoji
          });

        if (error) {
          console.error('Error adding reaction:', error);
          return;
        }
      }

      // Refresh reactions
      await fetchReactions();
      setShowEmojiPicker(false);
      
      if (onReactionChange) {
        onReactionChange();
      }
    } catch (err) {
      console.error('Error in addReaction:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);

  if (reactions.length === 0 && !showEmojiPicker) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Display reactions */}
      <View style={styles.reactionsContainer}>
        {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => (
          <TouchableOpacity
            key={emoji}
            onPress={() => addReaction(emoji)}
            disabled={loading}
            style={[
              styles.reactionButton,
              emojiReactions.some(r => r.user_id === currentUserId)
                ? styles.reactionButtonActive
                : styles.reactionButtonInactive
            ]}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={styles.reactionCount}>{emojiReactions.length}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add reaction button */}
      <TouchableOpacity
        onPress={() => setShowEmojiPicker(true)}
        disabled={loading}
        style={styles.addReactionButton}
      >
        <Text style={styles.addReactionText}>😊</Text>
      </TouchableOpacity>

      {/* Emoji picker modal */}
      <Modal
        visible={showEmojiPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEmojiPicker(false)}
        >
          <View style={styles.emojiPicker}>
            <Text style={styles.emojiPickerTitle}>Add Reaction</Text>
            <View style={styles.emojiGrid}>
              {COMMON_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => addReaction(emoji)}
                  disabled={loading}
                  style={styles.emojiButton}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  reactionButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  reactionButtonInactive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#6B7280',
  },
  addReactionButton: {
    padding: 4,
    marginLeft: 4,
  },
  addReactionText: {
    fontSize: 16,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiPicker: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    minWidth: 200,
  },
  emojiPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: '#374151',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emojiButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  emojiText: {
    fontSize: 20,
  },
});
