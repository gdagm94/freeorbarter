import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Image as ImageIcon, Paperclip, Mic } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import pusherClient from '../lib/pusher';
import { MessageReactions } from './MessageReactions';
import { ReadReceipt } from './ReadReceipt';
import { MessageSearch } from './MessageSearch';
import { MessageDrafts, useMessageDrafts } from './MessageDrafts';
import { FileAttachment, FileDisplay } from './FileAttachment';
import { VoiceMessage } from './VoiceMessage';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ImageViewer } from './ImageViewer';
import { FileViewer } from './FileViewer';
import { hapticFeedback } from '../utils/hapticFeedback';
import { checkContent } from '../lib/contentFilter';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  read_at?: string | null;
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
  
  // New state for enhanced features
  const [showFileAttachment, setShowFileAttachment] = useState(false);
  const [showVoiceMessage, setShowVoiceMessage] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{url: string; name: string; type: string; size?: number} | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  // Message drafts hook
  const { saveDraft, clearDrafts } = useMessageDrafts(user?.id || '', friendId, 'direct_message', null);

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
          .update({ read: true, read_at: new Date().toISOString() })
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
              .update({ read: true, read_at: new Date().toISOString() })
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

  // Handle input change with draft saving
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    if (value.trim()) {
      saveDraft(value);
    }
  };

  // Handle double-click for reactions
  const handleMessageDoubleClick = (messageId: string) => {
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;
    
    if (lastClickTime && (now - lastClickTime) < DOUBLE_CLICK_DELAY) {
      // Double click detected - show emoji picker
      setShowReactionPicker(messageId);
      hapticFeedback.medium();
    } else {
      setLastClickTime(now);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
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
      clearDrafts();

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

    const messageContent = newMessage.trim();
    
    // Check content filtering
    try {
      const filterResult = await checkContent({
        content: messageContent,
        contentType: 'message',
      });

      if (filterResult.blocked) {
        alert(filterResult.message || 'Your message contains inappropriate content and cannot be sent.');
        return;
      }

      if (filterResult.warned) {
        const proceed = window.confirm(
          filterResult.message || 'Your message may contain inappropriate content. Do you want to proceed?'
        );
        if (!proceed) {
          return;
        }
      }
    } catch (err) {
      console.error('Error checking content:', err);
      // Continue with sending if filter check fails
    }

    setSending(true);
    setNewMessage('');
    clearDrafts();

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

  const handleFileUpload = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!user || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: `📎 ${fileName}`,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          sender_id: user.id,
          receiver_id: friendId,
          item_id: null,
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
      clearDrafts();

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
      console.error('Error sending file:', err);
    } finally {
      setSending(false);
    }
  };

  const handleVoiceMessageUpload = async (audioBlob: Blob, duration: number) => {
    if (!user || sending) return;

    setSending(true);
    try {
      
      const fileExt = 'm4a';
      const fileName = `voice_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: `🎤 Voice message (${Math.round(duration)}s)`,
          file_url: publicUrl,
          file_name: fileName,
          file_type: 'audio/m4a',
          sender_id: user.id,
          receiver_id: friendId,
          item_id: null,
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
      clearDrafts();

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
      console.error('Error sending voice message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
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
          <div className="flex items-center space-x-2">
            <MessageSearch
              currentUserId={user?.id || ''}
              otherUserId={friendId}
              conversationType="direct_message"
              itemId={null}
              onResultClick={(messageId) => {
                // Scroll to message
                const messageElement = document.getElementById(`message-${messageId}`);
                if (messageElement) {
                  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
            />
            <MessageDrafts
              currentUserId={user?.id || ''}
              otherUserId={friendId}
              conversationType="direct_message"
              itemId={null}
              onDraftSelect={(draft) => setNewMessage(draft.content)}
            />
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
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
                  id={`message-${message.id}`}
                  className={`flex ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 cursor-pointer ${
                      message.sender_id === user?.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                    onDoubleClick={() => handleMessageDoubleClick(message.id)}
                  >
                    <p>{message.content}</p>
                    
                    {/* Message Image */}
                    {message.image_url && (
                      <div className="mt-2">
                        <img 
                          src={message.image_url} 
                          alt="Message attachment"
                          className="max-w-xs h-auto rounded-lg cursor-pointer border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedImageUrl(message.image_url!);
                            setShowImageViewer(true);
                          }}
                          onError={(e) => {
                            console.error('Image failed to load:', message.image_url);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* File Attachment */}
                    {message.file_url && !message.image_url && !message.content?.includes('🎤') && (
                      <div className="mt-2">
                        <FileDisplay
                          fileUrl={message.file_url}
                          fileName={message.content?.replace('📎 ', '') || 'Unknown file'}
                          fileType={message.file_type || "application/octet-stream"}
                          fileSize={message.file_size}
                          onPress={() => {
                            setSelectedFile({
                              url: message.file_url!,
                              name: message.content?.replace('📎 ', '') || 'Unknown file',
                              type: message.file_type || "application/octet-stream",
                              size: message.file_size
                            });
                            setShowFileViewer(true);
                          }}
                        />
                      </div>
                    )}

                    {/* Voice Message */}
                    {message.file_url && message.content?.includes('🎤') && (
                      <div className="mt-2">
                        <VoiceMessagePlayer
                          audioUrl={message.file_url}
                          duration={0} // We'll need to store duration in the database
                          isOwnMessage={message.sender_id === user?.id}
                        />
                      </div>
                    )}

                    {/* Message Reactions */}
                    <MessageReactions
                      messageId={message.id}
                      currentUserId={user?.id || ''}
                    />

                    {/* Read Receipt */}
                    {message.sender_id === user?.id && (
                      <ReadReceipt
                      message={{
                        read: message.read,
                        read_at: message.read_at || null,
                        created_at: message.created_at,
                        sender_id: message.sender_id
                      }}
                      currentUserId={user?.id || ''}
                    />
                    )}

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
            <button
              type="button"
              onClick={() => setShowFileAttachment(true)}
              disabled={uploading}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceMessage(true)}
              disabled={uploading}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title="Voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
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

      {/* Modals */}
      {showFileAttachment && (
        <FileAttachment
          onFileUpload={handleFileUpload}
          onClose={() => setShowFileAttachment(false)}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}

      {showVoiceMessage && (
        <VoiceMessage
          onSend={handleVoiceMessageUpload}
          onCancel={() => setShowVoiceMessage(false)}
          isVisible={showVoiceMessage}
        />
      )}

      {/* Image Viewer Modal */}
      <ImageViewer
        visible={showImageViewer}
        imageUrl={selectedImageUrl}
        onClose={() => setShowImageViewer(false)}
      />

      {/* File Viewer Modal */}
      {selectedFile && (
        <FileViewer
          visible={showFileViewer}
          fileUrl={selectedFile.url}
          fileName={selectedFile.name}
          fileType={selectedFile.type}
          fileSize={selectedFile.size}
          onClose={() => {
            setShowFileViewer(false);
            setSelectedFile(null);
          }}
        />
      )}

      {/* Reaction Picker Modal */}
      {showReactionPicker && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Reaction</h3>
              <button
                onClick={() => setShowReactionPicker(null)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <MessageReactions
              messageId={showReactionPicker}
              currentUserId={user?.id || ''}
              onReactionChange={() => setShowReactionPicker(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}