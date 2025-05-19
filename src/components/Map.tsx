import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationData {
  label: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
}

interface MapProps {
  onRadiusChange: (radius: number) => void;
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
}

function SearchControl({ onLocationSelect }: { onLocationSelect: (location: LocationData) => void }) {
  const map = useMap();
  const provider = new OpenStreetMapProvider();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = await provider.search({ query: searchQuery + ' USA' });
      
      if (results.length > 0) {
        const result = results[0];
        const { x, y, raw } = result;
        
        // Extract location components from raw data
        const address = raw.address || {};
        const city = address.city || address.town || address.village || address.municipality || '';
        const state = address.state || '';
        const zipcode = address.postcode || '';
        
        // Create location data object
        const locationData: LocationData = {
          label: `${city}, ${state} ${zipcode}`.trim(),
          city,
          state,
          zipcode,
          latitude: y,
          longitude: x
        };

        map.setView([y, x], 13);
        onLocationSelect(locationData);
        setError(null);
      } else {
        setError('No results found');
      }
    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leaflet-top leaflet-left mt-2 ml-2">
      <div className="leaflet-control">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search location..."
            className="w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-md"
          />
          {loading ? (
            <div className="absolute left-3 top-2.5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <Search 
              className="absolute left-3 top-2.5 text-gray-400 w-5 h-5 cursor-pointer" 
              onClick={handleSearch}
            />
          )}
        </div>
        {error && (
          <div className="mt-1 text-sm text-red-600 bg-white px-2 py-1 rounded shadow-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function Map({ onRadiusChange, onLocationSelect, initialLocation }: MapProps) {
  const [radius, setRadius] = useState(10);
  const [center, setCenter] = useState<[number, number]>([51.505, -0.09]); // Default to London

  useEffect(() => {
    if (initialLocation) {
      setCenter([initialLocation.latitude, initialLocation.longitude]);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          
          // Reverse geocode the coordinates to get location details
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(response => response.json())
            .then(data => {
              const address = data.address || {};
              const locationData: LocationData = {
                label: `${address.city || address.town || ''}, ${address.state || ''} ${address.postcode || ''}`.trim(),
                city: address.city || address.town || '',
                state: address.state || '',
                zipcode: address.postcode || '',
                latitude,
                longitude
              };
              onLocationSelect(locationData);
            })
            .catch(error => console.error('Error getting location details:', error));
        },
        () => {
          console.log('Error: The Geolocation service failed.');
        }
      );
    }
  }, [initialLocation, onLocationSelect]);

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = parseInt(e.target.value);
    setRadius(newRadius);
    onRadiusChange(newRadius);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Radius: {radius} km
        </label>
        <input
          type="range"
          min="1"
          max="50"
          value={radius}
          onChange={handleRadiusChange}
          className="w-full"
        />
      </div>
      <div className="h-[400px] rounded-lg overflow-hidden">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={center}
            radius={radius * 1000}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />
          <SearchControl onLocationSelect={onLocationSelect} />
        </MapContainer>
      </div>
    </div>
  );
}