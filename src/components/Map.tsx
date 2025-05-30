import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMap, Marker, Popup } from 'react-leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Item } from '../types';

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
  onMarkerDrag?: (lat: number, lng: number) => void;
  items?: Item[];
}

function DraggableMarker({ position, onDragEnd }: { 
  position: [number, number];
  onDragEnd?: (lat: number, lng: number) => void;
}) {
  const [markerPosition, setMarkerPosition] = useState(position);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  return (
    <Marker
      position={markerPosition}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setMarkerPosition([pos.lat, pos.lng]);
          onDragEnd?.(pos.lat, pos.lng);
        },
      }}
    />
  );
}

function ItemMarker({ item }: { item: Item }) {
  if (!item.latitude || !item.longitude) return null;

  return (
    <Marker position={[item.latitude, item.longitude]}>
      <Popup>
        <div className="p-2">
          <img 
            src={item.images[0]} 
            alt={item.title}
            className="w-32 h-32 object-cover rounded mb-2"
          />
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-sm text-gray-600">{item.location}</p>
          <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
            item.type === 'free' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-purple-100 text-purple-800'
          }`}>
            {item.type === 'free' ? 'Free' : 'Barter'}
          </span>
        </div>
      </Popup>
    </Marker>
  );
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

export function Map({ onRadiusChange, onLocationSelect, selectedLocation, onMarkerDrag, items = [] }: MapProps) {
  const [radius, setRadius] = useState(10); // Default 10 miles
  const [center, setCenter] = useState<[number, number]>([39.8283, -98.5795]); // Default to center of USA

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          
          // Only call onLocationSelect if we don't have a selected location
          if (!selectedLocation && typeof onLocationSelect === 'function') {
            // Reverse geocode to get address details
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
              .then(response => {
                if (!response.ok) {
                  throw new Error('Network response was not ok');
                }
                return response.json();
              })
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
              .catch(error => {
                console.error('Error reverse geocoding:', error);
              });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
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

  // Convert miles to meters for the Circle component
  const radiusInMeters = radius * 1609.34; // 1 mile = 1609.34 meters

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Radius: {radius} miles
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
            radius={radiusInMeters}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />
          {selectedLocation && (
            <DraggableMarker 
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              onDragEnd={onMarkerDrag}
            />
          )}
          {items.map(item => (
            <ItemMarker key={item.id} item={item} />
          ))}
          <SearchControl onLocationSelect={onLocationSelect} />
        </MapContainer>
      </div>
    </div>
  );
}