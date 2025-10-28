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
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

      // Trigger real-time notifications to friends about new listing
      try {
        // Get user's friends
        const { data: friendsData, error: friendsError } = await supabase
          .from('friendships')
          .select(`
            user1_id,
            user2_id
          `)
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (!friendsError && friendsData) {
          // Send notification to each friend
          const notificationPromises = friendsData.map(async (friendship) => {
            const friendId = friendship.user1_id === user.id ? friendship.user2_id : friendship.user1_id;
            
            try {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pusher-trigger`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  channel: `private-user-${friendId}`,
                  event: 'new-notification',
                  data: {
                    type: 'new_listing',
                    itemId: data.id,
                    posterId: user.id
                  }
                })
              });
            } catch (pusherError) {
              console.error('Error sending notification to friend:', friendId, pusherError);
              // Continue with other notifications even if one fails
            }
          });

          // Wait for all notifications to be sent (but don't block the UI)
          Promise.all(notificationPromises).catch(err => {
            console.error('Some friend notifications failed:', err);
          });
        }
      } catch (friendsError) {
        console.error('Error fetching friends for notifications:', friendsError);
        // Don't fail the listing creation if friend notifications fail
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating listing. Please try again.');
      setShowErrorModal(true);
      console.error('Error creating listing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewListing = () => {
    if (createdItemId) {
      navigate(`/items/${createdItemId}`);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setCreatedItemId(null);
    setFormData({
      title: '',
      description: '',
      condition: '',
      category: '',
    });
    setImages([]);
    setSelectedLocation(null);
    setListingType('free');
    setError(null);
  };

  const handleTryAgain = () => {
    setShowErrorModal(false);
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setShowErrorModal(false);
    setErrorMessage(null);
    setFormData({
      title: '',
      description: '',
      condition: '',
      category: '',
    });
    setImages([]);
    setSelectedLocation(null);
    setListingType('free');
    setError(null);
  };

  // Success message display
  if (success && createdItemId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-center mb-3 text-gray-900">
            Listing Created Successfully!
          </h3>
          <p className="text-gray-600 text-center mb-8">
            Your item has been listed and is now visible to the community.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleViewListing}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              View My Listing
            </button>
            <button
              onClick={handleCreateAnother}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Create Another Listing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Create New Listing</h1>
          <p className="text-lg text-gray-600">Share something amazing with your community</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8">
                <div className="flex items-center">
                  <span className="text-lg mr-2">⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Step 1: Photos First */}
            <div className="mb-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">📸 Photos</h2>
                <p className="text-gray-600">{images.length}/5 photos</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-32 object-cover rounded-xl shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl h-32 flex flex-col items-center justify-center hover:border-gray-400 transition-colors cursor-pointer"
                       onClick={() => document.getElementById('image-upload')?.click()}>
                    <span className="text-3xl mb-2">📷</span>
                    <span className="text-sm text-gray-600 font-medium">Add Photo</span>
                  </div>
                )}
              </div>
              
              <ImageUpload onImagesUploaded={setImages} maxImages={5} />
              {images.length === 0 && (
                <p className="mt-2 text-sm text-red-500">At least one image is required</p>
              )}
            </div>

            {/* Step 2: Listing Type */}
            <div className="mb-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🎯 Listing Type</h2>
                <p className="text-gray-600">How do you want to share this item?</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setListingType('free')}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                    listingType === 'free'
                      ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3">🎁</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Free</h3>
                    <p className="text-sm text-gray-600">Give it away</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setListingType('barter')}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                    listingType === 'barter'
                      ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3">🔄</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Barter</h3>
                    <p className="text-sm text-gray-600">Trade for something</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3: Basic Information */}
            <div className="mb-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">📝 Basic Information</h2>
                <p className="text-gray-600">Tell us about your item</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-lg font-semibold text-gray-900 mb-3">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">📝</span>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="What are you sharing?"
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="text-right text-sm text-gray-500 mt-2">
                    {formData.title.length}/100
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-lg font-semibold text-gray-900 mb-3">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-400 text-xl">📄</span>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your item, its condition, and any important details..."
                      rows={4}
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      required
                      maxLength={500}
                    />
                  </div>
                  <div className="text-right text-sm text-gray-500 mt-2">
                    {formData.description.length}/500
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Item Details */}
            <div className="mb-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🏷️ Item Details</h2>
                <p className="text-gray-600">Help others find your item</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-3">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {['Electronics', 'Furniture', 'Clothing', 'Sports & Outdoors', 'Books & Media', 'Home & Garden', 'Toys & Games', 'Other'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.toLowerCase() })}
                        className={`px-6 py-3 rounded-full text-sm font-semibold transition-all ${
                          formData.category === cat.toLowerCase()
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                            : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-3">
                    Condition
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {['new', 'like-new', 'good', 'fair', 'poor'].map(cond => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setFormData({ ...formData, condition: cond })}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          formData.condition === cond
                            ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                            : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        {cond.replace('-', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5: Location */}
            <div className="mb-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">📍 Location</h2>
                <p className="text-gray-600">Where is this item located?</p>
              </div>
              
              {selectedLocation ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-4">📍</span>
                    <div>
                      <p className="text-sm text-green-600 font-medium">Selected Location</p>
                      <p className="text-lg text-green-800 font-semibold">{selectedLocation.label}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLocation(null)}
                    className="text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setUseCurrentLocation(true)}
                    disabled={isLocating}
                    className={`flex items-center justify-center px-6 py-4 rounded-xl border-2 transition-all ${
                      isLocating 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 hover:shadow-md'
                    }`}
                  >
                    <MapPin className="w-6 h-6 mr-3" />
                    <span className="font-semibold">
                      {isLocating ? 'Getting location...' : 'Use my current location'}
                    </span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(true)}
                    className="flex items-center justify-center px-6 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:shadow-md transition-all"
                  >
                    <PenSquare className="w-6 h-6 mr-3" />
                    <span className="font-semibold">Enter manually</span>
                  </button>
                </div>
              )}

              {showManualEntry && (
                <div className="mt-6 bg-gray-50 rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={manualFormData.city}
                        onChange={(e) => setManualFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter city name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                      <select
                        value={manualFormData.state}
                        onChange={(e) => setManualFormData(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a state</option>
                        {Object.entries(stateAbbreviations).map(([abbr, name]) => (
                          <option key={abbr} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">ZIP Code</label>
                      <input
                        type="text"
                        value={manualFormData.zipcode}
                        onChange={(e) => setManualFormData(prev => ({ ...prev, zipcode: e.target.value }))}
                        placeholder="12345"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(false)}
                      className="px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleManualSubmit}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                    >
                      Save Location
                    </button>
                  </div>
                </div>
              )}

              {!selectedLocation && (
                <p className="mt-4 text-sm text-red-500">
                  Please select your location using one of the options above
                </p>
              )}
            </div>

            {/* Step 6: Submit */}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white text-xl font-bold py-6 rounded-2xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
              disabled={loading || !selectedLocation}
            >
              <span className="flex items-center justify-center">
                <span className="text-2xl mr-3">{loading ? '🚀' : '✨'}</span>
                {loading ? 'Creating Listing...' : 'Create Listing'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">⚠️</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-center mb-3 text-gray-900">
              Upload Failed
            </h3>
            <p className="text-gray-600 text-center mb-8">
              {errorMessage || 'Something went wrong while creating your listing.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleTryAgain}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleCancel}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewListing;