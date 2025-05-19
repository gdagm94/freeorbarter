import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, User, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ItemCard from '../components/ItemCard';
import { Item } from '../types';
import { UserShareDialog } from '../components/UserShareDialog';

interface UserProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
}

function UserProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'barter'>('free');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!id) return;

      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('id, username, avatar_url, rating, created_at')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('User not found');

        setProfile(profileData);

        // Fetch user's available items
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', id)
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('User not found');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Subscribe to item changes
    const subscription = supabase
      .channel('items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [payload.new as Item, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(item => item.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(item => 
              item.id === payload.new.id ? payload.new as Item : item
            ));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mt-8">
          <div className="animate-pulse">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-gray-200 h-48 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mt-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'User not found'}
          </h2>
          <Link to="/" className="btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const freeItems = items.filter(item => item.type === 'free');
  const barterItems = items.filter(item => item.type === 'barter');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
              <div className="flex items-center text-gray-600 mt-1">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="ml-1">{profile.rating?.toFixed(1) || 'No ratings yet'}</span>
              </div>
              <div className="text-gray-500 text-sm mt-1">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowShareDialog(true)}
            className="bg-gray-100 p-2 rounded-full shadow-sm hover:bg-gray-200 transition-colors"
            title="Share Profile"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b">
          <div className="flex">
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 text-center ${
                activeTab === 'free'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('free')}
            >
              Free ({freeItems.length})
            </button>
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 text-center ${
                activeTab === 'barter'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('barter')}
            >
              Barter ({barterItems.length})
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'free' ? (
            freeItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                {freeItems.map(item => (
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
            ) : (
              <div className="text-center py-8 text-gray-500">
                No free items listed yet
              </div>
            )
          ) : (
            barterItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                {barterItems.map(item => (
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
            ) : (
              <div className="text-center py-8 text-gray-500">
                No barter items listed yet
              </div>
            )
          )}
        </div>
      </div>

      {showShareDialog && profile && (
        <UserShareDialog
          userId={profile.id}
          username={profile.username}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </div>
  );
}

export default UserProfile;