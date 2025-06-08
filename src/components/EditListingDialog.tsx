import React, { useState, useEffect } from 'react';
import { X, MapPin, PenSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ImageUpload } from './ImageUpload';
import { Item } from '../types';

interface EditListingDialogProps {
  item: Item;
  onClose: () => void;
  onUpdate: () => void;
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

export function EditListingDialog({ item, onClose, onUpdate }: EditListingDialogProps) {
  const [images, setImages] = useState<string[]>(item.images);
  const [formData, setFormData] = useState({
    title: item.title,
    description: item.description,
    condition: item.condition,
    category: item.category,
  });
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate location data from existing item
  useEffect(() => {
    const prePopulateLocation = async () => {
      if (item.latitude && item.longitude && item.location) {
        try {
          // Try to reverse geocode to get more detailed location info
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.latitude}&lon=${item.longitude}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};
            
            const city = address.city || address.town || address.village || '';
            const state = address.state || '';
            const zipcode = address.postcode || '';
            
            if (city && state) {
              const location: LocationData = {
                label: `${city}, ${state}`,
                city,
                state,
                zipcode,
                latitude: item.latitude,
                longitude: item.longitude
              };
              
              setSelectedLocation(location);
              return;
            }
          }
        } catch (err) {
          console.error('Error reverse geocoding:', err);
        }
        
        // Fallback: use existing location string and coordinates
        const locationParts = item.location.split(', ');
        if (locationParts.length >= 2) {
          const location: LocationData = {
            label: item.location,
            city: locationParts[0],
            state: locationParts[1],
            zipcode: '',
            latitude: item.latitude,
            longitude: item.longitude
          };
          
          setSelectedLocation(location);
        }
      }
    };

    prePopulateLocation();
  }, [item]);

  // Handle "Use my current location"
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
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    
    if (!selectedLocation) {
      setError('Please select a valid location');
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
          location: selectedLocation.label,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
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

          {/* Location Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Location <span className="text-red-500">*</span>
              </label>
              {selectedLocation && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ {selectedLocation.label}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setUseCurrentLocation(true)}
                disabled={isLocating}
                className={`flex items-center justify-center px-3 py-2 rounded-lg border text-sm transition-colors ${
                  isLocating 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200'
                }`}
              >
                <MapPin className="w-4 h-4 mr-2" />
                {isLocating ? 'Getting location...' : 'Use my current location'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="flex items-center justify-center px-3 py-2 rounded-lg border bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 transition-colors text-sm"
              >
                <PenSquare className="w-4 h-4 mr-2" />
                Enter manually
              </button>
            </div>

            {showManualEntry && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
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
              disabled={loading || !selectedLocation}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}