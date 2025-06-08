import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload, MapPin, PenSquare } from 'lucide-react';

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

const stateAbbreviations: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

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
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });

  useEffect(() => {
    if (!useCurrentLocation) return;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setUseCurrentLocation(false);
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          
          if (!response.ok) throw new Error('Failed to get location details');
          
          const data = await response.json();
          const address = data.address || {};
          
          const city = address.city || address.town || address.village || '';
          const state = address.state || '';
          const zipcode = address.postcode || '';
          
          if (!city || !state) {
            throw new Error('Could not determine your location');
          }

          const location: LocationData = {
            label: `${city}, ${state}`,
            city,
            state,
            zipcode,
            latitude,
            longitude
          };

          setSelectedLocation(location);
        } catch (err) {
          console.error('Error getting location details:', err);
          setError('Could not determine your location. Please enter it manually.');
        } finally {
          setIsLocating(false);
          setUseCurrentLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Could not access your location. Please enter it manually.');
        setIsLocating(false);
        setUseCurrentLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }, [useCurrentLocation]);

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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { city, state, zipcode } = manualFormData;
    
    if (!city || !state || !zipcode) {
      setError('All fields are required for manual entry');
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zipcode)) {
      setError('Please enter a valid ZIP code');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&postalcode=${zipcode}&country=usa&format=json`
      );
      
      const data = await response.json();
      
      const location: LocationData = {
        label: `${city}, ${state}`,
        city,
        state,
        zipcode,
        latitude: data && data[0] ? parseFloat(data[0].lat) : 0,
        longitude: data && data[0] ? parseFloat(data[0].lon) : 0
      };

      setSelectedLocation(location);
      setShowManualEntry(false);
      setManualFormData({ city: '', state: '', zipcode: '' });
      setError(null);
    } catch (err) {
      console.error('Error geocoding location:', err);
      setError('Error geocoding location. Please try again');
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

          {/* Location Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Location</h3>
              {selectedLocation && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ {selectedLocation.label}
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setUseCurrentLocation(true)}
                disabled={isLocating}
                className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  isLocating 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200'
                }`}
              >
                <MapPin className="w-5 h-5 mr-2" />
                {isLocating ? 'Getting location...' : 'Use my current location'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="flex-1 flex items-center justify-center px-4 py-3 rounded-lg border bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 transition-colors"
              >
                <PenSquare className="w-5 h-5 mr-2" />
                Can't find your location? Enter manually
              </button>
            </div>

            {showManualEntry && (
              <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    value={manualFormData.city}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <select
                    value={manualFormData.state}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select a state</option>
                    {Object.entries(stateAbbreviations).map(([abbr, name]) => (
                      <option key={abbr} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
                  <input
                    type="text"
                    value={manualFormData.zipcode}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, zipcode: e.target.value }))}
                    placeholder="12345"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Save Location
                  </button>
                </div>
              </div>
            )}

            {!selectedLocation && (
              <p className="text-sm text-red-500">
                Please select your location using one of the options above
              </p>
            )}
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
            disabled={loading || !selectedLocation}
          >
            {loading ? 'Saving...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}