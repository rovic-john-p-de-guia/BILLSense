import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getExchangeRate as backendGetExchangeRate } from '../../../backend/services/exchangeRateService';

/**
 * GET handler for retrieving exchange rates without exposing API keys
 * This endpoint is safe to call from the client since it doesn't expose sensitive info
 */
export const GET: RequestHandler = async ({ url }) => {
  const from = url.searchParams.get('from') || 'PHP';
  const to = url.searchParams.get('to') || 'USD';
  const amount = parseFloat(url.searchParams.get('amount') || '1');
  
  try {
    // Use the backend service to get the exchange rate
    const rate = await backendGetExchangeRate(from, to);
    
    // Return the result without exposing the API key
    return json({
      from,
      to,
      amount,
      rate,
      converted: amount * rate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    return new Response('Error getting exchange rate', { status: 500 });
  }
}; 