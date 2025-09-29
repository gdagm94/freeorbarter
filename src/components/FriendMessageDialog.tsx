import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import pusherClient from '../lib/pusher';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
}

interface FriendMessageDialogProps {
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  onClose: () => void;
}

export function FriendMessageDialog({ friendId, friendName, friendAvatar, onClose }: FriendMessageDialogProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id (
              username,
              avatar_url
            )
          `)
          .is('item_id', null) // Direct messages have no item_id
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ read: true })
          .is('item_id', null)
          .eq('sender_id', friendId)
          .eq('receiver_id', user.id)
          .eq('read', false);

      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = pusherClient.subscribe(`private-user-${user.id}`);
    
    channel.bind('new-message', async (data: { messageId: string }) => {
      try {
        const { data: newMessage, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id (
              username,
              avatar_url
            )
          `)
          .eq('id', data.messageId)
          .single();

        if (error) throw error;

        // Only add if it's a direct message from this friend
        if (newMessage && 
            !newMessage.item_id && 
            ((newMessage.sender_id === friendId && newMessage.receiver_id === user.id) ||
             (newMessage.sender_id === user.id && newMessage.receiver_id === friendId))) {
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if from friend
          if (newMessage.sender_id === friendId) {
            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id);
          }
        }
      } catch (err) {
        console.error('Error handling new message:', err);
      }
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [user, friendId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('message-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('message-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      await sendMessageWithImage('', imageUrl);
    }
  };

  const sendMessageWithImage = async (content: string, imageUrl: string) => {
    if (!user || sending) return;

    setSending(true);
    const messageContent = content;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: messageContent,
          image_url: imageUrl,
          sender_id: user.id,
          receiver_id: friendId,
          item_id: null, // Direct message
          read: false,
          is_offer: false,
          archived: false
        }])
        .select(`
          *,
          sender:sender_id (
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);

      // Trigger Pusher event
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `private-user-${friendId}`,
          event: 'new-message',
          data: { messageId: data.id }
        })
      });

    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: messageContent,
          sender_id: user.id,
          receiver_id: friendId,
          item_id: null, // Direct message
          read: false,
          is_offer: false,
          archived: false
        }])
        .select(`
          *,
          sender:sender_id (
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);

      // Trigger Pusher event
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `private-user-${friendId}`,
          event: 'new-message',
          data: { messageId: data.id }
        })
      });

    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            {friendAvatar ? (
              <img
                src={friendAvatar}
                alt={friendName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{friendName}</h3>
              <p className="text-sm text-gray-500">Direct Message</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500">Start your conversation with {friendName}!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.sender_id === user?.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title="Attach image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${friendName}...`}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={sending || uploading}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || uploading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}