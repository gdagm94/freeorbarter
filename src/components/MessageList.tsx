import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCheck, Image as ImageIcon, Send } from 'lucide-react';
import pusherClient from '../lib/pusher';
import { debounce } from 'throttle-debounce';

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
    setNewMessage(e.target.value);
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
            channel: `private-user-${otherUserId}`,
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

  return (
    <div className="flex flex-col h-[500px]">
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
                className={`flex ${
                  message.sender_id === currentUserId ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender_id === currentUserId
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100'
                  }`}
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
                        className="max-w-full h-auto rounded-lg cursor-pointer"
                        onClick={() => window.open(message.image_url, '_blank')}
                      />
                    </div>
                  )}
                  
                  {/* Message Content */}
                  {message.content && (
                    <p>{message.content}</p>
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
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-70">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </p>
                    
                    {message.sender_id === currentUserId && (
                      <span className="ml-2">
                        {message.read ? (
                          <CheckCheck className="w-3 h-3 text-indigo-200" />
                        ) : (
                          <Check className="w-3 h-3 text-indigo-200" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
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
  );
}