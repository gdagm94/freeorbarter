import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ImageUpload } from './ImageUpload';
import { Item } from '../types';

interface EditListingDialogProps {
  item: Item;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditListingDialog({ item, onClose, onUpdate }: EditListingDialogProps) {
  const [images, setImages] = useState<string[]>(item.images);
  const [formData, setFormData] = useState({
    title: item.title,
    description: item.description,
    condition: item.condition,
    category: item.category,
    location: item.location,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({
          title: formData.title,
          description: formData.description,
          images,
          condition: formData.condition,
          category: formData.category,
          location: formData.location,
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      onUpdate();
      onClose();
    } catch (err) {
      setError('Error updating listing. Please try again.');
      console.error('Error updating listing:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Edit Listing</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Type
            </label>
            <div className="flex items-center w-full">
              <div className="relative w-full max-w-[200px]">
                <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1">
                  <div
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
                      item.type === 'free'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'bg-white text-purple-600 shadow-sm'
                    }`}
                  >
                    {item.type === 'free' ? 'Free' : 'Barter'}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Listing type cannot be changed after posting</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What is your item?"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photos <span className="text-red-500">*</span>
              <span className="text-sm text-gray-500 ml-1">(1-5 photos)</span>
            </label>
            <ImageUpload onImagesUploaded={setImages} maxImages={5} initialImages={images} />
            {images.length === 0 && (
              <p className="mt-1 text-sm text-red-500">At least one image is required</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your item in detail"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
                Condition <span className="text-red-500">*</span>
              </label>
              <select
                id="condition"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select condition</option>
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select category</option>
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="clothing">Clothing</option>
                <option value="sports">Sports & Outdoors</option>
                <option value="books">Books & Media</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="City, State"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}