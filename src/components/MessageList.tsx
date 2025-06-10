import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCheck } from 'lucide-react';
import pusherClient from '../lib/pusher';
import { debounce } from 'throttle-debounce';

interface MessageListProps {
  itemId: string | null; // Made nullable for direct messages
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message'; // Added conversation type
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

      // Apply different filters based on conversation type
      if (conversationType === 'direct_message') {
        query = query.is('item_id', null);
      } else if (itemId) {
        query = query.eq('item_id', itemId);
      }

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

  // Debounced function to emit typing status
  const emitTypingStatus = debounce(1000, async (isTyping: boolean) => {
    try {
      const channelName = conversationType === 'direct_message' 
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
            )
          `)
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });

        // Apply different filters based on conversation type
        if (conversationType === 'direct_message') {
          query = query.is('item_id', null);
        } else if (itemId) {
          query = query.eq('item_id', itemId);
        }

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
    const channelName = conversationType === 'direct_message' 
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
            )
          `)
          .eq('id', data.messageId)
          .single();

        if (error) {
          console.error('Error fetching new message:', error);
          return;
        }

        // Check if this message belongs to the current conversation
        const messageMatches = conversationType === 'direct_message'
          ? newMessage.item_id === null &&
            ((newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) || 
             (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId))
          : newMessage.item_id === itemId &&
            ((newMessage.sender_id === currentUserId && newMessage.receiver_id === otherUserId) || 
             (newMessage.sender_id === otherUserId && newMessage.receiver_id === currentUserId));

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const messageContent = newMessage.trim();
      setNewMessage('');
      setIsTyping(false);
      emitTypingStatus(false);

      const { data, error } = await supabase.from('messages').insert([
        {
          content: messageContent,
          item_id: conversationType === 'direct_message' ? null : itemId,
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
        )
      `).single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);

        // Trigger Pusher event for new message
        const channelName = conversationType === 'direct_message' 
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
                  
                  <p>{message.content}</p>
                  
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
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button type="submit" className="btn-primary">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}