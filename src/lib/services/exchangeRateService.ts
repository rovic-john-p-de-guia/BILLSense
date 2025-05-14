/**
 * Frontend service for exchange rates - uses the public API endpoint
 * This approach avoids importing backend code that uses $env/static/private
 */

/**
 * Get the latest exchange rate between two currencies
 * @param from - Source currency code (e.g., 'PHP')
 * @param to - Target currency code (e.g., 'USD')
 * @returns Exchange rate
 */
export async function getExchangeRate(from = 'PHP', to = 'USD'): Promise<number> {
  try {
    const response = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get exchange rate: ${response.status}`);
    }
    
    const data = await response.json();
    return data.rate;
  } catch (error) {
    console.error('Error in frontend getExchangeRate:', error);
    throw error;
  }
}

/**
 * Convert an amount from one currency to another
 * @param amount - Amount to convert
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Converted amount
 */
export async function convertCurrency(amount: number, from = 'PHP', to = 'USD'): Promise<number> {
  try {
    const response = await fetch(`/api/exchange-rate?from=${from}&to=${to}&amount=${amount}`);
    
    if (!response.ok) {
      throw new Error(`Failed to convert currency: ${response.status}`);
    }
    
    const data = await response.json();
    return data.converted;
  } catch (error) {
    console.error('Error in frontend convertCurrency:', error);
    throw error;
  }
} 