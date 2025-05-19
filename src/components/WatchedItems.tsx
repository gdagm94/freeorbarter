import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ItemCard from './ItemCard';
import { Item } from '../types';

interface WatchedItemsProps {
  userId: string;
}

export function WatchedItems({ userId }: WatchedItemsProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWatchedItems = async () => {
      try {
        const { data, error } = await supabase
          .from('watched_items')
          .select(`
            item_id,
            items (*)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Extract items and filter out any null values (deleted items)
        const watchedItems = data
          .map(row => row.items)
          .filter((item): item is Item => item !== null);

        setItems(watchedItems);
      } catch (err) {
        console.error('Error fetching watched items:', err);
        setError('Failed to load watched items');
      } finally {
        setLoading(false);
      }
    };

    fetchWatchedItems();

    // Subscribe to changes
    const subscription = supabase
      .channel('watched_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watched_items',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchWatchedItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(n => (
          <div key={n} className="bg-gray-200 h-48 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No watched items yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {items.map(item => (
        <ItemCard
          key={item.id}
          id={item.id}
          title={item.title}
          description={item.description}
          image={item.images[0]}
          images={item.images}
          condition={item.condition}
          location={item.location}
          type={item.type}
        />
      ))}
    </div>
  );
}