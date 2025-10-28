import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { Link } from 'react-router-dom';
import { ArrowRight, Image as ImageIcon, Send } from 'lucide-react';
import pusherClient from '../lib/pusher';
import { debounce } from 'throttle-debounce';
import { MessageReactions } from './MessageReactions';
import { ReadReceipt } from './ReadReceipt';
import { MessageSearch } from './MessageSearch';
import { MessageDrafts, useMessageDrafts } from './MessageDrafts';
import { FileAttachment, FileDisplay } from './FileAttachment';
import { VoiceMessage } from './VoiceMessage';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { OfferTemplates } from './OfferTemplates';
import { CounterOffers } from './CounterOffers';
import { BulkOffers } from './BulkOffers';
import { ImageViewer } from './ImageViewer';
import { FileViewer } from './FileViewer';
import { SwipeToReply } from './SwipeToReply';
import { AttachmentMenu } from './AttachmentMenu';
import { MessageContextMenu } from './MessageContextMenu';
import { hapticFeedback } from '../utils/hapticFeedback';

interface MessageListProps {
  itemId: string | null; // Made nullable for unified conversations
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message' | 'unified'; // Added unified type
  onMessageRead?: () => void;
}

interface MessageWithOfferItem extends Message {
  offer_item?: {
    id: string;
    title: string;
    images: string[];
    condition: string;
    description: string;
  };
  sender?: {
    username: string;
    avatar_url: string | null;
  };
  items?: {
    id: string;
    title: string;
    images: string[];
  };
  read_at?: string | null;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function MessageList({ itemId, currentUserId, otherUserId, conversationType, onMessageRead }: MessageListProps) {
  const [messages, setMessages] = useState<MessageWithOfferItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showFileAttachment, setShowFileAttachment] = useState(false);
  const [showVoiceMessage, setShowVoiceMessage] = useState(false);
  const [showOfferTemplates, setShowOfferTemplates] = useState(false);
  const [showBulkOffers, setShowBulkOffers] = useState(false);
  const [showCounterOffers, setShowCounterOffers] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{url: string; name: string; type: string; size?: number} | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuMessageId, setContextMenuMessageId] = useState<string | null>(null);

  // Message drafts hook
  const { saveDraft, clearDrafts } = useMessageDrafts(currentUserId, otherUserId, conversationType, itemId);

  // Debounced function to emit typing status
  const emitTypingStatus = debounce(1000, async (isTyping: boolean) => {
    try {
      const channelName = conversationType === 'unified' 
        ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
        : conversationType === 'direct_message' 
        ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
        : `private-messages-${itemId}`;

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelName,
          event: isTyping ? 'typing.start' : 'typing.stop',
          data: {
            userId: currentUserId
          }
        })
      });
    } catch (err) {
      console.error('Error sending typing status:', err);
    }
  });

  const markMessagesAsRead = async () => {
    try {
      const unreadMessages = messages.filter(
        msg => msg.receiver_id === currentUserId && !msg.read
      );
      
      if (unreadMessages.length === 0) return;

      let query = supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', currentUserId)
        .eq('sender_id', otherUserId)
        .eq('read', false);

      // For unified conversations, we don't filter by item_id
      // For item conversations, we filter by specific item_id
      // For direct_message conversations, we filter by null item_id
      if (conversationType === 'item' && itemId) {
        query = query.eq('item_id', itemId);
      } else if (conversationType === 'direct_message') {
        query = query.is('item_id', null);
      }
      // For unified conversations, we don't add any item_id filter

      const { error } = await query;
      
      if (error) {
        console.error('Error updating message read status:', error);
        return;
      }

      setMessages(prev => 
        prev.map(msg => 
          (msg.receiver_id === currentUserId && msg.sender_id === otherUserId)
            ? { ...msg, read: true }
            : msg
        )
      );
      
      if (onMessageRead) {
        onMessageRead();
      }
      
      setHasMarkedAsRead(true);

      // Trigger Pusher event for read status update
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `private-user-${otherUserId}`,
          event: 'message-read',
          data: {
            itemId,
            readerId: currentUserId,
            senderId: otherUserId
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to trigger Pusher event');
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!otherUserId || !UUID_REGEX.test(otherUserId)) {
          console.error('Invalid user ID format:', otherUserId);
          setError('Invalid user ID format');
          setLoading(false);
          return;
        }

        if (conversationType === 'item' && (!itemId || !UUID_REGEX.test(itemId))) {
          console.error('Invalid item ID format:', itemId);
          setError('Invalid item ID format');
          setLoading(false);
          return;
        }

        let query = supabase
          .from('messages')
          .select(`
            *,
            offer_item:offer_item_id (
              id,
              title,
              images,
              condition,
              description
            ),
            sender:sender_id (
              username,
              avatar_url
            ),
            items:item_id (
              id,
              title,
              images
            )
          `)
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });

        // Apply different filters based on conversation type
        if (conversationType === 'direct_message') {
          query = query.is('item_id', null);
        } else if (conversationType === 'item' && itemId) {
          query = query.eq('item_id', itemId);
        }
        // For unified conversations, we don't filter by item_id - we get all messages between these users


        const { data, error } = await query;

        if (error) {
          console.error('Error fetching messages:', error);
          setError('Failed to load messages');
          setLoading(false);
          return;
        }

        setMessages(data || []);
        
        if (data && data.length > 0) {
          setTimeout(() => {
            markMessagesAsRead();
          }, 300);
        }
        
      } catch (err) {
        console.error('Error in fetchMessages:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to Pusher channels
    const channelName = conversationType === 'unified' 
      ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
      : conversationType === 'direct_message' 
      ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
      : `private-messages-${itemId}`;

    const messageChannel = pusherClient.subscribe(channelName);
    
    messageChannel.bind('new-message', async (data: { messageId: string }) => {
      try {
        const { data: newMessage, error } = await supabase
          .from('messages')
          .select(`
            *,
            offer_item:offer_item_id (
              id,
              title,
              images,
              condition,
              description
            ),
            sender:sender_id (
              username,
              avatar_url
            ),
            items:item_id (
              id,
              title,
              images
            )
          `)
          .eq('id', data.messageId)
          .single();

        if (error) {
          console.error('Error fetching new message:', error);
          return;
        }

        // Check if this message belongs to the current conversation
        let messageMatches = false;
        
        if (conversationType === 'unified') {
          // For unified conversations, any message between these two users matches
          messageMatches = (newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) || 
                          (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId);
        } else if (conversationType === 'direct_message') {
          messageMatches = newMessage.item_id === null &&
            ((newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) || 
             (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId));
        } else if (conversationType === 'item') {
          messageMatches = newMessage.item_id === itemId &&
            ((newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) || 
             (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId));
        }

        if (newMessage && messageMatches) {
          setMessages((current) => [...current, newMessage]);
          
          if (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId) {
            setTimeout(() => {
              markMessagesAsRead();
            }, 300);
          }
        }
      } catch (err) {
        console.error('Error handling new message:', err);
      }
    });

    messageChannel.bind('messages-read', (data: { readerId: string; senderId: string }) => {
      if (data.readerId === otherUserId && data.senderId === currentUserId) {
        setMessages(prev => 
          prev.map(msg => 
            msg.sender_id === currentUserId && msg.receiver_id === otherUserId
              ? { ...msg, read: true }
              : msg
          )
        );
      }
    });

    // Handle typing indicators
    messageChannel.bind('typing.start', (data: { userId: string }) => {
      if (data.userId === otherUserId) {
        setOtherUserTyping(true);
      }
    });

    messageChannel.bind('typing.stop', (data: { userId: string }) => {
      if (data.userId === otherUserId) {
        setOtherUserTyping(false);
      }
    });

    return () => {
      messageChannel.unbind_all();
      messageChannel.unsubscribe();
      emitTypingStatus.cancel();
    };
  }, [itemId, currentUserId, otherUserId, conversationType]);

  useEffect(() => {
    if (!hasMarkedAsRead && messages.length > 0 && !loading) {
      markMessagesAsRead();
    }
  }, [messages, hasMarkedAsRead, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Save draft as user types (debounced)
    if (value.trim()) {
      saveDraft(value);
    }
    
    if (!isTyping) {
      setIsTyping(true);
      emitTypingStatus(true);
    }
  };

  const handleInputBlur = () => {
    if (isTyping) {
      setIsTyping(false);
      emitTypingStatus(false);
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
      setError('Failed to upload image');
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
    try {
      setSending(true);
      setIsTyping(false);
      emitTypingStatus(false);

      const { data, error } = await supabase.from('messages').insert([
        {
          content: content,
          image_url: imageUrl,
          item_id: conversationType === 'unified' ? null : itemId,
          sender_id: currentUserId,
          receiver_id: otherUserId,
          read: false,
          is_offer: false
        },
      ]).select(`
        *,
        offer_item:offer_item_id (
          id,
          title,
          images,
          condition,
          description
        ),
        sender:sender_id (
          username,
          avatar_url
        ),
        items:item_id (
          id,
          title,
          images
        )
      `).single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);

        // Trigger Pusher event for new message
        const channelName = conversationType === 'unified' 
          ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
          : conversationType === 'direct_message' 
          ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
          : `private-messages-${itemId}`;

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelName,
            event: 'new-message',
            data: { messageId: data.id }
          })
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const messageContent = newMessage.trim();
      setNewMessage('');
      setSending(true);
      setIsTyping(false);
      emitTypingStatus(false);

      const { data, error } = await supabase.from('messages').insert([
        {
          content: messageContent,
          item_id: conversationType === 'unified' ? null : itemId, // For unified, always use null
          sender_id: currentUserId,
          receiver_id: otherUserId,
          read: false,
          is_offer: false
        },
      ]).select(`
        *,
        offer_item:offer_item_id (
          id,
          title,
          images,
          condition,
          description
        ),
        sender:sender_id (
          username,
          avatar_url
        ),
        items:item_id (
          id,
          title,
          images
        )
      `).single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);
        
        // Clear drafts after successful send
        clearDrafts();

        // Trigger Pusher event for new message
        const channelName = conversationType === 'unified' 
          ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
          : conversationType === 'direct_message' 
          ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
          : `private-messages-${itemId}`;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelName,
            event: 'new-message',
            data: {
              messageId: data.id
            }
          })
        });

        if (!response.ok) {
          console.error('Failed to trigger Pusher event');
        }
      }
    } catch (err) {
      console.error('Error in message sending process:', err);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle search result click
  const handleSearchResultClick = (messageId: string) => {
    setHighlightedMessageId(messageId);
    // Scroll to the message
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightedMessageId(null), 3000);
    }
  };

  // Handle draft selection
  const handleDraftSelect = (draft: { content: string }) => {
    setNewMessage(draft.content);
  };

  const handleFileUpload = async (fileUrl: string, fileName: string) => {
    try {
      setSending(true);
      setIsTyping(false);
      emitTypingStatus(false);

      const { data, error } = await supabase.from('messages').insert([
        {
          content: `📎 ${fileName}`,
          file_url: fileUrl,
          file_name: fileName,
          file_type: 'application/octet-stream',
          item_id: conversationType === 'unified' ? null : itemId,
          sender_id: currentUserId,
          receiver_id: otherUserId,
          read: false,
          is_offer: false
        },
      ]).select(`
        *,
        offer_item:offer_item_id (
          id,
          title,
          images,
          condition,
          description
        ),
        sender:sender_id (
          username,
          avatar_url
        ),
        items:item_id (
          id,
          title,
          images
        )
      `).single();

      if (error) {
        console.error('Error sending file:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);
        
        // Clear drafts after successful send
        clearDrafts();

        // Trigger Pusher event for new message
        const channelName = conversationType === 'unified' 
          ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
          : conversationType === 'direct_message' 
          ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
          : `private-messages-${itemId}`;

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelName,
            event: 'new-message',
            data: { messageId: data.id }
          })
        });
      }
    } catch (err) {
      console.error('Error sending file:', err);
    } finally {
      setSending(false);
    }
  };

  const handleVoiceMessageUpload = async (audioBlob: Blob, duration: number) => {
    try {
      setSending(true);
      setIsTyping(false);
      emitTypingStatus(false);

      // Upload audio file
      const fileExt = 'webm';
      const fileName = `voice-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('message-files')
        .getPublicUrl(fileName);

      // Send message with voice attachment
      const { data, error } = await supabase.from('messages').insert([
        {
          content: `🎤 Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
          file_url: publicUrl,
          item_id: conversationType === 'unified' ? null : itemId,
          sender_id: currentUserId,
          receiver_id: otherUserId,
          read: false,
          is_offer: false
        },
      ]).select(`
        *,
        offer_item:offer_item_id (
          id,
          title,
          images,
          condition,
          description
        ),
        sender:sender_id (
          username,
          avatar_url
        ),
        items:item_id (
          id,
          title,
          images
        )
      `).single();

      if (error) {
        console.error('Error sending voice message:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);
        
        // Clear drafts after successful send
        clearDrafts();

        // Trigger Pusher event for new message
        const channelName = conversationType === 'unified' 
          ? `private-user-${[currentUserId, otherUserId].sort().join('-')}`
          : conversationType === 'direct_message' 
          ? `private-dm-${[currentUserId, otherUserId].sort().join('-')}`
          : `private-messages-${itemId}`;

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelName,
            event: 'new-message',
            data: { messageId: data.id }
          })
        });
      }
    } catch (err) {
      console.error('Error sending voice message:', err);
    } finally {
      setSending(false);
      setShowVoiceMessage(false);
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

  // Handle right-click context menu
  const handleMessageRightClick = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuMessageId(messageId);
    setShowContextMenu(true);
    hapticFeedback.light();
  };

  // Handle reply to message
  const handleReplyToMessage = (_messageId: string, content: string, senderName: string) => {
    // For now, just show a notification or add to input field
    setNewMessage(`Replying to ${senderName}: ${content.substring(0, 50)}... `);
  };

  // Handle copy message
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    hapticFeedback.success();
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ archived: true })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      hapticFeedback.success();
    } catch (err) {
      console.error('Error deleting message:', err);
      hapticFeedback.error();
    }
  };

  return (
    <div className="flex h-[500px]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with search and drafts */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <MessageSearch
              currentUserId={currentUserId}
              otherUserId={otherUserId}
              conversationType={conversationType}
              itemId={itemId}
              onResultClick={handleSearchResultClick}
            />
            <MessageDrafts
              currentUserId={currentUserId}
              otherUserId={otherUserId}
              conversationType={conversationType}
              itemId={itemId}
              onDraftSelect={handleDraftSelect}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOfferTemplates(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              title="Offer templates"
            >
              📝
            </button>
            <button
              onClick={() => setShowBulkOffers(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              title="Bulk offers"
            >
              📦
            </button>
          </div>
        </div>
      
      <div 
        ref={messagesContainerRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-red-500">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={`flex group ${
                  message.sender_id === currentUserId ? 'justify-end' : 'justify-start'
                } ${
                  highlightedMessageId === message.id ? 'bg-yellow-100 rounded-lg p-2' : ''
                }`}
              >
                <SwipeToReply
                  messageId={message.id}
                  messageContent={message.content}
                  senderName={message.sender?.username || 'Unknown'}
                  onReply={handleReplyToMessage}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 cursor-pointer ${
                      message.sender_id === currentUserId
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100'
                    }`}
                    onDoubleClick={() => handleMessageDoubleClick(message.id)}
                    onContextMenu={(e) => handleMessageRightClick(e, message.id)}
                  >
                  {message.sender_id !== currentUserId && message.sender && (
                    <div className="flex items-center mb-1">
                      <div className="w-5 h-5 rounded-full bg-gray-300 overflow-hidden mr-2">
                        {message.sender.avatar_url ? (
                          <img 
                            src={message.sender.avatar_url} 
                            alt={message.sender.username} 
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {message.sender.username}
                      </span>
                    </div>
                  )}
                  
                  {/* Message Image */}
                  {message.image_url && (
                    <div className="mt-2">
                        <img 
                        src={message.image_url} 
                        alt="Message attachment"
                        className="max-w-xs h-auto rounded-lg cursor-pointer border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => {
                          if (message.image_url) {
                            setSelectedImageUrl(message.image_url);
                            setShowImageViewer(true);
                          }
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
                        fileType="application/octet-stream" // We'll need to store this in the database
                        onPress={() => {
                          setSelectedFile({
                            url: message.file_url!,
                            name: message.content?.replace('📎 ', '') || 'Unknown file',
                            type: "application/octet-stream",
                            size: undefined
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
                        isOwnMessage={message.sender_id === currentUserId}
                      />
                    </div>
                  )}
                  
                  {/* Message Content */}
                  {message.content && (
                    <p>{message.content}</p>
                  )}


                  {/* Counter Offers Button for Offer Messages */}
                  {message.is_offer && message.sender_id === currentUserId && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowCounterOffers(message.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                      >
                        View counter offers
                      </button>
                    </div>
                  )}
                  
                  {/* Show item context for unified conversations */}
                  {conversationType === 'unified' && message.items && (
                    <div className={`mt-2 p-2 rounded ${
                      message.sender_id === currentUserId
                        ? 'bg-indigo-700'
                        : 'bg-white'
                    }`}>
                      <div className="mb-1 text-xs font-medium">
                        <span className={message.sender_id === currentUserId ? 'text-indigo-200' : 'text-indigo-600'}>
                          About item:
                        </span>
                      </div>
                      <Link 
                        to={`/items/${message.items.id}`}
                        className="block"
                      >
                        <div className="flex items-start">
                          <img 
                            src={message.items.images[0]} 
                            alt={message.items.title}
                            className="w-12 h-12 object-cover rounded mr-2 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${
                              message.sender_id === currentUserId
                                ? 'text-white'
                                : 'text-gray-800'
                            }`}>
                              {message.items.title}
                            </p>
                            <div className="flex items-center text-xs mt-1">
                              <span className={message.sender_id === currentUserId
                                ? 'text-indigo-200'
                                : 'text-indigo-600'
                              }>
                                View item
                              </span>
                              <ArrowRight className={`w-3 h-3 ml-1 ${
                                message.sender_id === currentUserId
                                  ? 'text-indigo-200'
                                  : 'text-indigo-600'
                              }`} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  )}
                  
                  {message.offer_item_id && (
                    <div className={`mt-3 p-3 rounded ${
                      message.sender_id === currentUserId
                        ? 'bg-indigo-700'
                        : 'bg-white'
                    }`}>
                      <div className="mb-2 text-sm font-medium">
                        <span className={message.sender_id === currentUserId ? 'text-indigo-200' : 'text-indigo-600'}>
                          Barter Offer
                        </span>
                      </div>
                      {message.offer_item ? (
                        <Link 
                          to={`/items/${message.offer_item.id}`}
                          className="block"
                        >
                          <div className="flex items-start">
                            <img 
                              src={message.offer_item.images[0]} 
                              alt={message.offer_item.title}
                              className="w-16 h-16 object-cover rounded mr-3 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${
                                message.sender_id === currentUserId
                                  ? 'text-white'
                                  : 'text-gray-800'
                              }`}>
                                {message.offer_item.title}
                              </p>
                              <p className={`text-xs ${
                                message.sender_id === currentUserId
                                  ? 'text-indigo-200'
                                  : 'text-gray-600'
                              } mt-1`}>
                                Condition: {message.offer_item.condition}
                              </p>
                              <p className={`text-xs ${
                                message.sender_id === currentUserId
                                  ? 'text-indigo-200'
                                  : 'text-gray-600'
                              } mt-1 line-clamp-2`}>
                                {message.offer_item.description}
                              </p>
                              <div className="flex items-center text-xs mt-2">
                                <span className={message.sender_id === currentUserId
                                  ? 'text-indigo-200'
                                  : 'text-indigo-600'
                                }>
                                  View item details
                                </span>
                                <ArrowRight className={`w-3 h-3 ml-1 ${
                                  message.sender_id === currentUserId
                                    ? 'text-indigo-200'
                                    : 'text-indigo-600'
                                }`} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <p className={`text-sm ${
                          message.sender_id === currentUserId
                            ? 'text-indigo-200'
                            : 'text-gray-600'
                        }`}>
                          This item is no longer available
                        </p>
                      )}
                      
                      {/* Accept/Decline Buttons - Only for received offers */}
                      {message.is_offer && message.sender_id !== currentUserId && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to accept this barter offer?')) return;
                              
                              try {
                                // Find the offer
                                const { data: offers } = await supabase
                                  .from('barter_offers')
                                  .select('id')
                                  .eq('offered_item_id', message.offer_item_id!)
                                  .eq('requested_item_id', message.item_id)
                                  .eq('sender_id', message.sender_id)
                                  .eq('status', 'pending')
                                  .limit(1);
                                
                                if (!offers || offers.length === 0) {
                                  alert('Offer not found or already processed');
                                  return;
                                }
                                
                                // Update offer status
                                await supabase
                                  .from('barter_offers')
                                  .update({ status: 'accepted' })
                                  .eq('id', offers[0].id);
                                
                                // Send confirmation message
                                await supabase
                                  .from('messages')
                                  .insert([{
                                    sender_id: currentUserId,
                                    receiver_id: otherUserId,
                                    content: '✅ Barter offer accepted!',
                                    item_id: itemId,
                                    is_offer: false,
                                    read: false,
                                  }]);
                                
                                alert('Offer accepted successfully!');
                                // Refresh messages
                                window.location.reload();
                              } catch (error) {
                                console.error('Error accepting offer:', error);
                                alert('Failed to accept offer');
                              }
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            ✓ Accept
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // Find the offer
                                const { data: offers } = await supabase
                                  .from('barter_offers')
                                  .select('id')
                                  .eq('offered_item_id', message.offer_item_id!)
                                  .eq('requested_item_id', message.item_id)
                                  .eq('sender_id', message.sender_id)
                                  .eq('status', 'pending')
                                  .limit(1);
                                
                                if (!offers || offers.length === 0) {
                                  alert('Offer not found or already processed');
                                  return;
                                }
                                
                                // Update offer status
                                await supabase
                                  .from('barter_offers')
                                  .update({ status: 'declined' })
                                  .eq('id', offers[0].id);
                                
                                // Send confirmation message
                                await supabase
                                  .from('messages')
                                  .insert([{
                                    sender_id: currentUserId,
                                    receiver_id: otherUserId,
                                    content: '❌ Barter offer declined',
                                    item_id: itemId,
                                    is_offer: false,
                                    read: false,
                                  }]);
                                
                                alert('Offer declined');
                                // Refresh messages
                                window.location.reload();
                              } catch (error) {
                                console.error('Error declining offer:', error);
                                alert('Failed to decline offer');
                              }
                            }}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            ✕ Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Message Reactions */}
                  <MessageReactions
                    messageId={message.id}
                    currentUserId={currentUserId}
                  />
                  
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-70">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </p>
                    
                    <ReadReceipt
                      message={{
                        read: message.read,
                        read_at: message.read_at || null,
                        created_at: message.created_at,
                        sender_id: message.sender_id
                      }}
                      currentUserId={currentUserId}
                    />
                  </div>
                  </div>
                </SwipeToReply>
              </div>
            ))}
            {otherUserTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <form onSubmit={sendMessage} className="p-4 border-t">
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
            onClick={() => setShowAttachmentMenu(true)}
            disabled={uploading}
            className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            title="Attach"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={sending || uploading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || uploading}
            className="btn-primary flex items-center"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5 mr-1" />
                Send
              </>
            )}
          </button>
        </div>
      </form>
      </div>

      {/* File Attachment Modal */}
      {showFileAttachment && (
        <FileAttachment
          onFileUpload={handleFileUpload}
          onClose={() => setShowFileAttachment(false)}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}

      {/* Voice Message Modal */}
      {showVoiceMessage && (
        <VoiceMessage
          onSend={handleVoiceMessageUpload}
          onCancel={() => setShowVoiceMessage(false)}
          isVisible={showVoiceMessage}
        />
      )}


      {/* Offer Templates Modal */}
      {showOfferTemplates && (
        <OfferTemplates
          currentUserId={currentUserId}
          onTemplateSelect={(template) => {
            setNewMessage(template.content);
            setShowOfferTemplates(false);
          }}
          onClose={() => setShowOfferTemplates(false)}
          isVisible={showOfferTemplates}
        />
      )}

      {/* Bulk Offers Modal */}
      {showBulkOffers && (
        <BulkOffers
          currentUserId={currentUserId}
          targetUserId={otherUserId}
          onOffersSent={(count) => {
            console.log(`${count} offers sent`);
            setShowBulkOffers(false);
          }}
          onClose={() => setShowBulkOffers(false)}
          isVisible={showBulkOffers}
        />
      )}

      {/* Counter Offers Modal */}
      {showCounterOffers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Counter Offers</h3>
              <button
                onClick={() => setShowCounterOffers(null)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CounterOffers
                currentUserId={currentUserId}
                offerId={showCounterOffers}
                onCounterOfferResponse={(counterOfferId, status) => {
                  console.log(`Counter offer ${counterOfferId} ${status}`);
                }}
              />
            </div>
          </div>
        </div>
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
              currentUserId={currentUserId}
              onReactionChange={() => setShowReactionPicker(null)}
            />
          </div>
        </div>
      )}

      {/* Attachment Menu Modal */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onCamera={() => fileInputRef.current?.click()}
        onDocument={() => setShowFileAttachment(true)}
        onVoice={() => setShowVoiceMessage(true)}
      />

      {/* Context Menu */}
      <MessageContextMenu
        visible={showContextMenu}
        x={contextMenuPosition.x}
        y={contextMenuPosition.y}
        onClose={() => setShowContextMenu(false)}
        onReact={() => {
          if (contextMenuMessageId) {
            setShowReactionPicker(contextMenuMessageId);
          }
        }}
        onReply={() => {
          if (contextMenuMessageId) {
            const message = messages.find(m => m.id === contextMenuMessageId);
            if (message) {
              handleReplyToMessage(message.id, message.content, message.sender?.username || 'Unknown');
            }
          }
        }}
        onCopy={() => {
          if (contextMenuMessageId) {
            const message = messages.find(m => m.id === contextMenuMessageId);
            if (message) {
              handleCopyMessage(message.content);
            }
          }
        }}
        onDelete={() => {
          if (contextMenuMessageId) {
            handleDeleteMessage(contextMenuMessageId);
          }
        }}
        isOwnMessage={contextMenuMessageId ? messages.find(m => m.id === contextMenuMessageId)?.sender_id === currentUserId : false}
      />
    </div>
  );
}