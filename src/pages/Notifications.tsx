import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, CheckCheck, User, Package, MessageCircle, Star, UserPlus, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Notification } from '../types';
import { NotificationSettings } from '../components/NotificationSettings';

function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }

    if (!user) return;

    let isMounted = true;

    const fetchNotifications = async (options?: { skipLoading?: boolean }) => {
      try {
        if (!options?.skipLoading) setLoading(true);
        let query = supabase
          .from('notifications')
          .select(`
            *,
            sender:users!notifications_sender_id_fkey (
              id,
              username,
              avatar_url
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (filter === 'unread') {
          query = query.eq('read', false);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!isMounted) return;
        setNotifications(data || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        if (!options?.skipLoading && isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications({ skipLoading: true })
      )
      .subscribe();

    const fallbackInterval = setInterval(() => fetchNotifications({ skipLoading: true }), 60000);

    return () => {
      isMounted = false;
      channel.unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [user, authLoading, navigate, filter]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      try {
        if (notification.type === 'direct_message' && notification.sender_id) {
          // Batch-dismiss all direct_message notifications from this sender
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user!.id)
            .eq('sender_id', notification.sender_id)
            .eq('type', 'direct_message')
            .eq('read', false);
          window.dispatchEvent(new Event('notifications-updated'));

          setNotifications(prev =>
            prev.map(n =>
              (n.type === 'direct_message' && n.sender_id === notification.sender_id)
                ? { ...n, read: true }
                : n
            )
          );
        } else {
          // For non-message notifications, mark only the clicked one
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notification.id);

          setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
          );
        }
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }

    // Navigate based on notification type
    let path = '/';
    switch (notification.type) {
      case 'friend_request':
        path = '/profile'; // Navigate to profile to see friend requests
        break;
      case 'friend_request_approved':
        path = `/users/${notification.related_id}`;
        break;
      case 'new_listing':
        path = `/items/${notification.related_id}`;
        break;
      case 'direct_message':
        path = '/messages';
        break;
      case 'watchlist_update':
        path = `/items/${notification.related_id}`;
        break;
      case 'welcome':
        path = '/profile';
        break;
    }

    navigate(path);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_request_approved':
        return <UserPlus className="w-6 h-6 text-blue-500" />;
      case 'new_listing':
        return <Package className="w-6 h-6 text-green-500" />;
      case 'direct_message':
        return <MessageCircle className="w-6 h-6 text-indigo-500" />;
      case 'watchlist_update':
        return <Star className="w-6 h-6 text-yellow-500" />;
      case 'welcome':
        return <UserPlus className="w-6 h-6 text-indigo-500" />;
      default:
        return <User className="w-6 h-6 text-gray-500" />;
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-gray-200 h-16 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-indigo-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <div className="flex items-center space-x-4">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read ({unreadCount})
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-600 hover:text-indigo-600"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 px-4 text-center ${filter === 'all'
              ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-3 px-4 text-center ${filter === 'unread'
              ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-gray-600">
              {filter === 'unread'
                ? 'All caught up! Check back later for new notifications.'
                : 'When you receive notifications, they\'ll appear here.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-6 text-left hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50' : ''
                  }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {notification.sender?.avatar_url ? (
                      <img
                        src={notification.sender.avatar_url}
                        alt={notification.sender?.username || undefined}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {notification.content}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {format(new Date(notification.created_at || ''), 'MMMM d, yyyy \'at\' h:mm a')}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notification Settings Modal */}
      {showSettings && (
        <NotificationSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default Notifications;