import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, MapPin } from 'lucide-react';
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

export function LocationSearch({ 
  onLocationSelect, 
  initialValue = '', 
  placeholder = 'Enter location...' 
}: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    // Handle clicks outside the component to close suggestions
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

  // Improved search function with better error handling and validation
  const debouncedSearch = debounce(500, async (input: string) => {
    if (!input.trim()) {
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
      // Special handling for ZIP codes
      const zipCodeRegex = /^\d{5}(-\d{4})?$/;
      const isZipCode = zipCodeRegex.test(input.trim());
      
      if (!isZipCode && input.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(false);
        return;
      }

      // For ZIP codes, use postalcode search
      const params = new URLSearchParams({
        format: 'json',
        addressdetails: '1',
        'accept-language': 'en',
        countrycodes: 'us',
        limit: '15' // Increased from 10 to get more options
      });

      if (isZipCode) {
        params.set('postalcode', input);
      } else {
        params.set('q', input + ' USA'); // Add USA to improve results for US locations
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            'User-Agent': 'FreeorBarter/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();

      // Better processing and validation of results
      const formattedResults = results
        .map((result: any) => {
          const address = result.address || {};
          
          // Extract city, state, and ZIP from the address data
          // Improved handling of different address formats
          const city = address.city || address.town || address.village || address.hamlet || 
                      address.municipality || address.suburb || '';
          const state = address.state || address.province || '';
          const zipcode = address.postcode || '';
          
          // Skip invalid entries but don't filter too aggressively
          if ((!city && !state) || !zipcode) {
            return null;
          }
          
          // Format the display label with more info for clarity
          const label = [
            city,
            state,
            zipcode,
            address.country === 'United States' ? '' : address.country
          ].filter(Boolean).join(', ');

          // Calculate a confidence score based on completeness and match quality
          let confidence = 0;
          if (city) confidence += 0.3;
          if (state) confidence += 0.3;
          if (zipcode) confidence += 0.4;
          if (isZipCode && zipcode === input) confidence = 1; // Exact ZIP match

          return {
            label,
            city,
            state,
            zipcode,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            confidence
          };
        })
        .filter((result): result is LocationData => result !== null)
        // Sort results with improved logic
        .sort((a, b) => {
          // First by confidence
          if (a.confidence !== b.confidence) {
            return b.confidence - a.confidence;
          }
          
          // Then by completeness of address
          const aComplete = (a.city ? 1 : 0) + (a.state ? 1 : 0) + (a.zipcode ? 1 : 0);
          const bComplete = (b.city ? 1 : 0) + (b.state ? 1 : 0) + (b.zipcode ? 1 : 0);
          return bComplete - aComplete;
        });

      setSuggestions(formattedResults);
      setShowSuggestions(formattedResults.length > 0);
      
      // Improved feedback for the user
      if (formattedResults.length === 0) {
        setError('No locations found. Please try a different search term or format.');
      } else if (formattedResults.length > 0 && formattedResults[0].confidence < 0.7) {
        setWarning('Location might not be precise. Please select the best match from the list.');
      }
    } catch (err) {
      console.error('Error fetching location suggestions:', err);
      setError('Unable to fetch location suggestions. Please try again or enter location manually.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedLocation(null);
    debouncedSearch(value);
  };

  const handleSuggestionClick = (suggestion: LocationData) => {
    setSearchQuery(suggestion.label);
    setSelectedLocation(suggestion);
    setShowSuggestions(false);
    onLocationSelect(suggestion);
    
    // Clear any errors/warnings when a location is selected
    setError(null);
    setWarning(null);
  };

  return (
    <div className="relative" ref={searchContainerRef}>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0 && !selectedLocation) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${error ? 'border-red-300' : warning ? 'border-yellow-300' : 'border-gray-300'} pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
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
        <div className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </div>
      )}
      
      {warning && !error && (
        <div className="mt-1 text-sm text-yellow-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {warning}
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-0"
            >
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mt-0.5 mr-2 text-gray-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">{suggestion.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {suggestion.confidence >= 0.9 
                      ? 'Exact match' 
                      : suggestion.confidence >= 0.7 
                        ? 'Good match' 
                        : 'Possible match'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
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