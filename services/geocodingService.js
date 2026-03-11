const axios = require('axios');

/**
 * Geocoding service to get accurate addresses from coordinates
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
const geocodingService = {
  /**
   * Reverse geocode: Get address from latitude and longitude
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Address details including formatted address, pin code, etc.
   */
  async reverseGeocode(lat, lng) {
    try {
      // OpenStreetMap Nominatim API (free, no API key needed)
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1,
          zoom: 18, // High detail level
        },
        headers: {
          'User-Agent': 'TMS-Geocoding-Service/1.0', // Required by Nominatim
        },
        timeout: 5000,
      });

      if (response.data && response.data.address) {
        const addr = response.data.address;
        
        // Build formatted address
        const addressParts = [];
        if (addr.road) addressParts.push(addr.road);
        if (addr.suburb || addr.neighbourhood) addressParts.push(addr.suburb || addr.neighbourhood);
        if (addr.city || addr.town || addr.village) addressParts.push(addr.city || addr.town || addr.village);
        if (addr.state) addressParts.push(addr.state);
        if (addr.country) addressParts.push(addr.country);
        
        const formattedAddress = addressParts.join(', ');
        
        // Extract pin code (postcode)
        const pinCode = addr.postcode || null;
        
        return {
          success: true,
          formattedAddress: formattedAddress || response.data.display_name,
          pinCode,
          address: {
            road: addr.road || null,
            suburb: addr.suburb || addr.neighbourhood || null,
            city: addr.city || addr.town || addr.village || null,
            state: addr.state || null,
            country: addr.country || null,
            postcode: addr.postcode || null,
          },
          displayName: response.data.display_name,
        };
      }

      return {
        success: false,
        error: 'No address data found',
      };
    } catch (error) {
      console.error('Geocoding error:', error.message);
      return {
        success: false,
        error: error.message || 'Geocoding service unavailable',
      };
    }
  },

  /**
   * Forward geocode: Get coordinates from address string
   * @param {string} address - Address string
   * @returns {Promise<Object>} Coordinates and address details
   */
  async forwardGeocode(address) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          addressdetails: 1,
          limit: 1,
        },
        headers: {
          'User-Agent': 'TMS-Geocoding-Service/1.0',
        },
        timeout: 5000,
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const addr = result.address || {};
        
        return {
          success: true,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
          pinCode: addr.postcode || null,
          address: {
            road: addr.road || null,
            suburb: addr.suburb || addr.neighbourhood || null,
            city: addr.city || addr.town || addr.village || null,
            state: addr.state || null,
            country: addr.country || null,
            postcode: addr.postcode || null,
          },
        };
      }

      return {
        success: false,
        error: 'Address not found',
      };
    } catch (error) {
      console.error('Forward geocoding error:', error.message);
      return {
        success: false,
        error: error.message || 'Geocoding service unavailable',
      };
    }
  },

  /**
   * Geocode by Indian pin code (postal code): Get coordinates + formatted address
   * Forces India results to avoid "other country" matches.
   * @param {string} pinCode
   */
  async geocodePinCode(pinCode) {
    try {
      const cleaned = String(pinCode || '').trim();
      if (!/^\d{6}$/.test(cleaned)) {
        return { success: false, error: 'Invalid pin code. Please enter a 6-digit Indian pin code.' };
      }

      // Prefer structured search with country restriction
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          postalcode: cleaned,
          countrycodes: 'in',
          format: 'json',
          addressdetails: 1,
          limit: 1,
        },
        headers: {
          'User-Agent': 'TMS-Geocoding-Service/1.0',
        },
        timeout: 5000,
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const addr = result.address || {};

        return {
          success: true,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
          pinCode: addr.postcode || cleaned,
          address: {
            road: addr.road || null,
            suburb: addr.suburb || addr.neighbourhood || null,
            city: addr.city || addr.town || addr.village || null,
            state: addr.state || null,
            country: addr.country || 'India',
            postcode: addr.postcode || cleaned,
          },
        };
      }

      // Fallback: free-text query (still restricted to India)
      const fallback = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${cleaned}, India`,
          countrycodes: 'in',
          format: 'json',
          addressdetails: 1,
          limit: 1,
        },
        headers: {
          'User-Agent': 'TMS-Geocoding-Service/1.0',
        },
        timeout: 5000,
      });

      if (fallback.data && fallback.data.length > 0) {
        const result = fallback.data[0];
        const addr = result.address || {};
        return {
          success: true,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
          pinCode: addr.postcode || cleaned,
          address: {
            road: addr.road || null,
            suburb: addr.suburb || addr.neighbourhood || null,
            city: addr.city || addr.town || addr.village || null,
            state: addr.state || null,
            country: addr.country || 'India',
            postcode: addr.postcode || cleaned,
          },
        };
      }

      return { success: false, error: 'Pin code not found in India' };
    } catch (error) {
      console.error('Pin code geocoding error:', error.message);
      return {
        success: false,
        error: error.message || 'Geocoding service unavailable',
      };
    }
  },
};

module.exports = geocodingService;
