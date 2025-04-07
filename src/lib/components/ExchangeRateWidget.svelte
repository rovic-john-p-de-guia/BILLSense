<script lang="ts">
  import { onMount } from 'svelte';
  import { getExchangeRate } from '../services/exchangeRateService';

  export let fromCurrency = 'PHP';
  export let toCurrency = 'USD';
  export let amount = 1;
  export let showDebugInfo = false; // Enable to show debugging information
  
  let rate = 1;
  let loading = true;
  let error = false;
  let errorMessage = '';
  let lastUpdated: Date | null = null;
  
  // Format the currency value with appropriate symbol
  function formatCurrency(value: number, currency: string): string {
    switch(currency) {
      case 'USD':
        return `$${value.toFixed(2)}`;
      case 'PHP':
        return `₱${value.toFixed(2)}`;
      case 'EUR':
        return `€${value.toFixed(2)}`;
      case 'GBP':
        return `£${value.toFixed(2)}`;
      case 'JPY':
        return `¥${Math.round(value)}`;
      case 'INR':
        return `₹${value.toFixed(2)}`;
      case 'AUD':
      case 'CAD':
      case 'SGD':
      case 'NZD':
        return `$${value.toFixed(2)} ${currency}`;
      default:
        return `${value.toFixed(2)} ${currency}`;
    }
  }

  // Format the currency name
  function getCurrencyName(code: string): string {
    const names: Record<string, string> = {
      'PHP': 'Philippine Peso',
      'USD': 'US Dollar',
      'EUR': 'Euro',
      'GBP': 'British Pound',
      'JPY': 'Japanese Yen',
      'CNY': 'Chinese Yuan',
      'INR': 'Indian Rupee',
      'AUD': 'Australian Dollar',
      'CAD': 'Canadian Dollar',
      'SGD': 'Singapore Dollar',
      'NZD': 'New Zealand Dollar',
      'KRW': 'South Korean Won',
      'MXN': 'Mexican Peso',
      'BRL': 'Brazilian Real',
      'CHF': 'Swiss Franc',
      'HKD': 'Hong Kong Dollar',
      'SEK': 'Swedish Krona',
      'ZAR': 'South African Rand',
      'RUB': 'Russian Ruble',
      'TRY': 'Turkish Lira'
    };
    return names[code] || code;
  }
  
  // Format a date for display
  function formatDate(date: Date): string {
    return date.toLocaleString();
  }
  
  // Calculate the conversion
  $: convertedValue = amount * rate;
  
  // Retry mechanism for rate fetching
  async function retryFetchRate(maxRetries = 2): Promise<void> {
    let retries = 0;
    let success = false;
    
    while (retries <= maxRetries && !success) {
      try {
        rate = await getExchangeRate(fromCurrency, toCurrency);
        lastUpdated = new Date();
        success = true;
        error = false;
        errorMessage = '';
      } catch (err) {
        retries++;
        console.error(`Retry ${retries}/${maxRetries} failed:`, err);
        
        if (retries > maxRetries) {
          error = true;
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
  }
  
  // Fetch the exchange rate when the component mounts or when currency changes
  async function fetchRate(): Promise<void> {
    loading = true;
    error = false;
    
    try {
      rate = await getExchangeRate(fromCurrency, toCurrency);
      lastUpdated = new Date();
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
      error = true;
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Attempt to retry
      await retryFetchRate();
    } finally {
      loading = false;
    }
  }
  
  // Re-fetch when currencies change
  $: if (fromCurrency && toCurrency) {
    fetchRate();
  }
  
  onMount(() => {
    fetchRate();
  });
</script>

<div class="exchange-rate-widget">
  <div class="widget-header">
    <div class="icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    </div>
    <div class="title">Exchange Rate</div>
  </div>
  <div class="widget-content">
    {#if loading}
      <div class="loading">Loading exchange rates...</div>
    {:else if error}
      <div class="error">
        Unable to load exchange rates
        {#if showDebugInfo && errorMessage}
          <div class="error-details">{errorMessage}</div>
        {/if}
      </div>
    {:else}
      <div class="rate-display">
        <span class="amount">{amount} {getCurrencyName(fromCurrency)}</span>
        <span class="symbol">≈</span>
        <span class="converted">{formatCurrency(convertedValue, toCurrency)}</span>
      </div>
      <div class="widget-footer">
        Rates are approximate
        {#if showDebugInfo && lastUpdated}
          <div class="debug-info">
            <span>Rate: {rate.toFixed(6)}</span>
            <span>Updated: {formatDate(lastUpdated)}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .exchange-rate-widget {
    width: 100%;
    max-width: 320px;
    border-radius: 8px;
    overflow: hidden;
    background-color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  .widget-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background-color: #f5f7fa;
    border-bottom: 1px solid #e1e4e8;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: #0066cc;
    color: white;
    margin-right: 12px;
  }

  .title {
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  .widget-content {
    padding: 16px;
    min-height: 100px;
  }

  .rate-display {
    font-size: 18px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
  }

  .amount {
    font-weight: 500;
    color: #000;
    margin-bottom: 4px;
  }

  .symbol {
    color: #666;
    margin: 2px 0;
  }

  .converted {
    font-weight: 600;
    color: #000;
    font-size: 24px;
  }

  .widget-footer {
    font-size: 12px;
    color: #666;
    text-align: left;
    margin-top: 12px;
  }
  
  .loading, .error {
    font-size: 14px;
    color: #666;
    text-align: center;
    padding: 20px 0;
  }
  
  .error {
    color: #d73a49;
  }
  
  .error-details {
    font-size: 12px;
    margin-top: 8px;
    color: #d73a49;
    opacity: 0.8;
  }
  
  .debug-info {
    margin-top: 8px;
    font-family: monospace;
    font-size: 10px;
    color: #666;
    opacity: 0.7;
    display: flex;
    flex-direction: column;
  }
</style> 