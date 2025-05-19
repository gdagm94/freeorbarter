export function validateLocationData(location: any): { isValid: boolean; error?: string } {
  if (!location) {
    return { isValid: false, error: 'Location is required' };
  }
  
  // Check if we have the minimum required fields
  if (!location.city || !location.state) {
    return { isValid: false, error: 'City and state are required' };
  }
  
  // Make sure coordinates are valid
  if (isNaN(location.latitude) || isNaN(location.longitude)) {
    return { isValid: false, error: 'Invalid coordinates' };
  }
  
  // Check coordinate ranges
  if (location.latitude < -90 || location.latitude > 90) {
    return { isValid: false, error: 'Invalid latitude' };
  }
  
  if (location.longitude < -180 || location.longitude > 180) {
    return { isValid: false, error: 'Invalid longitude' };
  }
  
  // If zipcode is provided, validate its format
  if (location.zipcode && !/^\d{5}(-\d{4})?$/.test(location.zipcode)) {
    return { isValid: false, error: 'Invalid ZIP code format' };
  }
  
  return { isValid: true };
}