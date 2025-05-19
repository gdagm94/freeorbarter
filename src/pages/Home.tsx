// Update the fetchItems function in Home.tsx to use location data
const fetchItems = async () => {
  try {
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