import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { MessageList } from '../components/MessageList';
import { User, MessageCircle, Bell, CheckCircle, ArrowRight, Archive, ChevronLeft, Undo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Conversation } from '../types';
import { useSwipeable } from 'react-swipeable';
import { ReportContentDialog } from '../components/ReportContentDialog';
import { ReportTargetType } from '../lib/reports';

type ReportDialogPayload = {
  targetType: ReportTargetType;
  targetId: string;
  subject?: string;
  metadata?: Record<string, unknown>;
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate UUID helper function
const isValidUUID = (uuid: string): boolean => {
  return UUID_REGEX.test(uuid);
};

// New component for conversation item
const ConversationItem = ({ 
  conversation, 
  isActive, 
  onArchive,
  onClick
}: { 
  conversation: Conversation;
  isActive: boolean;
  onArchive: (id: string, archived: boolean) => void;
  onClick: () => void;
}) => {
  const swipeableHandlers = useSwipeable({
    onSwipedLeft: () => onArchive(conversation.id, !conversation.archived),
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
          
          {/* Show recent item context if available */}
          {conversation.recent_item_title && (
            <div className="mt-2 flex items-center space-x-2">
              {conversation.recent_item_image && (
                <img
                  src={conversation.recent_item_image}
                  alt={conversation.recent_item_title}
                  className="w-6 h-6 rounded object-cover"
                />
              )}
              <span className={`text-xs ${
                isActive 
                  ? 'text-indigo-500' 
                  : 'text-gray-400'
              } truncate`}>
                About: {conversation.recent_item_title}
              </span>
            </div>
          )}
          
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
                      alt={conversation.offer_item_title || 'Barter offer item'}
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
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'offers' | 'unread' | 'archived'>('all');
  const [reportDialog, setReportDialog] = useState<ReportDialogPayload | null>(null);
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

        // Group messages by user pairs (regardless of item)
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

          // Determine the other user
          const otherUserId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
          
          if (!isValidUUID(otherUserId)) return;

          // Create conversation ID based on user pair (sorted for consistency) - using underscores as delimiter
          const sortedUserIds = [user.id, otherUserId].sort();
          const conversationId = `user_${sortedUserIds[0]}_${sortedUserIds[1]}`;

          // Track unread counts
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
            
            // Check if this user has any offers across all messages
            const hasOffer = messagesData.some(
              msg => {
                const msgOtherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                return msgOtherUserId === otherUserId && msg.offer_item_id;
              }
            );

            // Find the most recent item mentioned in conversations with this user
            const recentItemMessage = messagesData
              .filter(msg => {
                const msgOtherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                return msgOtherUserId === otherUserId && msg.items;
              })
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            
            conversationMap.set(conversationId, {
              id: conversationId,
              type: 'unified', // New type for unified conversations
              item_id: null, // Not tied to a specific item
              item_title: null,
              item_image: null,
              recent_item_title: recentItemMessage?.items?.title || null,
              recent_item_image: recentItemMessage?.items?.images?.[0] || null,
              other_user_id: otherUserId,
              other_user_name: otherUserInfo?.username || 'User',
              other_user_avatar: otherUserInfo?.avatar_url,
              last_message: message.content,
              last_message_time: message.created_at,
              unread_count: 0,
              offer_item_id: message.offer_item_id,
              offer_item_title: message.offer_item?.title,
              offer_item_image: message.offer_item?.images?.[0],
              has_offer: hasOffer,
              archived: message.archived
            });
          } else {
            // Update with more recent message if this one is newer
            const existing = conversationMap.get(conversationId)!;
            if (new Date(message.created_at) > new Date(existing.last_message_time)) {
              existing.last_message = message.content;
              existing.last_message_time = message.created_at;
              
              // Update recent item info if this message has an item
              if (message.items) {
                existing.recent_item_title = message.items.title;
                existing.recent_item_image = message.items.images?.[0] || null;
              }
            }
          }
        });

        // Apply unread counts
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
      } finally {
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
    // Extract other user ID from conversation ID - using underscores as delimiter
    const parts = conversationId.split('_');
    if (parts.length !== 3 || parts[0] !== 'user') {
      console.error('Invalid conversation ID format:', conversationId);
      return;
    }

    const userId1 = parts[1];
    const userId2 = parts[2];
    const otherUserId = userId1 === user?.id ? userId2 : userId1;

    if (!isValidUUID(otherUserId)) {
      console.error('Invalid user ID in conversation:', otherUserId);
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
    // Extract other user ID from conversation ID - using underscores as delimiter
    const parts = conversationId.split('_');
    if (parts.length !== 3 || parts[0] !== 'user') {
      console.error('Invalid conversation ID format:', conversationId);
      return;
    }

    const userId1 = parts[1];
    const userId2 = parts[2];
    const otherUserId = userId1 === user?.id ? userId2 : userId1;

    if (!isValidUUID(otherUserId)) {
      console.error('Invalid user ID in conversation:', otherUserId);
      return;
    }

    try {
      // Archive all messages between these two users
      const { error } = await supabase
        .from('messages')
        .update({ archived })
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

  const openReportDialog = (payload: ReportDialogPayload) => {
    setReportDialog(payload);
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

  // Extract other user ID for MessageList - using underscores as delimiter
  const getOtherUserId = (conversationId: string): string | null => {
    const parts = conversationId.split('_');
    if (parts.length !== 3 || parts[0] !== 'user') return null;
    
    const userId1 = parts[1];
    const userId2 = parts[2];
    return userId1 === user?.id ? userId2 : userId1;
  };

  const activeConversationData = conversations.find(c => c.id === activeConversation);
  const otherUserId = activeConversation ? getOtherUserId(activeConversation) : null;

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
          {activeConversation && otherUserId ? (
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
                      {activeConversationData?.other_user_name || 'User'}
                    </h3>
                    {activeConversationData?.recent_item_title && (
                      <p className="text-sm text-gray-600">
                        Recent: {activeConversationData.recent_item_title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {activeConversationData?.has_offer && (
                    <div className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Barter Offer
                    </div>
                  )}
                </div>
              </div>
              
              <MessageList 
                itemId={null} // Pass null for unified conversations
                currentUserId={user.id}
                otherUserId={otherUserId}
                conversationType="unified" // New conversation type
                onMessageRead={() => {
                  setConversations(prev =>
                    prev.map(conv =>
                      conv.id === activeConversation
                        ? { ...conv, unread_count: 0 }
                        : conv
                    )
                  );
                }}
                onReportMessage={(messageId, snippet) => {
                  if (!messageId) return;
                  openReportDialog({
                    targetType: 'message',
                    targetId: messageId,
                    subject: 'this message',
                    metadata: {
                      source: 'web_messages',
                      snippet,
                      conversationId: activeConversation || undefined,
                    },
                  });
                }}
                onReportUser={() => {
                  if (!otherUserId) return;
                  openReportDialog({
                    targetType: 'user',
                    targetId: otherUserId,
                    subject: activeConversationData?.other_user_name || undefined,
                    metadata: {
                      source: 'web_messages',
                      conversationId: activeConversation || undefined,
                    },
                  });
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

      {reportDialog && (
        <ReportContentDialog
          open={!!reportDialog}
          onClose={() => setReportDialog(null)}
          targetId={reportDialog.targetId}
          targetType={reportDialog.targetType}
          subject={reportDialog.subject}
          metadata={reportDialog.metadata}
        />
      )}
    </div>
  );
}

export default Messages;