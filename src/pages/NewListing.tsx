import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageUpload } from '../components/ImageUpload';
import { LocationSearch } from '../components/LocationSearch';
import { Map } from '../components/Map';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle2 } from 'lucide-react';
import { validateLocationData } from '../utils/validation';

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

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
  const [searchRadius, setSearchRadius] = useState(10);

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              <LocationSearch
                onLocationSelect={setSelectedLocation}
                placeholder="Enter city, state, or ZIP code"
              />
              <Map
                onRadiusChange={setSearchRadius}
                onLocationSelect={setSelectedLocation}
                selectedLocation={selectedLocation || undefined}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default NewListing;