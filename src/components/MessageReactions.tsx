import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Smile, X } from 'lucide-react';

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
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👏'];

export function MessageReactions({ messageId, currentUserId, onReactionChange }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReactions();
  }, [messageId]);

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
    return (
      <div className="flex items-center mt-1">
        <button
          onClick={() => setShowEmojiPicker(true)}
          disabled={loading}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Add reaction"
        >
          <Smile className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Display reactions */}
      {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => (
        <button
          key={emoji}
          onClick={() => addReaction(emoji)}
          disabled={loading}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-colors ${
            emojiReactions.some(r => r.user_id === currentUserId)
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>{emoji}</span>
          <span className="text-xs">{emojiReactions.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        disabled={loading}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        title="Add reaction"
      >
        <Smile className="w-4 h-4" />
      </button>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Add reaction</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addReaction(emoji)}
                disabled={loading}
                className="p-2 rounded-full hover:bg-gray-100 text-lg transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
