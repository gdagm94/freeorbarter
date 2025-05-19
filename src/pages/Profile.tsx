import React, { useEffect, useState } from 'react';
import { Settings, Star, History, Upload, Edit, Trash2, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ItemCard from '../components/ItemCard';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { ProfileSetup } from '../components/ProfileSetup';
import { EditListingDialog } from '../components/EditListingDialog';
import { DeleteListingDialog } from '../components/DeleteListingDialog';
import { UserShareDialog } from '../components/UserShareDialog';
import { WatchedItems } from '../components/WatchedItems';

interface UserProfile {
  username: string;
  zipcode: string;
  gender: string | null;
  created_at: string;
  avatar_url: string | null;
  profile_completed: boolean;
  rating: number | null;
}

interface TransactionHistory {
  id: string;
  item_title: string;
  completed_date: string;
  type: 'free' | 'barter';
}

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'barter' | 'watched'>('free');
  const [items, setItems] = useState<Item[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const fetchProfileAndItems = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      
      if (profileData && !profileData.profile_completed) {
        setShowProfileSetup(true);
      }
      
      setProfile(profileData);

      // Fetch user's items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

    } catch (error) {
      console.error('Error fetching profile and items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndItems();

    // Subscribe to changes in items
    const subscription = supabase
      .channel('items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user?.id}`,
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
  }, [user]);

  const handleProfileComplete = async () => {
    setShowProfileSetup(false);
    await fetchProfileAndItems(); // Refresh the profile data
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
  };

  const handleDeleteItem = (item: Item) => {
    setDeletingItem(item);
  };

  const handleItemUpdated = () => {
    // Refresh items after update
    if (user) {
      supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setItems(data);
        });
    }
  };

  const handleItemDeleted = () => {
    // Remove the deleted item from the local state
    if (deletingItem) {
      setItems(prev => prev.filter(item => item.id !== deletingItem.id));
    }
    setDeletingItem(null);
  };

  const handleHistoryClick = () => {
    navigate('/history');
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-8">Please sign in to view your profile.</div>;
  }

  const freeItems = items.filter(item => item.type === 'free');
  const barterItems = items.filter(item => item.type === 'barter');

  return (
    <div className="max-w-4xl mx-auto px-4">
      {showProfileSetup && (
        <ProfileSetup
          onComplete={handleProfileComplete}
          onClose={() => setShowProfileSetup(false)}
          initialData={profile || undefined}
        />
      )}

      {editingItem && (
        <EditListingDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdate={handleItemUpdated}
        />
      )}

      {deletingItem && (
        <DeleteListingDialog
          itemId={deletingItem.id}
          itemTitle={deletingItem.title}
          onClose={() => setDeletingItem(null)}
          onDelete={handleItemDeleted}
        />
      )}

      {showShareDialog && profile && (
        <UserShareDialog
          userId={user.id}
          username={profile.username}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <div className="relative flex-shrink-0">
              <img
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.username || '')}&background=random`}
                alt={profile?.username}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover"
              />
              <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md">
                <div className="flex items-center text-yellow-400">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="ml-1 text-sm text-gray-600">
                    {profile?.rating?.toFixed(1) || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{profile?.username}</h1>
              <div className="flex items-center text-gray-600 mt-1">
                <span>{profile?.zipcode}</span>
                {profile?.gender && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="capitalize">{profile?.gender}</span>
                  </>
                )}
              </div>
              <div className="text-gray-500 text-sm mt-1">
                Member since {new Date(profile?.created_at || '').toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2">
            <button
              onClick={() => setShowProfileSetup(true)}
              className="flex-1 sm:flex-none btn-secondary flex items-center justify-center text-sm"
            >
              <Settings className="w-4 h-4 mr-1" />
              <span>Edit</span>
            </button>
            <button
              onClick={handleHistoryClick}
              className="flex-1 sm:flex-none btn-secondary flex items-center justify-center text-sm"
            >
              <History className="w-4 h-4 mr-1" />
              <span>History</span>
            </button>
            <button
              onClick={() => setShowShareDialog(true)}
              className="flex-1 sm:flex-none btn-secondary flex items-center justify-center text-sm"
            >
              <Share2 className="w-4 h-4 mr-1" />
              <span>Share</span>
            </button>
          </div>
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
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 text-center ${
                activeTab === 'watched'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('watched')}
            >
              <div className="flex items-center justify-center space-x-1">
                <Star className="w-4 h-4" />
                <span>Watchlist</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'watched' ? (
            user && <WatchedItems userId={user.id} />
          ) : activeTab === 'free' ? (
            freeItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                {freeItems.map(item => (
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
                    />
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status === 'available' ? 'Active' : 'Completed'}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 z-10 flex space-x-1">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditItem(item);
                        }}
                        className="bg-white p-1.5 rounded-full shadow-md hover:bg-gray-100"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteItem(item);
                        }}
                        className="bg-white p-1.5 rounded-full shadow-md hover:bg-gray-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
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
                    />
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status === 'available' ? 'Active' : 'Completed'}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 z-10 flex space-x-1">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditItem(item);
                        }}
                        className="bg-white p-1.5 rounded-full shadow-md hover:bg-gray-100"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteItem(item);
                        }}
                        className="bg-white p-1.5 rounded-full shadow-md hover:bg-gray-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
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
    </div>
  );
}

export default Profile;