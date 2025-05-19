import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, PlusCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Item } from '../types';

interface BarterOfferDialogProps {
  onClose: () => void;
  onItemSelected: (itemId: string) => void;
  currentUserId: string;
}

export function BarterOfferDialog({ onClose, onItemSelected, currentUserId }: BarterOfferDialogProps) {
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasBarterItems, setHasBarterItems] = useState(false);

  useEffect(() => {
    const fetchUserItems = async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('status', 'available')
          .eq('type', 'barter') // Only get barter items
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Check if user has any barter items
        setHasBarterItems(data && data.length > 0);
        setUserItems(data || []);
      } catch (err) {
        console.error('Error fetching user items:', err);
        setError('Failed to load your items');
      } finally {
        setLoading(false);
      }
    };

    fetchUserItems();
  }, [currentUserId]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < userItems.length - 1 ? prev + 1 : prev));
  };

  const handleSelectItem = () => {
    if (userItems.length > 0) {
      onItemSelected(userItems[currentIndex].id);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
          <p className="text-center text-gray-600">Loading your items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-4">Choose an Item to Barter</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {userItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4">
              {hasBarterItems ? (
                <PlusCircle className="w-12 h-12 text-indigo-600 mx-auto" />
              ) : (
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              )}
            </div>
            <p className="text-gray-600 mb-4">
              {hasBarterItems ? 
                "You don't have any items to barter with." : 
                "You need to list an item as 'Barter' to make an exchange offer. Items listed as 'Free' can't be used for bartering."}
            </p>
            <Link to="/new-listing" className="btn-primary inline-block">
              Create a Barter Listing
            </Link>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <div className="h-64 overflow-hidden rounded-lg">
                <img
                  src={userItems[currentIndex].images[0]}
                  alt={userItems[currentIndex].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                    Barter
                  </span>
                </div>
              </div>
              
              {userItems.length > 1 && (
                <>
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 ${
                      currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === userItems.length - 1}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 ${
                      currentIndex === userItems.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{userItems[currentIndex].title}</h3>
              <p className="text-gray-600 text-sm line-clamp-2">{userItems[currentIndex].description}</p>
              <div className="flex items-center mt-2">
                <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 mr-2">
                  {userItems[currentIndex].condition}
                </span>
                <span className="text-sm text-gray-500">{userItems[currentIndex].location}</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Item {currentIndex + 1} of {userItems.length}
              </div>
              <button
                onClick={handleSelectItem}
                className="btn-primary"
              >
                Offer This Item
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}