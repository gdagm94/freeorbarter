import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Plus, Hash, MessageCircle } from 'lucide-react';

interface MessageThread {
  id: string;
  title: string;
  item_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  message_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender: {
      username: string;
    };
  };
}

interface MessageThreadingProps {
  currentUserId: string;
  otherUserId: string;
  itemId?: string | null;
  conversationType: 'item' | 'direct_message' | 'unified';
  selectedThreadId?: string | null;
  onThreadSelect: (threadId: string | null) => void;
  onThreadCreate: (title: string) => void;
}

export function MessageThreading({
  currentUserId,
  otherUserId,
  itemId,
  conversationType,
  selectedThreadId,
  onThreadSelect,
  onThreadCreate,
}: MessageThreadingProps) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThreads();
  }, [currentUserId, otherUserId, itemId, conversationType]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('message_threads')
        .select(`
          *,
          messages!inner (
            id,
            content,
            created_at,
            sender:sender_id (
              username
            )
          )
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      // Filter threads based on conversation type
      if (conversationType === 'item' && itemId) {
        query = query.eq('item_id', itemId);
      } else if (conversationType === 'direct_message') {
        query = query.is('item_id', null);
      }
      // For unified conversations, we get all threads between these users

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching threads:', error);
        return;
      }

      // Process threads to get message counts and last messages
      const processedThreads = data?.map(thread => {
        const messages = thread.messages || [];
        const lastMessage = messages.length > 0 
          ? messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;

        return {
          ...thread,
          message_count: messages.length,
          last_message: lastMessage ? {
            content: lastMessage.content,
            created_at: lastMessage.created_at,
            sender: lastMessage.sender
          } : null
        };
      }) || [];

      setThreads(processedThreads);
    } catch (err) {
      console.error('Error in fetchThreads:', err);
    } finally {
      setLoading(false);
    }
  };

  const createThread = async () => {
    if (!newThreadTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from('message_threads')
        .insert([{
          title: newThreadTitle.trim(),
          item_id: conversationType === 'item' ? itemId : null,
          created_by: currentUserId,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating thread:', error);
        return;
      }

      setNewThreadTitle('');
      setShowCreateThread(false);
      onThreadCreate(newThreadTitle.trim());
      fetchThreads();
    } catch (err) {
      console.error('Error in createThread:', err);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Threads
          </h3>
          <button
            onClick={() => setShowCreateThread(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Create new thread"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create Thread Form */}
      {showCreateThread && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <input
              type="text"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              placeholder="Thread title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={createThread}
                disabled={!newThreadTitle.trim()}
                className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateThread(false);
                  setNewThreadTitle('');
                }}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading threads...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No threads yet</p>
            <p className="text-xs">Create a thread to organize your conversation</p>
          </div>
        ) : (
          <div className="p-2">
            {/* Main Conversation Thread */}
            <button
              onClick={() => onThreadSelect(null)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedThreadId === null
                  ? 'bg-indigo-100 border border-indigo-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  selectedThreadId === null ? 'bg-indigo-600' : 'bg-gray-200'
                }`}>
                  <MessageSquare className={`w-4 h-4 ${
                    selectedThreadId === null ? 'text-white' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    selectedThreadId === null ? 'text-indigo-900' : 'text-gray-900'
                  }`}>
                    Main Conversation
                  </p>
                  <p className="text-xs text-gray-500">
                    All messages in this conversation
                  </p>
                </div>
              </div>
            </button>

            {/* Thread List */}
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onThreadSelect(thread.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors mt-1 ${
                  selectedThreadId === thread.id
                    ? 'bg-indigo-100 border border-indigo-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedThreadId === thread.id ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}>
                    <Hash className={`w-4 h-4 ${
                      selectedThreadId === thread.id ? 'text-white' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      selectedThreadId === thread.id ? 'text-indigo-900' : 'text-gray-900'
                    }`}>
                      {thread.title}
                    </p>
                    {thread.last_message && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500 truncate">
                          {thread.last_message.sender.username}: {truncateText(thread.last_message.content)}
                        </p>
                        <span className="text-xs text-gray-400">
                          {formatTime(thread.last_message.created_at)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {thread.message_count} messages
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(thread.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
