import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMap, Marker, Popup } from 'react-leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Item } from '../types';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;

// Create custom marker icon for items
const itemIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
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

// Updated MapUpdater component to handle view updates without auto-zooming
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevCenter = useRef(center);
  const prevZoom = useRef(zoom);

  useEffect(() => {
    // Only update center if it has changed
    if (prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1]) {
      map.setView(center, zoom);
      prevCenter.current = center;
      prevZoom.current = zoom;
    }
  }, [map, center, zoom]);

  return null;
}

function ItemMarker({ item }: { item: Item }) {
  if (!item.latitude || !item.longitude) return null;

  return (
    <Marker position={[item.latitude, item.longitude]} icon={itemIcon}>
      <Popup>
        <Link 
          to={`/items/${item.id}`}
          className="block hover:opacity-90 transition-opacity"
        >
          <div className="w-64">
            <div className="relative">
              <img 
                src={item.images[0]} 
                alt={item.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  item.type === 'free' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {item.type === 'free' ? 'Free' : 'Barter'}
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-b-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                {item.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
                  {item.condition}
                </span>
                <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                  {item.location}
                </span>
              </div>
            </div>
          </div>
        </Link>
      </Popup>
    </Marker>
  );
}

export function Map({ onRadiusChange, onLocationSelect, selectedLocation, onMarkerDrag, items = [] }: MapProps) {
  const [radius, setRadius] = useState(5); // Changed default from 10 to 5 miles
  const [center, setCenter] = useState<[number, number]>([39.8283, -98.5795]); // Default to center of USA
  const [zoom, setZoom] = useState(13);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocateMe = () => {
    setIsLocating(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          setZoom(13); // Reset zoom when changing location
          
          // Reverse geocode to get address details
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

          onLocationSelect({
            label: `${city}, ${state}`,
            city,
            state,
            zipcode,
            latitude,
            longitude
          });
        } catch (err) {
          console.error('Error getting location details:', err);
          setError('Could not determine your location');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Could not access your location');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    if (selectedLocation) {
      setCenter([selectedLocation.latitude, selectedLocation.longitude]);
      setZoom(13); // Reset zoom when location is selected
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
      <div className="flex items-center justify-between">
        <div className="flex-1">
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
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`ml-4 flex items-center px-3 py-2 rounded-lg ${
            isLocating 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          <MapPin className="w-4 h-4 mr-1" />
          {isLocating ? 'Locating...' : 'Use my location'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="h-[400px] rounded-lg overflow-hidden">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <MapUpdater center={center} zoom={zoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={center}
            radius={radiusInMeters}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />
          {items.map(item => (
            <ItemMarker key={item.id} item={item} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}