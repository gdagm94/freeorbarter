import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        if (error) throw error;
        if (!isMounted) return;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('Error fetching unread notifications count:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel(`notifications-count-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchUnreadCount()
      )
      .subscribe();

    const fallbackInterval = setInterval(fetchUnreadCount, 60000);

    return () => {
      isMounted = false;
      channel.unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleNotificationRead = () => {
    // Decrease unread count when a notification is marked as read
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={handleBellClick}
        className="nav-link relative"
        aria-label="Notifications"
      >
        <div className="relative">
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2">
              <span className="flex h-5 w-5">
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500">
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              </span>
            </div>
          )}
        </div>
        <span className="hidden md:block">Notifications</span>
      </button>

      {showDropdown && (
        <NotificationDropdown
          onClose={() => setShowDropdown(false)}
          onNotificationRead={handleNotificationRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />
      )}
    </div>
  );
}