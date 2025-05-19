import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { debounce } from 'throttle-debounce';

interface LocationSearchProps {
  onLocationSelect: (location: {
    label: string;
    city: string;
    state: string;
    zipcode: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialValue?: string;
  placeholder?: string;
}

export function LocationSearch({ onLocationSelect, initialValue = '', placeholder = 'Enter location...' }: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSearchQuery(initialValue);
  }, [initialValue]);

  // Debounced search function to prevent too many API calls
  const debouncedSearch = debounce(500, async (input: string) => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Special handling for ZIP codes
      const zipCodeRegex = /^\d{5}$/;
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
        limit: '10'
      });

      if (isZipCode) {
        params.set('postalcode', input);
      } else {
        params.set('q', input);
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

      // Process and format the results
      const formattedResults = results
        .map((result: any) => {
          const address = result.address || {};
          
          // Extract city, state, and ZIP from the address data
          const city = address.city || address.town || address.village || address.municipality || '';
          const state = address.state || '';
          const zipcode = address.postcode || '';
          
          // For ZIP code searches, prioritize exact matches
          if (isZipCode && zipcode !== input) {
            return null;
          }
          
          // Only include results with all required fields
          if (!city || !state || !zipcode) {
            return null;
          }
          
          // Format the display label
          const parts = [];
          if (address.neighbourhood) {
            parts.push(address.neighbourhood);
          }
          if (city) {
            parts.push(city);
          }
          if (state) {
            parts.push(state);
          }
          if (zipcode) {
            parts.push(zipcode);
          }
          
          const label = parts.join(', ');

          return {
            label,
            city,
            state,
            zipcode,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            raw: address,
            // Add a score for sorting
            score: isZipCode ? (zipcode === input ? 1 : 0) : 1
          };
        })
        .filter((result): result is NonNullable<typeof result> => result !== null)
        // Sort results to prioritize exact ZIP matches and more complete addresses
        .sort((a, b) => {
          // First, sort by score (ZIP match)
          if (a.score !== b.score) {
            return b.score - a.score;
          }
          // Then by completeness of address
          const aComplete = Object.keys(a.raw).length;
          const bComplete = Object.keys(b.raw).length;
          return bComplete - aComplete;
        });

      setSuggestions(formattedResults);
      setShowSuggestions(formattedResults.length > 0);
      
      // If no results found for ZIP code
      if (isZipCode && formattedResults.length === 0) {
        setError('No location found for this ZIP code. Please try another or enter a city name.');
      }
    } catch (err) {
      console.error('Error fetching location suggestions:', err);
      setError('Unable to fetch location suggestions. Please try again.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSuggestionClick = (suggestion: any) => {
    setSearchQuery(suggestion.label);
    setShowSuggestions(false);
    onLocationSelect(suggestion);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => {
            // Delay hiding suggestions to allow for clicks
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="font-medium">{suggestion.label}</div>
              {suggestion.raw.neighbourhood && (
                <div className="text-sm text-gray-500">
                  Neighborhood: {suggestion.raw.neighbourhood}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}