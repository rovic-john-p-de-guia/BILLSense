/**
 * Service for fetching exchange rates using exchangerate-api.com
 */

// API key for exchangerate-api.com
const API_KEY = 'b23017658177e0dbc0bd1d1e';
const API_BASE_URL = 'https://v6.exchangerate-api.com/v6';

// Cache exchange rates to avoid excessive API calls
const rateCache: Record<string, number> = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Get the latest exchange rate between two currencies
 * @param from - Source currency code (e.g., 'PHP')
 * @param to - Target currency code (e.g., 'USD')
 * @returns Exchange rate
 */
export async function getExchangeRate(from = 'PHP', to = 'USD'): Promise<number> {
  const cacheKey = `${from}_${to}`;
  const now = Date.now();
  
  // Check if we have a cached rate that's still valid
  if (rateCache[cacheKey] && now - cacheTimestamp < CACHE_DURATION) {
    return rateCache[cacheKey];
  }
  
  try {
    // Use the pair conversion endpoint for better performance
    const response = await fetch(`${API_BASE_URL}/${API_KEY}/pair/${from}/${to}`);
    
    if (!response.ok) {
      // If pair endpoint fails, fall back to the standard endpoint
      return getExchangeRateFromStandardEndpoint(from, to);
    }
    
    const data = await response.json();
    
    // Check if the API returned a success response
    if (data.result === 'success' && data.conversion_rate) {
      // Update cache
      rateCache[cacheKey] = data.conversion_rate;
      cacheTimestamp = now;
      return data.conversion_rate;
    } else {
      return getExchangeRateFromStandardEndpoint(from, to);
    }
  } catch (error) {
    console.error('Error fetching exchange rate from pair endpoint:', error);
    // Try the standard endpoint as fallback
    return getExchangeRateFromStandardEndpoint(from, to);
  }
}

/**
 * Fallback method to get exchange rate from the standard endpoint
 */
async function getExchangeRateFromStandardEndpoint(from: string, to: string): Promise<number> {
  const cacheKey = `${from}_${to}`;
  
  try {
    // Use the standard latest rates endpoint as fallback
    const response = await fetch(`${API_BASE_URL}/${API_KEY}/latest/${from}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if the API returned a success response
    if (data.result === 'success' && data.conversion_rates && data.conversion_rates[to]) {
      // Update cache
      rateCache[cacheKey] = data.conversion_rates[to];
      cacheTimestamp = Date.now();
      return data.conversion_rates[to];
    } else {
      throw new Error('Rate not found in API response');
    }
  } catch (error) {
    console.error('Error fetching exchange rate from standard endpoint:', error);
    return getFallbackRate(from, to);
  }
}

/**
 * Get a fallback exchange rate when API calls fail
 */
function getFallbackRate(from: string, to: string): number {
  // Fallback to approximate fixed rates if API calls fail
  const fallbackRates: Record<string, Record<string, number>> = {
    'PHP': {
      'USD': 0.0177, // Philippine Peso to USD
      'EUR': 0.0163, // Philippine Peso to Euro
      'GBP': 0.0139, // Philippine Peso to British Pound
      'JPY': 2.6442, // Philippine Peso to Japanese Yen
      'AUD': 0.0269, // Philippine Peso to Australian Dollar
      'CAD': 0.0241, // Philippine Peso to Canadian Dollar
      'SGD': 0.0239  // Philippine Peso to Singapore Dollar
    },
    'USD': {
      'PHP': 56.5028, // USD to Philippine Peso
      'EUR': 0.9212,  // USD to Euro
      'GBP': 0.7855,  // USD to British Pound
      'JPY': 149.3924, // USD to Japanese Yen
      'AUD': 1.5177,  // USD to Australian Dollar
      'CAD': 1.3645,  // USD to Canadian Dollar
      'SGD': 1.3508   // USD to Singapore Dollar
    },
    'EUR': {
      'USD': 1.0853,  // Euro to USD
      'PHP': 61.3362, // Euro to Philippine Peso
      'GBP': 0.8527,  // Euro to British Pound
      'JPY': 162.1737, // Euro to Japanese Yen
      'AUD': 1.6474,  // Euro to Australian Dollar
      'CAD': 1.4812,  // Euro to Canadian Dollar
      'SGD': 1.4662   // Euro to Singapore Dollar
    }
  };
  
  // Try to get the fallback rate
  if (fallbackRates[from] && fallbackRates[from][to]) {
    return fallbackRates[from][to];
  }
  
  // If we don't have a specific fallback, try to calculate via USD as an intermediary
  if (from !== 'USD' && to !== 'USD' && fallbackRates[from]?.['USD'] && fallbackRates['USD']?.[to]) {
    // Convert from source currency to USD, then from USD to target currency
    return fallbackRates[from]['USD'] * fallbackRates['USD'][to];
  }
  
  // Last resort fallback
  return 1.0; // Default to 1:1 if we can't determine the rate
}

/**
 * Convert an amount from one currency to another
 * @param amount - Amount to convert
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Converted amount
 */
export async function convertCurrency(amount: number, from = 'PHP', to = 'USD'): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
} 