import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMap, Marker } from 'react-leaflet';
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

interface MapProps {
  onRadiusChange: (radius: number) => void;
  onLocationSelect: (location: {
    label: string;
    city: string;
    state: string;
    zipcode: string;
    latitude: number;
    longitude: number;
  }) => void;
  selectedLocation?: {
    latitude: number;
    longitude: number;
  };
}

function SearchControl({ onLocationSelect }: { 
  onLocationSelect: MapProps['onLocationSelect']
}) {
  const map = useMap();
  const provider = new OpenStreetMapProvider();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const results = await provider.search({ query: searchQuery + ' USA' });
      
      if (results.length === 0) {
        setError('No locations found');
        return;
      }

      const result = results[0];
      const { x, y, raw } = result;
      
      // Extract address components
      const address = raw.address || {};
      const city = address.city || address.town || address.village || address.municipality || '';
      const state = address.state || '';
      const zipcode = address.postcode || '';

      if (!city || !state) {
        setError('Could not find complete address information');
        return;
      }

      const label = `${city}, ${state}${zipcode ? ` ${zipcode}` : ''}`;
      
      map.setView([y, x], 13);
      onLocationSelect({
        label,
        city,
        state,
        zipcode,
        latitude: y,
        longitude: x
      });
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setError(null);
            }}
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

export function Map({ onRadiusChange, onLocationSelect, selectedLocation }: MapProps) {
  const [radius, setRadius] = useState(10);
  const [center, setCenter] = useState<[number, number]>([51.505, -0.09]); // Default to London

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          // Only call onLocationSelect if we don't have a selected location
          if (!selectedLocation) {
            // Reverse geocode to get address details
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
              .then(response => response.json())
              .then(data => {
                const address = data.address || {};
                const city = address.city || address.town || address.village || address.municipality || '';
                const state = address.state || '';
                const zipcode = address.postcode || '';
                
                if (city && state) {
                  onLocationSelect({
                    label: `${city}, ${state}${zipcode ? ` ${zipcode}` : ''}`,
                    city,
                    state,
                    zipcode,
                    latitude,
                    longitude
                  });
                }
              })
              .catch(error => console.error('Error reverse geocoding:', error));
          }
        },
        () => {
          console.log('Error: The Geolocation service failed.');
        }
      );
    }
  }, [onLocationSelect, selectedLocation]);

  useEffect(() => {
    if (selectedLocation) {
      setCenter([selectedLocation.latitude, selectedLocation.longitude]);
    }
  }, [selectedLocation]);

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
          {selectedLocation && (
            <Marker position={[selectedLocation.latitude, selectedLocation.longitude]} />
          )}
          <SearchControl onLocationSelect={onLocationSelect} />
        </MapContainer>
      </div>
    </div>
  );
}