import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

interface ItemCardProps {
  id: string;
  title: string;
  price?: number;
  description: string | null;
  image: string | null;
  images?: string[];
  condition: string;
  location: string | null;
  type?: 'free' | 'barter';
  status?: 'available' | 'pending' | 'traded' | 'claimed';
}

function ItemCard({
  id,
  title,
  description,
  image,
  images = [],
  condition,
  location,
  type = 'free',
  status = 'available'
}: ItemCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const allImages = images.length > 0 ? images : (image ? [image] : []);
  const displayImage = allImages.length > 0 ? allImages[currentImageIndex] : 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&q=80&w=1000'; // Placeholder

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <Link to={`/items/${id}`} className="block">
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative">
          <img
            src={displayImage}
            alt={title}
            className="w-full aspect-square object-cover"
          />
          {/* Type label */}
          <div className="absolute top-2 right-2 z-10">
            <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-semibold ${type === 'free'
              ? 'bg-green-100 text-green-800'
              : 'bg-purple-100 text-purple-800'
              }`}>
              {type === 'free' ? 'Free' : 'Barter'}
            </span>
          </div>
          {/* Status label */}
          {status !== 'available' && (
            <div className="absolute top-2 left-2 z-10">
              <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-semibold ${status === 'traded' || status === 'claimed'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-yellow-100 text-yellow-800'
                }`}>
                {status === 'traded' ? 'Traded' :
                  status === 'claimed' ? 'Claimed' :
                    status === 'pending' ? 'Pending' : ''}
              </span>
            </div>
          )}
          {allImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-0.5 sm:p-1 hover:bg-opacity-75"
              >
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-0.5 sm:p-1 hover:bg-opacity-75"
              >
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="p-2 sm:p-4">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-0.5 sm:mb-1 line-clamp-1">{title}</h3>
          <p className="text-gray-600 text-sm mb-3">
            {(description || '').length > 60 ? `${(description || '').substring(0, 60)}...` : (description || 'No description available')}
          </p>

          <div className="flex items-center text-xs text-gray-500 mb-3">
            <MapPin size={12} className="mr-1" />
            <span className="truncate max-w-[150px]">{location || 'Unknown location'}</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
              {condition}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default ItemCard;