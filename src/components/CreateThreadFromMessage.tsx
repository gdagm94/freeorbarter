import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Hash, X, MessageSquare } from 'lucide-react';

interface CreateThreadFromMessageProps {
  messageId: string;
  messageContent: string;
  currentUserId: string;
  otherUserId: string;
  itemId?: string | null;
  conversationType: 'item' | 'direct_message' | 'unified';
  onThreadCreated: (threadId: string, threadTitle: string) => void;
  onClose: () => void;
}

export function CreateThreadFromMessage({
  messageId,
  messageContent,
  currentUserId,
  otherUserId,
  itemId,
  conversationType,
  onThreadCreated,
  onClose,
}: CreateThreadFromMessageProps) {
  const [threadTitle, setThreadTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const createThread = async () => {
    if (!threadTitle.trim()) return;

    try {
      setLoading(true);

      // Create the thread
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert([{
          title: threadTitle.trim(),
          item_id: conversationType === 'item' ? itemId : null,
          created_by: currentUserId,
        }])
        .select()
        .single();

      if (threadError) {
        console.error('Error creating thread:', threadError);
        return;
      }

      // Move the message to the new thread
      const { error: messageError } = await supabase
        .from('messages')
        .update({ thread_id: thread.id })
        .eq('id', messageId);

      if (messageError) {
        console.error('Error moving message to thread:', messageError);
        return;
      }

      onThreadCreated(thread.id, thread.title);
      onClose();
    } catch (err) {
      console.error('Error in createThread:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestedTitles = () => {
    const content = messageContent.toLowerCase();
    const suggestions = [];

    // Extract potential topics from message content
    if (content.includes('price') || content.includes('cost') || content.includes('$')) {
      suggestions.push('Pricing Discussion');
    }
    if (content.includes('meet') || content.includes('pickup') || content.includes('location')) {
      suggestions.push('Meeting Arrangement');
    }
    if (content.includes('condition') || content.includes('quality') || content.includes('damage')) {
      suggestions.push('Item Condition');
    }
    if (content.includes('offer') || content.includes('trade') || content.includes('barter')) {
      suggestions.push('Trade Offer');
    }
    if (content.includes('question') || content.includes('?')) {
      suggestions.push('Questions');
    }

    // Add generic suggestions if no specific ones found
    if (suggestions.length === 0) {
      suggestions.push('General Discussion', 'Item Details', 'Trade Discussion');
    }

    return suggestions.slice(0, 3); // Return max 3 suggestions
  };

  const suggestedTitles = generateSuggestedTitles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Create Thread
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 line-clamp-3">
              {messageContent}
            </p>
          </div>
        </div>

        {/* Thread Title Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thread Title
          </label>
          <input
            type="text"
            value={threadTitle}
            onChange={(e) => setThreadTitle(e.target.value)}
            placeholder="Enter a descriptive title for this thread..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Suggested Titles */}
        {suggestedTitles.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Suggested titles:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedTitles.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setThreadTitle(suggestion)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={createThread}
            disabled={!threadTitle.trim() || loading}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Thread'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-3">
          This will create a new thread and move the selected message to it. 
          You can continue the conversation in this organized thread.
        </p>
      </div>
    </div>
  );
}
