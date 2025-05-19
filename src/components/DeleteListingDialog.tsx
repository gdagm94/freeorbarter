import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeleteListingDialogProps {
  itemId: string;
  itemTitle: string;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteListingDialog({ itemId, itemTitle, onClose, onDelete }: DeleteListingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, check if the item exists
      const { data: item, error: fetchError } = await supabase
        .from('items')
        .select('id')
        .eq('id', itemId)
        .single();

      if (fetchError) {
        throw new Error('Item not found or you do not have permission to delete it');
      }

      // Delete any messages associated with the item
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('item_id', itemId);
        
      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        // Continue with item deletion even if message deletion fails
      }

      // Delete the item
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (deleteError) {
        console.error('Error deleting item:', deleteError);
        throw new Error('Failed to delete the item. Please try again.');
      }

      // Call the onDelete callback to update the UI
      onDelete();
      onClose();
    } catch (err) {
      console.error('Error deleting listing:', err);
      setError(err instanceof Error ? err.message : 'Error deleting listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500 mr-3" />
          <h2 className="text-xl font-bold">Delete Listing</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Are you sure you want to delete "<span className="font-semibold">{itemTitle}</span>"? This action cannot be undone.
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}