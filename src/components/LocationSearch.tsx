import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, MapPin, RotateCcw, PenSquare } from 'lucide-react';
import { debounce } from 'throttle-debounce';

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
  confidence?: number;
}

interface LocationSearchProps {
  onLocationSelect: (location: LocationData) => void;
  initialValue?: string;
  placeholder?: string;
}

const CACHE_PREFIX = 'location_search_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 100; // ms

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

export function LocationSearch({ 
  onLocationSelect, 
  initialValue = '', 
  placeholder = 'Enter city, state or ZIP code...' 
}: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [manualFormData, setManualFormData] = useState({
    city: '',
    state: '',
    zipcode: ''
  });

  useEffect(() => {
    setSearchQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getCachedResults = (query: string): LocationData[] | null => {
    const cached = localStorage.getItem(CACHE_PREFIX + query);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
      localStorage.removeItem(CACHE_PREFIX + query);
    }
    return null;
  };

  const setCachedResults = (query: string, data: LocationData[]) => {
    localStorage.setItem(CACHE_PREFIX + query, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  };

  const normalizeInput = (input: string): string => {
    let normalized = input.replace(/\s+/g, ' ').trim();
    const stateRegex = /,?\s*([A-Z]{2})$/i;
    const match = normalized.match(stateRegex);
    if (match && stateAbbreviations[match[1].toUpperCase()]) {
      normalized = normalized.replace(
        stateRegex,
        `, ${stateAbbreviations[match[1].toUpperCase()]}`
      );
    }
    return normalized;
  };

  const searchWithRetry = async (input: string, retryCount = 0): Promise<any> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${input}&format=json`,
        {
          headers: {
            'User-Agent': 'FreeorBarter/1.0'
          }
        }
      );

      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return searchWithRetry(input, retryCount + 1);
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error;
      }
      throw new Error('Connection problem, please try again');
    }
  };

  const debouncedSearch = debounce(500, async (input: string) => {
    if (!input.trim() || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setError(null);
      setWarning(null);
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const cachedResults = getCachedResults(input);
      if (cachedResults) {
        setSuggestions(cachedResults);
        setShowSuggestions(true);
        setLoading(false);
        return;
      }

      const normalizedInput = normalizeInput(input);
      const isZipCode = /^\d{5}(-\d{4})?$/.test(normalizedInput);
      
      const params = new URLSearchParams({
        format: 'json',
        addressdetails: '1',
        'accept-language': 'en',
        countrycodes: 'us',
        limit: '5'
      });

      if (isZipCode) {
        params.set('postalcode', normalizedInput);
      } else {
        params.set('q', normalizedInput + ' USA');
      }

      const results = await searchWithRetry(params.toString());

      if (results.length === 0) {
        setError('No locations found. Try searching for just the city name');
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const formattedResults = results
        .map((result: any) => {
          const address = result.address || {};
          const city = address.city || address.town || address.village || 
                      address.municipality || address.suburb || '';
          const state = address.state || '';
          const zipcode = address.postcode || '';
          
          if ((!city && !state) || !zipcode) {
            return null;
          }

          const confidence = parseFloat(result.importance || 0);
          
          return {
            label: `${city}, ${state}`,
            city,
            state,
            zipcode,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            confidence
          };
        })
        .filter((result): result is LocationData => result !== null)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      setCachedResults(input, formattedResults);
      setSuggestions(formattedResults);
      setShowSuggestions(formattedResults.length > 0);
      
      if (formattedResults.length === 0) {
        setError('No locations found. Try searching for just the city name');
      }
    } catch (err) {
      console.error('Error in location search:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const { city, state, zipcode } = manualFormData;
    
    if (!city || !state || !zipcode) {
      setError('All fields are required for manual entry');
      return;
    }

    if (!/^\d{5}(-\d{4})?$/.test(zipcode)) {
      setError('Please enter a valid ZIP code');
      return;
    }

    const location: LocationData = {
      label: `${city}, ${state}`,
      city,
      state,
      zipcode,
      latitude: 0,
      longitude: 0,
      confidence: 0.5
    };

    fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&postalcode=${zipcode}&country=usa&format=json`)
      .then(response => response.json())
      .then(data => {
        if (data && data[0]) {
          location.latitude = parseFloat(data[0].lat);
          location.longitude = parseFloat(data[0].lon);
          onLocationSelect(location);
          setSelectedLocation(location);
          setShowManualEntry(false);
          setManualFormData({ city: '', state: '', zipcode: '' });
        } else {
          setError('Could not geocode the entered location');
        }
      })
      .catch(() => {
        setError('Error geocoding location. Please try again');
      });
  };

  const handleRetry = () => {
    if (searchQuery.trim()) {
      setRetryCount(prev => prev + 1);
      debouncedSearch(searchQuery);
    }
  };

  return (
    <div className="relative" ref={searchContainerRef}>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            debouncedSearch(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0 && !selectedLocation) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${
            error ? 'border-red-300' : 
            warning ? 'border-yellow-300' : 
            'border-gray-300'
          } pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
          aria-invalid={!!error}
        />
        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            <span>{error}</span>
          </div>
          {error.includes('Connection problem') || error.includes('Rate limit') ? (
            <button
              onClick={handleRetry}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Retry
            </button>
          ) : null}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setSelectedLocation(suggestion);
                setSearchQuery(suggestion.label);
                setShowSuggestions(false);
                onLocationSelect(suggestion);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-0"
            >
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mt-0.5 mr-2 text-gray-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">{suggestion.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {suggestion.zipcode}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!showManualEntry && (
        <button
          onClick={() => setShowManualEntry(true)}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <PenSquare className="w-4 h-4 mr-1" />
          Can't find your location? Enter manually
        </button>
      )}

      {showManualEntry && (
        <form onSubmit={handleManualSubmit} className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
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
              type="submit"
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save Location
            </button>
          </div>
        </form>
      )}

      {selectedLocation && (
        <div className="mt-2 text-xs text-gray-500">
          <div className="flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />
            <span>Selected: {selectedLocation.label}</span>
          </div>
          <div className="mt-1 pl-5">
            <div>City: {selectedLocation.city || 'Not available'}</div>
            <div>State: {selectedLocation.state || 'Not available'}</div>
            <div>ZIP: {selectedLocation.zipcode || 'Not available'}</div>
          </div>
        </div>
      )}
    </div>
  );
}