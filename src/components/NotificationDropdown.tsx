import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCheck, User, Package, MessageCircle, Star, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Notification } from '../types';

interface NotificationDropdownProps {
  onClose: () => void;
  onNotificationRead: () => void;
  onMarkAllAsRead: () => void;
}

export function NotificationDropdown({ onClose, onNotificationRead, onMarkAllAsRead }: NotificationDropdownProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchNotifications = async (options?: { skipLoading?: boolean }) => {
      try {
        if (!options?.skipLoading) setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:sender_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

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
      .channel(`notifications-dropdown-${user.id}`)
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
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);

        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        onNotificationRead();
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
    }

    onClose();
    // Use window.location for navigation to ensure proper routing
    window.location.href = path;
  };

  const handleMarkAllAsReadClick = async () => {
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
      onMarkAllAsRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_request_approved':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'new_listing':
        return <Package className="w-5 h-5 text-green-500" />;
      case 'direct_message':
        return <MessageCircle className="w-5 h-5 text-indigo-500" />;
      case 'watchlist_update':
        return <Star className="w-5 h-5 text-yellow-500" />;
      default:
        return <User className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 top-full mt-2 w-[calc(100vw-64px)] md:w-80 mx-8 md:mx-0 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          {notifications.some(n => !n.read) && (
            <button
              onClick={handleMarkAllAsReadClick}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {notification.sender?.avatar_url ? (
                      <img
                        src={notification.sender.avatar_url}
                        alt={notification.sender.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <Link
          to="/notifications"
          onClick={onClose}
          className="block text-center text-sm text-indigo-600 hover:text-indigo-800"
        >
          View All Notifications
        </Link>
      </div>
    </div>
  );
}