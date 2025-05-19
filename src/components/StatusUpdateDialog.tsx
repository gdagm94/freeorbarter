import React from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatusUpdateDialogProps {
  type: 'free' | 'barter';
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export function StatusUpdateDialog({ type, onConfirm, onClose, loading = false }: StatusUpdateDialogProps) {
  const action = type === 'free' ? 'claimed' : 'traded';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500 mr-3" />
          <h2 className="text-xl font-bold">Confirm Action</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Are you sure you want to mark this item as {action}? This action cannot be undone, and the item will no longer be available to other users.
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors flex items-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Updating...
              </span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Mark as {action}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}