/**
 * Backend configuration with environment variables
 * This file centralizes access to environment variables to make them easier to manage
 */
import { EXCHANGE_RATE_API_KEY, JWT_SECRET } from '$env/static/private';

export const config = {
  /**
   * API Keys and credentials
   */
  keys: {
    exchangeRate: EXCHANGE_RATE_API_KEY,
    jwt: JWT_SECRET,
  },
  
  /**
   * API endpoints and URLs
   */
  urls: {
    exchangeRateApi: 'https://v6.exchangerate-api.com/v6',
  },
  
  /**
   * Security settings
   */
  security: {
    tokenExpiration: '1h', // 1 hour token expiration
  },
  
  /**
   * Cache settings
   */
  cache: {
    exchangeRateDuration: 3600000, // 1 hour in milliseconds
  }
}; 