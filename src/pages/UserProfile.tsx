import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, User, Share2, UserPlus, UserMinus, XCircle, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import ItemCard from '../components/ItemCard';
import { Item, FriendshipStatus } from '../types';
import { UserShareDialog } from '../components/UserShareDialog';
import { FriendMessageDialog } from '../components/FriendMessageDialog';
import { 
  sendFriendRequest, 
  acceptFriendRequest, 
  declineFriendRequest, 
  cancelFriendRequest, 
  unfriend, 
  getFriendshipStatus 
} from '../lib/friends';

interface UserProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
}

function UserProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'barter'>('free');
  
  // Friend request states
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  // Direct messaging state
  const [showMessageDialog, setShowMessageDialog] = useState(false);

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

  // Fetch friendship status when user or profile changes
  useEffect(() => {
    const fetchFriendshipStatus = async () => {
      if (!user || !id || user.id === id) {
        setFriendshipStatus('none');
        return;
      }

      try {
        const status = await getFriendshipStatus(user.id, id);
        setFriendshipStatus(status);

        // If status is pending_received, get the request ID
        if (status === 'pending_received') {
          const { data: request } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', id)
            .eq('receiver_id', user.id)
            .eq('status', 'pending')
            .single();

          if (request) {
            setPendingRequestId(request.id);
          }
        }
      } catch (err) {
        console.error('Error fetching friendship status:', err);
      }
    };

    fetchFriendshipStatus();
  }, [user, id]);

  const handleFriendAction = async (action: 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend') => {
    if (!user || !id || user.id === id) return;

    setFriendActionLoading(true);
    setFriendActionError(null);

    try {
      let result;

      switch (action) {
        case 'send':
          result = await sendFriendRequest(user.id, id);
          if (result.error) throw result.error;
          break;

        case 'accept':
          if (!pendingRequestId) throw new Error('No pending request found');
          result = await acceptFriendRequest(pendingRequestId);
          if (result.error) throw result.error;
          break;

        case 'decline':
          if (!pendingRequestId) throw new Error('No pending request found');
          result = await declineFriendRequest(pendingRequestId);
          if (result.error) throw result.error;
          break;

        case 'cancel':
          // For cancel, we need to find the request ID
          const { data: sentRequest } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', user.id)
            .eq('receiver_id', id)
            .eq('status', 'pending')
            .single();

          if (!sentRequest) throw new Error('No pending request found');
          
          result = await cancelFriendRequest(sentRequest.id);
          if (result.error) throw result.error;
          break;

        case 'unfriend':
          result = await unfriend(user.id, id);
          if (result.error) throw result.error;
          break;

        default:
          throw new Error('Invalid action');
      }

      // Refresh friendship status
      const newStatus = await getFriendshipStatus(user.id, id);
      setFriendshipStatus(newStatus);
      setPendingRequestId(null);

    } catch (err) {
      console.error('Error performing friend action:', err);
      setFriendActionError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleMessageUser = () => {
    if (!profile) return;
    setShowMessageDialog(true);
  };

  const renderFriendButton = () => {
    if (!user || !profile || user.id === profile.id) {
      return null;
    }

    const isLoading = friendActionLoading;

    switch (friendshipStatus) {
      case 'none':
        return (
          <button
            onClick={() => handleFriendAction('send')}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            <span>{isLoading ? 'Sending...' : 'Add Friend'}</span>
          </button>
        );

      case 'pending_sent':
        return (
          <button
            onClick={() => handleFriendAction('cancel')}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            <Clock className="w-4 h-4 mr-1.5" />
            <span>{isLoading ? 'Canceling...' : 'Cancel Request'}</span>
          </button>
        );

      case 'pending_received':
        return (
          <div className="w-full sm:w-auto flex space-x-1.5">
            <button
              onClick={() => handleFriendAction('accept')}
              disabled={isLoading}
              className="w-1/2 sm:w-auto flex items-center justify-center px-2.5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              <span>{isLoading ? 'Accepting...' : 'Accept'}</span>
            </button>
            <button
              onClick={() => handleFriendAction('decline')}
              disabled={isLoading}
              className="w-1/2 sm:w-auto flex items-center justify-center px-2.5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4 mr-1" />
              <span>{isLoading ? 'Declining...' : 'Decline'}</span>
            </button>
          </div>
        );

      case 'friends':
        return (
          <div className="w-full sm:w-auto flex space-x-1.5">
            <button
              onClick={handleMessageUser}
              className="w-1/2 sm:w-auto flex items-center justify-center px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors hover:bg-indigo-700"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              <span>Message</span>
            </button>
            <button
              onClick={() => handleFriendAction('unfriend')}
              disabled={isLoading}
              className="w-1/2 sm:w-auto flex items-center justify-center px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium transition-colors hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
            >
              <UserMinus className="w-4 h-4 mr-1.5" />
              <span>{isLoading ? 'Unfriending...' : 'Friends'}</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

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
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <div className="flex flex-col space-y-4">
          {/* Profile Info */}
          <div className="flex items-start space-x-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{profile.username}</h1>
              <div className="flex items-center text-gray-600 mt-1">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                <span className="ml-1 text-sm sm:text-base">{profile.rating?.toFixed(1) || 'No ratings yet'}</span>
              </div>
              <div className="text-gray-500 text-xs sm:text-sm mt-1">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap sm:justify-between sm:space-x-2">
            <div className="w-full sm:flex-1">
              {renderFriendButton()}
            </div>
            <button
              onClick={() => setShowShareDialog(true)}
              className="w-full sm:w-auto flex items-center justify-center px-3 py-2 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 transition-colors"
              title="Share Profile"
              aria-label="Share Profile"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Friend action error */}
          {friendActionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
              {friendActionError}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b">
          <div className="flex">
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 text-center text-sm sm:text-base ${
                activeTab === 'free'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('free')}
            >
              Free ({freeItems.length})
            </button>
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 text-center text-sm sm:text-base ${
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

      {showMessageDialog && profile && (
        <FriendMessageDialog
          friendId={profile.id}
          friendName={profile.username}
          friendAvatar={profile.avatar_url}
          onClose={() => setShowMessageDialog(false)}
        />
      )}
    </div>
  );
}

export default UserProfile;