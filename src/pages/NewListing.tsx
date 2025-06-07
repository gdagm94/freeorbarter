import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageUpload } from '../components/ImageUpload';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle2, MapPin, PenSquare } from 'lucide-react';
import { validateLocationData } from '../utils/validation';

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

function NewListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [listingType, setListingType] = useState<'free' | 'barter'>('free');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    condition: '',
    category: '',
  });
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (success && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && createdItemId) {
      navigate(`/items/${createdItemId}`);
    }
    return () => clearInterval(timer);
  }, [success, countdown, createdItemId, navigate]);

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
    if (!user) return;
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    if (!selectedLocation) {
      setError('Please select a valid location');
      return;
    }

    // Validate location data
    const locationValidation = validateLocationData(selectedLocation);
    if (!locationValidation.isValid) {
      setError(locationValidation.error || 'Invalid location data');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('items')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            images,
            condition: formData.condition,
            category: formData.category,
            user_id: user.id,
            location: `${selectedLocation.city}, ${selectedLocation.state}`,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            type: listingType,
            status: 'available'
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      setCreatedItemId(data.id);
      setCountdown(5);

    } catch (err) {
      setError('Error creating listing. Please try again.');
      console.error('Error creating listing:', err);
    } finally {
      setLoading(false);
    }
  };

  // Success message display
  if (success && createdItemId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-center mb-2">
            Listing Created Successfully!
          </h3>
          <p className="text-gray-600 text-center mb-4">
            Redirecting you to your listing in {countdown} seconds...
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => navigate(`/items/${createdItemId}`)}
              className="btn-primary"
            >
              View Listing Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Listing</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
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
            <div className="flex items-center justify-center w-full">
              <div className="relative w-full max-w-[200px]">
                <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setListingType('free')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      listingType === 'free'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingType('barter')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      listingType === 'barter'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Barter
                  </button>
                </div>
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
            <ImageUpload onImagesUploaded={setImages} maxImages={5} />
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

          <button
            type="submit"
            className="w-full btn-primary"
            disabled={loading || !selectedLocation}
          >
            {loading ? 'Creating...' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default NewListing;