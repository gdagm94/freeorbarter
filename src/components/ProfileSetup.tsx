import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload } from 'lucide-react';
import { LocationSearch } from './LocationSearch';

interface ProfileSetupProps {
  onComplete: () => void;
  onClose: () => void;
  initialData?: {
    username?: string;
    zipcode?: string;
    gender?: string;
    avatar_url?: string | null;
  };
}

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

export function ProfileSetup({ onComplete, onClose, initialData }: ProfileSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: initialData?.username || '',
    gender: initialData?.gender || '',
  });
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData?.avatar_url || null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedLocation) {
      setError('Please select a valid location');
      setLoading(false);
      return;
    }

    try {
      // Only include fields that have been filled out
      const updateData: Record<string, any> = {};

      if (formData.username.trim()) {
        updateData.username = formData.username.trim();
      }

      if (selectedLocation) {
        updateData.zipcode = selectedLocation.zipcode;
      }

      if (formData.gender) {
        updateData.gender = formData.gender;
      }

      // Only handle avatar upload if a new file was selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        updateData.avatar_url = publicUrl;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        updateData.profile_completed = true;

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', (await supabase.auth.getUser()).data.user?.id);

        if (updateError) throw updateError;
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

        <h2 className="text-2xl font-bold mb-4">Complete Your Profile</h2>
        <p className="text-gray-600 mb-6">
          Please provide some additional information to complete your profile setup.
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Location <span className="text-red-500">*</span>
            </label>
            <LocationSearch
              onLocationSelect={setSelectedLocation}
              initialValue={initialData?.zipcode ? `${initialData.zipcode}` : ''}
              placeholder="Enter your location"
            />
          </div>

          <div>
            <label htmlFor="avatar" className="block text-sm font-medium text-gray-700">
              Profile Picture
            </label>
            <div className="mt-1 flex items-center space-x-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile preview"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="avatar"
                className="btn-secondary cursor-pointer"
              >
                Choose Image
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}