import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MessageList } from '../components/MessageList';
import { User, MessageCircle, Bell, CheckCircle, ArrowRight, Archive, Flag, ChevronLeft, Undo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Conversation } from '../types';
import { useSwipeable } from 'react-swipeable';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate UUID helper function
const isValidUUID = (uuid: string): boolean => {
  return UUID_REGEX.test(uuid);
};

// Extract IDs from conversation ID
const extractConversationIds = (conversationId: string): { itemId: string | null; otherUserId: string | null } => {
  const parts = conversationId.split('-');
  if (parts.length < 5) return { itemId: null, otherUserId: null };
  
  // Reconstruct the UUIDs from the parts
  const itemId = parts.slice(0, 5).join('-');
  const otherUserId = parts.slice(5).join('-');
  
  if (!isValidUUID(itemId) || !isValidUUID(otherUserId)) {
    return { itemId: null, otherUserId: null };
  }
  
  return { itemId, otherUserId };
};

// New component for conversation item
const ConversationItem = ({ 
  conversation, 
  isActive, 
  onArchive,
  onClick,
  isMobile 
}: { 
  conversation: Conversation;
  isActive: boolean;
  onArchive: (id: string, archived: boolean) => void;
  onClick: () => void;
  isMobile: boolean;
}) => {
  const swipeableHandlers = useSwipeable({
    onSwipedLeft: () => onArchive(conversation.id, !conversation.archived),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  return (
    <div
      {...swipeableHandlers}
      className={`rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer ${
        isActive 
          ? 'bg-indigo-50 border-2 border-indigo-500' 
          : 'bg-white'
      } ${
        conversation.unread_count > 0 ? 'border-l-4 border-indigo-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-4">
        {conversation.other_user_avatar ? (
          <img
            src={conversation.other_user_avatar}
            alt={conversation.other_user_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${
              isActive 
                ? 'text-indigo-700' 
                : 'text-gray-900'
            } truncate`}>
              {conversation.other_user_name}
            </h3>
            <span className="text-sm text-gray-500">
              {format(new Date(conversation.last_message_time), 'MMM d, h:mm a')}
            </span>
          </div>
          <p className={`${
            isActive 
              ? 'text-indigo-600' 
              : 'text-gray-600'
          } truncate ${conversation.unread_count > 0 ? 'font-semibold' : ''}`}>
            {conversation.last_message}
          </p>
          <div className="mt-2 flex items-center space-x-2">
            <img
              src={conversation.item_image}
              alt={conversation.item_title}
              className="w-8 h-8 rounded object-cover"
            />
            <span className={`text-sm ${
              isActive 
                ? 'text-indigo-600' 
                : 'text-gray-500'
            } truncate`}>
              {conversation.item_title}
            </span>
          </div>
          
          {conversation.has_offer && (
            <div className="mt-2 flex items-center">
              <div className="flex-1 flex items-center">
                <div className="w-6 h-6 flex items-center justify-center">
                  <ArrowRight className={`w-4 h-4 ${
                    isActive 
                      ? 'text-indigo-400' 
                      : 'text-gray-400'
                  }`} />
                </div>
                <div className="flex items-center ml-1">
                  {conversation.offer_item_image && (
                    <img
                      src={conversation.offer_item_image}
                      alt={conversation.offer_item_title}
                      className="w-6 h-6 rounded object-cover mr-1"
                    />
                  )}
                  <span className="text-xs text-indigo-600 truncate">Barter offer</span>
                </div>
              </div>
              
              {conversation.unread_count > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {conversation.unread_count}
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(conversation.id, !conversation.archived);
              }}
              className="p-1 hover:bg-gray-100 rounded-full"
              title={conversation.archived ? "Unarchive conversation" : "Archive conversation"}
            >
              {conversation.archived ? (
                <Undo className="w-4 h-4 text-gray-500" />
              ) : (
                <Archive className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MessagesProps {
  onUnreadCountChange: (count: number) => void;
  onUnreadOffersChange: (count: number) => void;
}

function Messages({ onUnreadCountChange, onUnreadOffersChange }: MessagesProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'offers' | 'unread' | 'archived'>('all');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            items:item_id (
              id,
              title,
              images,
              user_id,
              type
            ),
            offer_item:offer_item_id (
              id,
              title,
              images
            ),
            sender:sender_id (
              username,
              avatar_url
            ),
            receiver:receiver_id (
              username,
              avatar_url
            )
          `)
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (messagesError) throw messagesError;

        const conversationMap = new Map<string, Conversation>();
        const unreadCountMap = new Map<string, number>();
        let totalUnread = 0;
        let totalUnreadOffers = 0;

        messagesData?.forEach(message => {
          if (message.receiver_id === user.id && !message.read) {
            totalUnread++;
            if (message.is_offer) {
              totalUnreadOffers++;
            }
          }

          const itemId = message.item_id;
          const itemOwnerId = message.items?.user_id;
          
          if (!message.items || !isValidUUID(itemId) || !isValidUUID(itemOwnerId)) return;
          
          const senderId = message.sender_id;
          const receiverId = message.receiver_id;
          
          if (!isValidUUID(senderId) || !isValidUUID(receiverId)) return;
          
          const isItemOwner = user.id === itemOwnerId;
          const otherUserId = isItemOwner ? 
            (senderId !== user.id ? senderId : receiverId) : 
            itemOwnerId;
          
          if (!isValidUUID(otherUserId) || senderId === receiverId) return;
          
          const conversationId = `${itemId}-${otherUserId}`;
          
          if (message.receiver_id === user.id && !message.read) {
            unreadCountMap.set(
              conversationId, 
              (unreadCountMap.get(conversationId) || 0) + 1
            );
          }
          
          if (!conversationMap.has(conversationId)) {
            const otherUserInfo = message.sender_id === otherUserId 
              ? message.sender 
              : message.receiver;
            
            const hasOffer = messagesData.some(
              msg => msg.item_id === itemId && 
                    ((msg.sender_id === otherUserId && msg.receiver_id === user.id) || 
                     (msg.sender_id === user.id && msg.receiver_id === otherUserId)) && 
                    msg.offer_item_id
            );
            
            conversationMap.set(conversationId, {
              id: conversationId,
              item_id: itemId,
              item_title: message.items.title,
              item_image: message.items.images[0],
              other_user_id: otherUserId,
              other_user_name: otherUserInfo?.username || 'User',
              other_user_avatar: otherUserInfo?.avatar_url,
              last_message: message.content,
              last_message_time: message.created_at,
              unread_count: 0,
              offer_item_id: message.offer_item_id,
              offer_item_title: message.offer_items?.title,
              offer_item_image: message.offer_items?.images?.[0],
              has_offer: hasOffer,
              archived: message.archived
            });
          }
        });

        unreadCountMap.forEach((count, id) => {
          const conversation = conversationMap.get(id);
          if (conversation) {
            conversation.unread_count = count;
          }
        });

        setConversations(Array.from(conversationMap.values()));
        onUnreadCountChange(totalUnread);
        onUnreadOffersChange(totalUnreadOffers);

      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    const subscription = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, onUnreadCountChange, onUnreadOffersChange]);

  const handleConversationClick = async (conversationId: string) => {
    const { itemId, otherUserId } = extractConversationIds(conversationId);
    
    if (!itemId || !otherUserId) {
      console.error('Invalid conversation ID format:', conversationId);
      return;
    }

    setActiveConversation(conversationId);
    
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation && conversation.unread_count > 0) {
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );
    }
  };

  const handleArchive = async (conversationId: string, archived: boolean) => {
    const { itemId, otherUserId } = extractConversationIds(conversationId);
    
    if (!itemId || !otherUserId) {
      console.error('Invalid conversation ID format:', conversationId);
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ archived })
        .eq('item_id', itemId)
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user?.id})`);

      if (error) throw error;

      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, archived }
            : conv
        )
      );

      if (!archived && filter === 'archived') {
        setFilter('all');
      }
    } catch (err) {
      console.error('Error updating archive status:', err);
    }
  };

  const handleReport = async () => {
    if (!reportingMessage || !user || !isValidUUID(reportingMessage)) return;

    try {
      const { error } = await supabase
        .from('reported_messages')
        .insert([
          {
            message_id: reportingMessage,
            reporter_id: user.id,
            reason: reportReason
          }
        ]);

      if (error) throw error;
    } catch (err) {
      console.error('Error reporting message:', err);
    } finally {
      setReportingMessage(null);
      setReportReason('');
      setShowReportDialog(false);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (!isMobile || !activeConversation) return;
      const conversation = conversations.find(c => c.id === activeConversation);
      if (conversation) {
        handleArchive(activeConversation, !conversation.archived);
      }
    },
    onSwipedRight: () => {
      if (!isMobile || !activeConversation) return;
      setActiveConversation(null);
    }
  });

  const filteredConversations = conversations.filter(conv => {
    switch (filter) {
      case 'offers':
        return conv.has_offer && !conv.archived;
      case 'unread':
        return conv.unread_count > 0 && !conv.archived;
      case 'archived':
        return conv.archived;
      default:
        return !conv.archived;
    }
  });

  const { itemId, otherUserId } = activeConversation
    ? extractConversationIds(activeConversation)
    : { itemId: null, otherUserId: null };

  const isValidConversation = itemId && otherUserId;

  const activeConversationData = conversations.find(c => c.id === activeConversation);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Please sign in to view your messages</h1>
        <p className="text-gray-600">You need to be logged in to access your messages.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      
      {conversations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">You don't have any messages yet.</p>
          <Link to="/" className="btn-primary">Browse Items</Link>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Conversation list */}
          <div className={`md:w-1/3 ${activeConversation && isMobile ? 'hidden' : ''}`}>
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 mx-auto mb-1" />
                  <span>All</span>
                </button>
                <button
                  onClick={() => setFilter('offers')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    filter === 'offers'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bell className="w-4 h-4 mx-auto mb-1" />
                  <span>Offers</span>
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 mx-auto mb-1" />
                  <span>Unread</span>
                </button>
                <button
                  onClick={() => setFilter('archived')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    filter === 'archived'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Archive className="w-4 h-4 mx-auto mb-1" />
                  <span>Archived</span>
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredConversations.length > 0 ? (
                filteredConversations.map(conversation => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={activeConversation === conversation.id}
                    onArchive={handleArchive}
                    onClick={() => handleConversationClick(conversation.id)}
                    isMobile={isMobile}
                  />
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-md p-4 text-center text-gray-600">
                  No {filter === 'offers' ? 'offers' : filter === 'unread' ? 'unread messages' : filter === 'archived' ? 'archived messages' : 'messages'} found
                </div>
              )}
            </div>
          </div>

          {/* Message thread */}
          {activeConversation && isValidConversation ? (
            <div 
              {...swipeHandlers}
              className={`md:w-2/3 bg-white rounded-lg shadow-md overflow-hidden ${
                !activeConversation || !isMobile ? 'hidden md:block' : ''
              }`}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center">
                  {isMobile && (
                    <button 
                      className="mr-2 text-gray-600"
                      onClick={() => setActiveConversation(null)}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {activeConversationData?.item_title || 'Loading...'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      with {activeConversationData?.other_user_name || 'User'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {activeConversationData?.has_offer && (
                    <div className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Barter Offer
                    </div>
                  )}
                  {activeConversationData && (
                    <Link 
                      to={`/items/${activeConversationData.item_id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      View Item
                    </Link>
                  )}
                </div>
              </div>
              
              <MessageList 
                itemId={itemId} 
                currentUserId={user.id}
                otherUserId={otherUserId}
                onMessageRead={() => {
                  setConversations(prev =>
                    prev.map(conv =>
                      conv.id === activeConversation
                        ? { ...conv, unread_count: 0 }
                        : conv
                    )
                  );
                }}
              />
            </div>
          ) : (
            <div className="hidden md:block md:w-2/3 bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">Select a conversation to view messages</p>
            </div>
          )}
        </div>
      )}

      {/* Report Message Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Report Message</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why are you reporting this message?"
              className="w-full rounded-lg border border-gray-300 p-2 mb-4"
              rows={4}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReportDialog(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                disabled={!reportReason.trim()}
              >
                Report Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages;