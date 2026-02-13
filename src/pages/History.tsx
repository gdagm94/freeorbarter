import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft, Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import ItemCard from '../components/ItemCard';
import { Item } from '../types';

interface HistoryEntry {
  id: string;
  action_type: 'created' | 'edited' | 'deleted';
  item_id: string | null;
  item_title: string;
  item_description: string | null;
  item_images: string[];
  item_category: string;
  item_condition: string;
  item_type: string;
  changes: any;
  created_at: string;
}

function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'archived' | 'history'>('archived');

  useEffect(() => {
    // Only redirect if auth is finished loading and there's no user
    if (!authLoading && !user) {
      navigate('/');
      return;
    }

    // Don't fetch items until auth is loaded and we have a user
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        // Fetch archived items
        const { data: archivedData, error: archivedError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['traded', 'claimed'])
          .order('created_at', { ascending: false });

        if (archivedError) throw archivedError;

        // Fetch history entries
        const { data: historyData, error: historyError } = await supabase
          .from('user_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (historyError) throw historyError;

        setItems(archivedData || []);
        setHistoryEntries(historyData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to changes
    const subscription = supabase
      .channel('history-data')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_history',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
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

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'edited':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'deleted':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionText = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'Created listing';
      case 'edited':
        return 'Edited listing';
      case 'deleted':
        return 'Deleted listing';
      default:
        return 'Unknown action';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('archived')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'archived'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Completed Trades ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              All Activity ({historyEntries.length})
            </button>
          </nav>
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
      ) : activeTab === 'archived' ? (
        items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Completed Trades</h2>
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
        )
      ) : (
        historyEntries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Activity</h2>
            <p className="text-gray-600">Your listing activity will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyEntries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {getActionIcon(entry.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {getActionText(entry.action_type)}
                      </h3>
                      <time className="text-sm text-gray-500">
                        {formatDate(entry.created_at)}
                      </time>
                    </div>
                    <p className="text-gray-600 mt-1">{entry.item_title}</p>
                    {entry.item_description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {entry.item_description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                      <span className="capitalize">{entry.item_category}</span>
                      <span className="capitalize">{entry.item_condition}</span>
                      <span className="capitalize">{entry.item_type}</span>
                    </div>
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Changes made:</h4>
                        <div className="space-y-1">
                          {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                            <div key={field} className="text-sm text-gray-600">
                              <span className="font-medium capitalize">{field}:</span>{' '}
                              <span className="line-through text-red-500">{change.old}</span>{' '}
                              → <span className="text-green-600">{change.new}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default History;