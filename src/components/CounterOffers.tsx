import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeftRight, Clock, Check, X, AlertCircle } from 'lucide-react';

interface CounterOffer {
  id: string;
  original_offer_id: string;
  counter_offer_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  updated_at: string;
  original_offer: {
    id: string;
    offered_item: {
      id: string;
      title: string;
      images: string[];
    };
    requested_item: {
      id: string;
      title: string;
      images: string[];
    };
    sender: {
      username: string;
    };
  };
  counter_offer: {
    id: string;
    offered_item: {
      id: string;
      title: string;
      images: string[];
    };
    requested_item: {
      id: string;
      title: string;
      images: string[];
    };
    sender: {
      username: string;
    };
  };
}

interface CounterOffersProps {
  currentUserId: string;
  offerId: string;
  onCounterOfferResponse: (counterOfferId: string, status: 'accepted' | 'declined') => void;
}

export function CounterOffers({ offerId, onCounterOfferResponse }: CounterOffersProps) {
  const [counterOffers, setCounterOffers] = useState<CounterOffer[]>([]);
  const [loading, setLoading] = useState(false);



  const fetchCounterOffers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('counter_offers')
        .select(`
          *,
          original_offer:original_offer_id (
            id,
            offered_item:offered_item_id (
              id,
              title,
              images
            ),
            requested_item:requested_item_id (
              id,
              title,
              images
            ),
            sender:sender_id (
              username
            )
          ),
          counter_offer:counter_offer_id (
            id,
            offered_item:offered_item_id (
              id,
              title,
              images
            ),
            requested_item:requested_item_id (
              id,
              title,
              images
            ),
            sender:sender_id (
              username
            )
          )
        `)
        .eq('original_offer_id', offerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching counter offers:', error);
        return;
      }

      setCounterOffers(data || []);
    } catch (err) {
      console.error('Error in fetchCounterOffers:', err);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetchCounterOffers();
  }, [fetchCounterOffers]);

  const handleCounterOfferResponse = async (counterOfferId: string, status: 'accepted' | 'declined') => {
    try {
      setLoading(true);

      // Update counter offer status
      const { error: updateError } = await supabase
        .from('counter_offers')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', counterOfferId);

      if (updateError) {
        console.error('Error updating counter offer:', updateError);
        return;
      }

      // If accepted, update the original offer status
      if (status === 'accepted') {
        const { error: offerError } = await supabase
          .from('barter_offers')
          .update({ status: 'accepted' })
          .eq('id', offerId);

        if (offerError) {
          console.error('Error updating original offer:', offerError);
        }
      }

      onCounterOfferResponse(counterOfferId, status);
      fetchCounterOffers();
    } catch (err) {
      console.error('Error in handleCounterOfferResponse:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'declined':
        return <X className="w-4 h-4 text-red-500" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading && counterOffers.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading counter offers...</p>
      </div>
    );
  }

  if (counterOffers.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No counter offers yet</p>
        <p className="text-xs">Counter offers will appear here when users respond to your offer</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Counter Offers</h3>
      </div>

      {counterOffers.map((counterOffer) => (
        <div
          key={counterOffer.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon(counterOffer.status)}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(counterOffer.status)}`}>
                {counterOffer.status.charAt(0).toUpperCase() + counterOffer.status.slice(1)}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatDate(counterOffer.created_at)}
            </span>
          </div>

          {/* Counter Offer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* Original Offer */}
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 mb-1">Your Offer</p>
                <div className="flex items-center gap-2">
                  <img
                    src={counterOffer.original_offer.offered_item.images[0]}
                    alt={counterOffer.original_offer.offered_item.title}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {counterOffer.original_offer.offered_item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Offered by {counterOffer.original_offer.sender.username}
                    </p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <ArrowLeftRight className="w-5 h-5 text-gray-400" />

              {/* Counter Offer */}
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 mb-1">Counter Offer</p>
                <div className="flex items-center gap-2">
                  <img
                    src={counterOffer.counter_offer.offered_item.images[0]}
                    alt={counterOffer.counter_offer.offered_item.title}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {counterOffer.counter_offer.offered_item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Offered by {counterOffer.counter_offer.sender.username}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            {counterOffer.message && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  "{counterOffer.message}"
                </p>
              </div>
            )}

            {/* Actions */}
            {counterOffer.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleCounterOfferResponse(counterOffer.id, 'accepted')}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => handleCounterOfferResponse(counterOffer.id, 'declined')}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
