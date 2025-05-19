import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import ItemCard from '../components/ItemCard';
import { Item } from '../types';

function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only redirect if auth is finished loading and there's no user
    if (!authLoading && !user) {
      navigate('/');
      return;
    }

    // Don't fetch items until auth is loaded and we have a user
    if (authLoading || !user) return;

    const fetchArchivedItems = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['traded', 'claimed'])
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setItems(data || []);
      } catch (err) {
        console.error('Error fetching archived items:', err);
        setError('Failed to load archived items');
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedItems();

    // Subscribe to changes
    const subscription = supabase
      .channel('archived-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchArchivedItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, navigate, authLoading]);

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(n => (
              <div key={n}>
                <div className="bg-gray-200 h-48 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if there's no user (will redirect)
  if (!user) {
    return null;
  }

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
          <h1 className="text-2xl font-bold">History</h1>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="animate-pulse">
              <div className="bg-gray-200 h-48 rounded-lg mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No History Yet</h2>
          <p className="text-gray-600">
            Items that have been claimed or traded will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="relative">
              <ItemCard
                id={item.id}
                title={item.title}
                description={item.description}
                image={item.images[0]}
                images={item.images}
                condition={item.condition}
                location={item.location}
                type={item.type}
                status={item.status}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;