import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Plus, X, Check, AlertCircle } from 'lucide-react';

interface Item {
  id: string;
  title: string;
  images: string[];
  condition: string;
  user_id: string;
}

interface BulkOffersProps {
  currentUserId: string;
  targetUserId: string;
  onOffersSent: (offerCount: number) => void;
  onClose: () => void;
  isVisible: boolean;
}

export function BulkOffers({ currentUserId, targetUserId, onOffersSent, onClose, isVisible }: BulkOffersProps) {
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [targetItems, setTargetItems] = useState<Item[]>([]);
  const [selectedTargetItem, setSelectedTargetItem] = useState<string | null>(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select-items' | 'select-target' | 'review'>('select-items');

  useEffect(() => {
    if (isVisible) {
      fetchAvailableItems();
      fetchTargetItems();
    }
  }, [isVisible, currentUserId, targetUserId]);

  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, images, condition, user_id')
        .eq('user_id', currentUserId)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching available items:', error);
        return;
      }

      setAvailableItems(data || []);
    } catch (err) {
      console.error('Error in fetchAvailableItems:', err);
    }
  };

  const fetchTargetItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, images, condition, user_id')
        .eq('user_id', targetUserId)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching target items:', error);
        return;
      }

      setTargetItems(data || []);
    } catch (err) {
      console.error('Error in fetchTargetItems:', err);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAllItems = () => {
    if (selectedItems.size === availableItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(availableItems.map(item => item.id)));
    }
  };

  const sendBulkOffers = async () => {
    if (selectedItems.size === 0 || !selectedTargetItem) return;

    try {
      setLoading(true);
      const selectedItemsArray = Array.from(selectedItems);
      const offers = selectedItemsArray.map(itemId => ({
        sender_id: currentUserId,
        receiver_id: targetUserId,
        offered_item_id: itemId,
        requested_item_id: selectedTargetItem,
        message: offerMessage.trim() || null,
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('barter_offers')
        .insert(offers);

      if (error) {
        console.error('Error sending bulk offers:', error);
        return;
      }

      onOffersSent(offers.length);
      onClose();
    } catch (err) {
      console.error('Error in sendBulkOffers:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedItems = () => {
    return availableItems.filter(item => selectedItems.has(item.id));
  };

  const getTargetItem = () => {
    return targetItems.find(item => item.id === selectedTargetItem);
  };

  const nextStep = () => {
    if (step === 'select-items' && selectedItems.size > 0) {
      setStep('select-target');
    } else if (step === 'select-target' && selectedTargetItem) {
      setStep('review');
    }
  };

  const prevStep = () => {
    if (step === 'select-target') {
      setStep('select-items');
    } else if (step === 'review') {
      setStep('select-target');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Bulk Trade Offers
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: 'select-items', label: 'Select Your Items', icon: Package },
              { key: 'select-target', label: 'Choose Target Item', icon: Check },
              { key: 'review', label: 'Review & Send', icon: AlertCircle }
            ].map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isActive = step === stepItem.key;
              const isCompleted = ['select-items', 'select-target', 'review'].indexOf(step) > index;
              
              return (
                <div key={stepItem.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isActive ? 'bg-indigo-600 text-white' : 
                    isCompleted ? 'bg-green-600 text-white' : 
                    'bg-gray-200 text-gray-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-indigo-600' : 
                    isCompleted ? 'text-green-600' : 
                    'text-gray-500'
                  }`}>
                    {stepItem.label}
                  </span>
                  {index < 2 && (
                    <div className={`w-8 h-0.5 ml-4 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'select-items' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">Select Items to Offer</h4>
                <button
                  onClick={selectAllItems}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  {selectedItems.size === availableItems.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {availableItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleItemSelection(item.id)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      selectedItems.has(item.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {item.condition}
                      </p>
                    </div>
                    {selectedItems.has(item.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'select-target' && (
            <div className="p-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Choose Target Item</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {targetItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTargetItem(item.id)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      selectedTargetItem === item.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {item.condition}
                      </p>
                    </div>
                    {selectedTargetItem === item.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="p-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Review Your Offers</h4>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Your Items ({selectedItems.size})</p>
                  <div className="flex flex-wrap gap-2">
                    {getSelectedItems().map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
                        <img
                          src={item.images[0]}
                          alt={item.title}
                          className="w-8 h-8 object-cover rounded"
                        />
                        <span className="text-sm text-gray-700">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Target Item</p>
                  {getTargetItem() && (
                    <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-3">
                      <img
                        src={getTargetItem()!.images[0]}
                        alt={getTargetItem()!.title}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{getTargetItem()!.title}</p>
                        <p className="text-xs text-gray-500 capitalize">{getTargetItem()!.condition}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder="Add a message to your offers..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={step === 'select-items'}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {step === 'review' ? (
              <button
                onClick={sendBulkOffers}
                disabled={loading || selectedItems.size === 0 || !selectedTargetItem}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : `Send ${selectedItems.size} Offers`}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={
                  (step === 'select-items' && selectedItems.size === 0) ||
                  (step === 'select-target' && !selectedTargetItem)
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
