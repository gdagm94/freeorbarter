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

interface MapProps {
  onRadiusChange: (radius: number) => void;
  onLocationChange: (lat: number, lng: number) => void;
}

function SearchControl({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  const map = useMap();
  const provider = new OpenStreetMapProvider();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    try {
      const results = await provider.search({ query: searchQuery });
      if (results.length > 0) {
        const { x, y } = results[0];
        map.setView([y, x], 13);
        onLocationChange(y, x);
      }
    } catch (error) {
      console.error('Search failed:', error);
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
          <Search 
            className="absolute left-3 top-2.5 text-gray-400 w-5 h-5 cursor-pointer" 
            onClick={handleSearch}
          />
        </div>
      </div>
    </div>
  );
}

export function Map({ onRadiusChange, onLocationChange }: MapProps) {
  const [radius, setRadius] = useState(10);
  const [center, setCenter] = useState<[number, number]>([51.505, -0.09]); // Default to London

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          onLocationChange(latitude, longitude);
        },
        () => {
          console.log('Error: The Geolocation service failed.');
        }
      );
    }
  }, [onLocationChange]);

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
          <SearchControl onLocationChange={onLocationChange} />
        </MapContainer>
      </div>
    </div>
  );
}