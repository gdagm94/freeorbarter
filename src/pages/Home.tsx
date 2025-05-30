import React, { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import { Map } from '../components/Map';
import { ChangelogPopup } from '../components/ChangelogPopup';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { useAuth } from '../hooks/useAuth';

// Constants for Earth's radius and conversion
const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers
const DEG_TO_RAD = Math.PI / 180;
const MAP_FILTER_STATE_KEY = 'map_filter_state';

function calculateBoundingBox(lat: number, lon: number, radiusMiles: number) {
  // Convert miles to kilometers
  const radiusKm = radiusMiles * 1.60934;
  
  // Convert latitude and longitude to radians
  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;

  // Angular distance in radians on a great circle
  const radDist = radiusKm / EARTH_RADIUS_KM;

  // Calculate min and max latitudes
  let minLat = latRad - radDist;
  let maxLat = latRad + radDist;

  // Calculate min and max longitudes
  let deltaLon;
  if (minLat > -Math.PI/2 && maxLat < Math.PI/2) {
    deltaLon = Math.asin(Math.sin(radDist) / Math.cos(latRad));
  } else {
    deltaLon = Math.PI;
  }

  let minLon = lonRad - deltaLon;
  let maxLon = lonRad + deltaLon;

  // Convert back to degrees
  return {
    minLat: (minLat * 180) / Math.PI,
    maxLat: (maxLat * 180) / Math.PI,
    minLon: (minLon * 180) / Math.PI,
    maxLon: (maxLon * 180) / Math.PI
  };
}

function Home() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const savedState = sessionStorage.getItem(MAP_FILTER_STATE_KEY);
      return savedState ? JSON.parse(savedState).searchQuery || '' : '';
    } catch {
      return '';
    }
  });

  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [barteredItems, setBarteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [filters, setFilters] = useState(() => {
    try {
      const savedState = sessionStorage.getItem(MAP_FILTER_STATE_KEY);
      const defaultFilters = {
        category: '',
        condition: '',
        radius: 5, // Changed default from 10 to 5 miles
        latitude: 0,
        longitude: 0,
      };
      return savedState ? { ...defaultFilters, ...JSON.parse(savedState).filters } : defaultFilters;
    } catch {
      return {
        category: '',
        condition: '',
        radius: 5, // Changed default from 10 to 5 miles
        latitude: 0,
        longitude: 0,
      };
    }
  });

  // Save filter state to sessionStorage whenever it changes
  useEffect(() => {
    const filterState = {
      searchQuery,
      filters,
      showFilters,
    };
    sessionStorage.setItem(MAP_FILTER_STATE_KEY, JSON.stringify(filterState));
  }, [searchQuery, filters, showFilters]);

  useEffect(() => {
    const checkChangelogDismissal = async () => {
      if (!user) {
        setShowChangelog(true);
        return;
      }

      try {
        // Get the latest changelog
        const { data: latestChangelog, error: changelogError } = await supabase
          .from('changelogs')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (changelogError) throw changelogError;
        if (!latestChangelog) return;

        // Check if user has dismissed this changelog
        const { data: dismissal, error: dismissalError } = await supabase
          .from('changelog_dismissals')
          .select('id')
          .eq('user_id', user.id)
          .eq('changelog_id', latestChangelog.id)
          .maybeSingle();

        if (dismissalError) throw dismissalError;

        // Show changelog if user hasn't dismissed it
        setShowChangelog(!dismissal);
      } catch (err) {
        console.error('Error checking changelog dismissal:', err);
      }
    };

    checkChangelogDismissal();
  }, [user]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        let query = supabase
          .from('items')
          .select('*')
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        // Apply location-based filtering if coordinates are available
        if (filters.latitude && filters.longitude && filters.radius) {
          const bbox = calculateBoundingBox(filters.latitude, filters.longitude, filters.radius);
          
          query = query
            .gte('latitude', bbox.minLat)
            .lte('latitude', bbox.maxLat)
            .gte('longitude', bbox.minLon)
            .lte('longitude', bbox.maxLon);
        }

        const { data: availableItems, error: availableError } = await query;

        if (availableError) {
          console.error('Error fetching available items:', availableError);
          throw availableError;
        }

        // Fetch recently bartered items
        const { data: recentlyBartered, error: barteredError } = await supabase
          .from('items')
          .select('*')
          .eq('status', 'traded')
          .eq('type', 'barter')
          .order('created_at', { ascending: false })
          .limit(6);

        if (barteredError) {
          console.error('Error fetching bartered items:', barteredError);
          throw barteredError;
        }

        setItems(availableItems || []);
        setBarteredItems(recentlyBartered || []);
      } catch (error) {
        console.error('Error fetching items:', error);
        setError('Failed to load items. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();

    // Subscribe to new items
    const subscription = supabase
      .channel('public:items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as Item;
            if (newItem.status === 'available') {
              setItems(prev => [newItem, ...prev]);
            } else if (newItem.status === 'traded') {
              if (newItem.type === 'barter') {
                setBarteredItems(prev => [newItem, ...prev.slice(0, 5)]);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as Item;
            if (updatedItem.status === 'available') {
              setItems(prev => [updatedItem, ...prev.filter(item => item.id !== updatedItem.id)]);
              setBarteredItems(prev => prev.filter(item => item.id !== updatedItem.id));
            } else if (updatedItem.status === 'traded') {
              setItems(prev => prev.filter(item => item.id !== updatedItem.id));
              if (updatedItem.type === 'barter') {
                setBarteredItems(prev => [updatedItem, ...prev.filter(item => item.id !== updatedItem.id).slice(0, 5)]);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [filters.latitude, filters.longitude, filters.radius]);

  // Filter and sort items based on search query and filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = !filters.category || item.category === filters.category;
      const matchesCondition = !filters.condition || item.condition === filters.condition;

      return matchesSearch && matchesCategory && matchesCondition;
    });
  }, [items, searchQuery, filters]);

  // Split filtered items into sections
  const sections = useMemo(() => {
    if (searchQuery || filters.category || filters.condition) {
      // If searching or filtering, just show all matching items in one section
      return [
        {
          id: 'search-results',
          title: `${filteredItems.length} ${filteredItems.length === 1 ? 'Result' : 'Results'}`,
          items: filteredItems
        }
      ];
    }

    // Otherwise, split into sections
    const nearbyItems = filteredItems.slice(0, 2);
    const recommendedItems = filteredItems.slice(2, 6);
    const newItems = filteredItems;

    return [
      { id: 'nearby', title: 'Near You', items: nearbyItems },
      { id: 'recommended', title: 'Recommended', items: recommendedItems },
      { id: 'bartered', title: 'Recently Bartered', items: barteredItems },
      { id: 'new', title: 'New Listings', items: newItems }
    ];
  }, [filteredItems, searchQuery, filters, barteredItems]);

  const handleLocationChange = (lat: number, lng: number) => {
    setFilters(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleRadiusChange = (radius: number) => {
    setFilters(prev => ({ ...prev, radius }));
  };

  const handleLocationSelect = (location: any) => {
    setFilters(prev => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude
    }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      condition: '',
      radius: 5, // Changed default from 10 to 5 miles
      latitude: 0,
      longitude: 0,
    });
    setSearchQuery('');
    sessionStorage.removeItem(MAP_FILTER_STATE_KEY);
  };

  const handleCloseFilters = () => {
    setShowFilters(false);
    clearFilters();
  };

  const renderItemSection = (title: string, items: Item[], sectionId: string) => (
    <div key={sectionId} className="mb-8 sm:mb-12">
      <div className="flex justify-between items-center mb-3 sm:mb-4 px-4 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {(searchQuery || filters.category || filters.condition) && (
          <button
            onClick={clearFilters}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Clear filters
          </button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 px-4 sm:px-0">
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
              status={item.status}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg mx-4 sm:mx-0">
          No items found
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-8 px-4 sm:px-0">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base"
            value={searchQuery}
            onChange={handleSearch}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-center px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm sm:text-base"
        >
          <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          <span>Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 sm:mb-8 bg-white p-4 sm:p-6 rounded-lg shadow-md relative mx-4 sm:mx-0">
          <button
            onClick={handleCloseFilters}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:text-base"
              >
                <option value="">All Categories</option>
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="clothing">Clothing</option>
                <option value="sports">Sports & Outdoors</option>
                <option value="books">Books & Media</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition
              </label>
              <select
                value={filters.condition}
                onChange={(e) => setFilters(prev => ({ ...prev, condition: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:text-base"
              >
                <option value="">Any Condition</option>
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
          <Map 
            onLocationChange={handleLocationChange} 
            onRadiusChange={handleRadiusChange}
            onLocationSelect={handleLocationSelect}
            selectedLocation={filters.latitude && filters.longitude ? {
              latitude: filters.latitude,
              longitude: filters.longitude
            } : undefined}
            items={filteredItems}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 mx-4 sm:mx-0">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-8 px-4 sm:px-0">
          {[1, 2, 3].map((section) => (
            <div key={`loading-${section}`} className="animate-pulse">
              <div className="h-6 sm:h-8 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {[1, 2, 3, 4].map((item) => (
                  <div key={`loading-${section}-${item}`} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="aspect-square bg-gray-200"></div>
                    <div className="p-2 sm:p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {sections.map(section => renderItemSection(section.title, section.items, section.id))}
        </div>
      )}

      {showChangelog && <ChangelogPopup onDismiss={() => setShowChangelog(false)} />}
    </div>
  );
}

export default Home;