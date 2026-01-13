import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface WatchButtonProps {
  itemId: string;
  onAuthRequired?: () => void;
}

export function WatchButton({ itemId, onAuthRequired }: WatchButtonProps) {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkWatchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('watched_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', itemId);

        // If we get any rows back, the item is being watched
        setIsWatched(data && data.length > 0);
      } catch (error) {
        console.error('Error checking watch status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkWatchStatus();
  }, [user, itemId]);

  const handleClick = async () => {
    if (!user) {
      onAuthRequired?.();
      return;
    }

    setLoading(true);
    try {
      if (isWatched) {
        // Remove from watched items
        const { error } = await supabase
          .from('watched_items')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', itemId);

        if (error) throw error;
        setIsWatched(false);
      } else {
        // Add to watched items
        const { error } = await supabase
          .from('watched_items')
          .insert([{ user_id: user.id, item_id: itemId }]);

        if (error) throw error;
        setIsWatched(true);
      }
      // Pusher notification removed
    } catch (error) {
      console.error('Error updating watch status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${isWatched
          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
    >
      <Star className={`w-5 h-5 ${isWatched ? 'fill-current' : ''}`} />
      <span className="text-sm font-medium">
        {loading ? '...' : isWatched ? 'Watching' : 'Watch'}
      </span>
    </button>
  );
}