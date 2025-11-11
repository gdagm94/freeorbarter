import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Star, ArrowLeft, ChevronLeft, ChevronRight, User, Edit, Trash2, Tag, CheckCircle, Share2, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { MessageList } from '../components/MessageList';
import { useAuth } from '../hooks/useAuth';
import { Auth } from '../components/Auth';
import { BarterOfferDialog } from '../components/BarterOfferDialog';
import { EditListingDialog } from '../components/EditListingDialog';
import { DeleteListingDialog } from '../components/DeleteListingDialog';
import { StatusUpdateDialog } from '../components/StatusUpdateDialog';
import { WatchButton } from '../components/WatchButton';
import { ShareDialog } from '../components/ShareDialog';
import { ReportContentDialog } from '../components/ReportContentDialog';

interface ItemUser {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
}

interface ItemWithUser extends Item {
  users: ItemUser;
}

function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<ItemWithUser | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showBarterDialog, setShowBarterDialog] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('items')
          .select(`
            *,
            users (
              id,
              username,
              avatar_url,
              rating
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Item not found');

        setItem(data);
        
        // If the current user is not the item owner, set the other user ID to the item owner
        if (user && user.id !== data.user_id) {
          setOtherUserId(data.user_id);
        }
      } catch (err) {
        console.error('Error fetching item:', err);
        setError('Item not found');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();

    // Subscribe to item changes
    const subscription = supabase
      .channel(`items:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setError('This item is no longer available');
          } else {
            setItem(prev => ({
              ...payload.new as Item,
              users: prev?.users || {},
            } as ItemWithUser));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id, user]);

  const handleStatusUpdate = async () => {
    if (!item || !user || user.id !== item.user_id) return;
    
    setUpdatingStatus(true);
    try {
      const newStatus = item.type === 'free' ? 'claimed' : 'traded';
      const { error } = await supabase
        .from('items')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;

      // Update local state
      setItem(prev => prev ? { ...prev, status: newStatus } : null);
      setShowStatusDialog(false);
    } catch (err) {
      console.error('Error updating item status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mt-8">
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mt-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Item not found'}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % item.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
  };

  const handleUserProfileClick = () => {
    // If the item belongs to the current user, navigate to their editable profile
    if (user && user.id === item.user_id) {
      navigate('/profile');
    } else {
      navigate(`/users/${item.users.id}`);
    }
  };

  // Determine button text based on item type and status
  const getButtonText = () => {
    if (item.status === 'traded' || item.status === 'claimed') {
      return item.type === 'free' ? 'Item Claimed' : 'Item Traded';
    }
    if (showMessages) {
      return 'Hide Messages';
    }
    return item.type === 'free' ? 'Request Item' : 'Make an Offer';
  };

  const handleActionButtonClick = () => {
    if (item.status === 'traded' || item.status === 'claimed') {
      return; // Do nothing if item is already traded/claimed
    }
    
    if (item.type === 'free') {
      // For free items, just show the message interface
      setShowMessages(!showMessages);
    } else {
      // For barter items, show the barter dialog
      setShowBarterDialog(true);
    }
  };

  const handleItemSelected = async (offerItemId: string) => {
    // When an item is selected for bartering, create a message with the offer
    if (!user || !id) return;
    
    try {
      // Get the selected item details
      const { data: offerItem } = await supabase
        .from('items')
        .select('title')
        .eq('id', offerItemId)
        .single();
      
      // Create a message with the offer
      await supabase.from('messages').insert([
        {
          content: `I'd like to offer my "${offerItem?.title}" in exchange for this item.`,
          item_id: id,
          sender_id: user.id,
          receiver_id: item.user_id,
          offer_item_id: offerItemId,
          read: false,
          is_offer: true
        },
      ]);
      
      // Close the barter dialog and show the messages
      setShowBarterDialog(false);
      setShowMessages(true);
      
      // Set the other user ID to the item owner
      setOtherUserId(item.user_id);
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };

  const handleEditItem = () => {
    setEditingItem(true);
  };

  const handleDeleteItem = () => {
    setDeletingItem(true);
  };

  const handleItemUpdated = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          users (
            id,
            username,
            avatar_url,
            rating
          )
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        setItem(data);
      }
    } catch (err) {
      console.error('Error refreshing item data:', err);
    }
  };

  const handleItemDeleted = () => {
    navigate('/profile');
  };

  const isOwnItem = user && user.id === item.user_id;

  // Function to get category display name
  const getCategoryDisplayName = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'electronics': 'Electronics',
      'furniture': 'Furniture',
      'clothing': 'Clothing',
      'sports': 'Sports & Outdoors',
      'books': 'Books & Media',
      'other': 'Other'
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-indigo-600 mb-4"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Back
      </button>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="md:flex">
          <div className="md:flex-1">
            <div className="relative flex items-center justify-center bg-gray-100">
              <img
                src={item.images[currentImageIndex]}
                alt={item.title}
                className="max-w-full max-h-[600px] w-auto h-auto"
              />
              {/* Type label */}
              <div className="absolute top-4 right-4 z-10">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  item.type === 'free'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {item.type === 'free' ? 'Free' : 'Barter'}
                </span>
              </div>
              {/* Status label */}
              {item.status !== 'available' && (
                <div className="absolute top-4 left-4 z-10">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    item.status === 'traded' || item.status === 'claimed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status === 'traded' ? 'Traded' : 
                     item.status === 'claimed' ? 'Claimed' : 
                     item.status === 'pending' ? 'Pending' : ''}
                  </span>
                </div>
              )}
              {item.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {item.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="p-6 md:flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
              
              <div className="flex items-center space-x-2">
                {!isOwnItem && (
                  <WatchButton
                    itemId={item.id}
                    onAuthRequired={() => setShowAuth(true)}
                  />
                )}
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="bg-gray-100 p-2 rounded-full shadow-sm hover:bg-gray-200 transition-colors"
                  title="Share Item"
                  aria-label="Share Item"
                >
                  <Share2 className="w-5 h-5 text-gray-600" />
                </button>
                {!isOwnItem && (
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowAuth(true);
                        return;
                      }
                      setShowReportDialog(true);
                    }}
                    className="bg-gray-100 p-2 rounded-full shadow-sm hover:bg-gray-200 transition-colors"
                    title="Report Item"
                    aria-label="Report Item"
                  >
                    <Flag className="w-5 h-5 text-red-600" />
                  </button>
                )}
                {isOwnItem && (
                  <div className="relative group">
                    <button
                      className="bg-gray-100 p-2 rounded-full shadow-sm hover:bg-gray-200 transition-colors"
                      title="Manage Listing"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-1">
                        <button
                          onClick={handleEditItem}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Edit className="w-4 h-4 mr-3" />
                          Edit Listing
                        </button>
                        <button
                          onClick={handleDeleteItem}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-3" />
                          Delete Listing
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={handleUserProfileClick}
              className="flex items-center space-x-3 mb-4 hover:bg-gray-50 p-2 rounded-lg transition-colors"
            >
              {item.users.avatar_url ? (
                <img
                  src={item.users.avatar_url}
                  alt={item.users.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.users.username}</div>
                <div className="flex items-center text-sm text-gray-500">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="ml-1">{item.users.rating?.toFixed(1) || 'No ratings'}</span>
                </div>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                {item.condition}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-600">{item.location}</span>
              <span className="text-gray-300">•</span>
              <div className="flex items-center text-gray-600">
                <Tag className="w-4 h-4 mr-1" />
                <span>{getCategoryDisplayName(item.category)}</span>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">{item.description}</p>

            <div className="flex items-center justify-between">
              {user ? (
                user.id !== item.user_id ? (
                  <button
                    className={`btn-primary flex items-center ${
                      item.status !== 'available' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={handleActionButtonClick}
                    disabled={item.status !== 'available'}
                  >
                    {item.status === 'available' ? (
                      <MessageCircle className="w-5 h-5 mr-2" />
                    ) : (
                      <CheckCircle className="w-5 h-5 mr-2" />
                    )}
                    {getButtonText()}
                  </button>
                ) : (
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-500 italic">This is your listing</span>
                    {item.status === 'available' && (
                      <button
                        onClick={() => setShowStatusDialog(true)}
                        className="btn-primary flex items-center"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {item.type === 'free' ? 'Mark as Claimed' : 'Mark as Traded'}
                      </button>
                    )}
                  </div>
                )
              ) : (
                <button
                  className="btn-primary flex items-center"
                  onClick={() => setShowAuth(true)}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Sign in to {item.type === 'free' ? 'Request Item' : 'Make an Offer'}
                </button>
              )}
            </div>
          </div>
        </div>
        {showMessages && user && otherUserId && (
          <div className="border-t">
            <MessageList
              itemId={item.id}
              currentUserId={user.id}
              otherUserId={otherUserId}
              conversationType="item"
            />
          </div>
        )}
      </div>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {showBarterDialog && user && (
        <BarterOfferDialog 
          onClose={() => setShowBarterDialog(false)} 
          onItemSelected={handleItemSelected}
          currentUserId={user.id}
        />
      )}
      {editingItem && (
        <EditListingDialog
          item={item}
          onClose={() => setEditingItem(false)}
          onUpdate={handleItemUpdated}
        />
      )}
      {deletingItem && (
        <DeleteListingDialog
          itemId={item.id}
          itemTitle={item.title}
          onClose={() => setDeletingItem(false)}
          onDelete={handleItemDeleted}
        />
      )}
      {showStatusDialog && (
        <StatusUpdateDialog
          type={item.type}
          onConfirm={handleStatusUpdate}
          onClose={() => setShowStatusDialog(false)}
          loading={updatingStatus}
        />
      )}
      {showShareDialog && (
        <ShareDialog
          itemId={item.id}
          itemTitle={item.title}
          onClose={() => setShowShareDialog(false)}
        />
      )}
      {showReportDialog && (
        <ReportContentDialog
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          targetId={item.id}
          targetType="item"
        />
      )}
    </div>
  );
}

export default ItemDetails;