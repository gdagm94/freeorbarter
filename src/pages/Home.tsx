import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ItemCard from '../components/ItemCard';
import { Item } from '../types';

interface HomeProps {
  // Define any props the Home component might receive
}

function Home({}: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    latitude?: number;
    longitude?: number;
    radius?: number;
  }>({});

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('items')
          .select('*')
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        // If we have location filters active, add location-based filtering
        if (filters.latitude && filters.longitude && filters.radius) {
          // Convert radius from km to degrees (approximate)
          const radiusDegrees = filters.radius / 111;
          
          query = query
            .gte('latitude', filters.latitude - radiusDegrees)
            .lte('latitude', filters.latitude + radiusDegrees)
            .gte('longitude', filters.longitude - radiusDegrees)
            .lte('longitude', filters.longitude + radiusDegrees);
        }

        const { data: availableItems, error: availableError } = await query;

        if (availableError) {
          console.error('Error fetching available items:', availableError);
          throw availableError;
        }

        setItems(availableItems || []);
      } catch (error) {
        console.error('Error fetching items:', error);
        setError('Failed to load items. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center">
          <p className="text-xl font-semibold">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {items.length === 0 ? (
        <div className="text-center text-gray-600">
          <p className="text-xl">No items available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              image={item.images[0]}
              images={item.images}
              condition={item.condition}
              location={item.location}
              type={item.type}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;