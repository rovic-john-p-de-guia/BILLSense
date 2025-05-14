<script lang="ts">
  import { onMount } from 'svelte';
  import { getExchangeRate } from '../services/exchangeRateService';

  export let fromCurrency = 'PHP';
  export let toCurrency = 'USD';
  export let amount = 1;
  export let showDebugInfo = false; // Enable to show debugging information
  export let compact = false; // Add compact mode option
  
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

<div class="exchange-rate-widget {compact ? 'compact' : ''}">
  {#if !compact}
  <div class="widget-header">
    <div class="icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8" />
        <line x1="16.5" y1="9.5" x2="7.5" y2="14.5" />
        <polyline points="14 7 16.5 9.5 14 12" />
        <polyline points="10 17 7.5 14.5 10 12" />
      </svg>
    </div>
    <div class="title">Exchange Rate</div>
  </div>
  {/if}
  <div class="widget-content">
    {#if loading}
      <div class="loading">
        {#if compact}
          <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>
        {:else}
          <div class="loading-spinner"></div>
          <span>Loading exchange rates</span>
        {/if}
      </div>
    {:else if error}
      <div class="error">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {compact ? 'Error' : 'Unable to load exchange rates'}
        {#if showDebugInfo && errorMessage && !compact}
          <div class="error-details">{errorMessage}</div>
        {/if}
      </div>
    {:else}
      <div class="rate-display">
        {#if !compact}
        <div class="currency-group from-currency">
          <span class="amount">{amount}</span>
          <span class="currency-name">{fromCurrency}</span>
        </div>
        <div class="conversion-arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </div>
        {/if}
        <div class="currency-group to-currency">
          <span class="converted">{formatCurrency(convertedValue, toCurrency)}</span>
          {#if !compact}
          <span class="currency-name">{getCurrencyName(toCurrency)}</span>
          {/if}
        </div>
      </div>
      {#if !compact}
      <div class="widget-footer">
        <span class="disclaimer">Rates are approximate</span>
        {#if showDebugInfo && lastUpdated}
          <div class="debug-info">
            <span>Rate: {rate.toFixed(6)}</span>
            <span>Updated: {formatDate(lastUpdated)}</span>
          </div>
        {/if}
      </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .exchange-rate-widget {
    width: 100%;
    max-width: 320px;
    border-radius: 12px;
    overflow: hidden;
    background-color: white;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    transition: all 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .exchange-rate-widget:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  .exchange-rate-widget.compact {
    max-width: none;
    box-shadow: none;
    background: transparent;
    border: none;
  }

  .widget-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    background: linear-gradient(135deg, #4a6cf7 0%, #2e51ed 100%);
    border-bottom: none;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    margin-right: 12px;
    backdrop-filter: blur(4px);
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: white;
    letter-spacing: 0.3px;
  }

  .widget-content {
    padding: 20px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .compact .widget-content {
    padding: 0;
    min-height: auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #666;
    font-size: 14px;
    height: 100%;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #4a6cf7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-dots span {
    animation: loadingDots 1.4s infinite both;
    display: inline-block;
    font-size: 20px;
    opacity: 0;
  }

  .loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes loadingDots {
    0% { opacity: 0; transform: translateY(0); }
    25% { opacity: 1; transform: translateY(-3px); }
    50% { opacity: 0; transform: translateY(0); }
    100% { opacity: 0; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #e53e3e;
    font-size: 14px;
    height: 100%;
    text-align: center;
    flex-wrap: wrap;
  }

  .error-details {
    width: 100%;
    margin-top: 8px;
    font-size: 12px;
    color: #718096;
    background-color: #f7fafc;
    padding: 8px;
    border-radius: 6px;
    word-break: break-word;
  }

  .rate-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: fadeScale 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  .compact .rate-display {
    flex-direction: row;
    justify-content: center;
  }

  @keyframes fadeScale {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .currency-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .from-currency .amount {
    font-size: 24px;
    font-weight: 600;
    color: #2d3748;
  }

  .currency-name {
    font-size: 14px;
    color: #718096;
    font-weight: 500;
  }

  .conversion-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a0aec0;
    transform: rotate(90deg);
    height: 28px;
  }

  .to-currency {
    position: relative;
  }

  .converted {
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(90deg, #4a6cf7 0%, #3b82f6 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    position: relative;
  }

  .compact .converted {
    font-size: 20px;
    font-weight: 600;
  }

  .widget-footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 12px;
    color: #a0aec0;
    text-align: center;
  }

  .disclaimer {
    font-style: italic;
  }

  .debug-info {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: #718096;
    background-color: #f7fafc;
    padding: 8px;
    border-radius: 6px;
    text-align: left;
  }

  .form-control {
    background-color: var(--color-bg-primary, white);
  }

  .converter-label {
    color: var(--color-text-secondary, #718096);
  }

  .rate-value {
    color: var(--color-text-accent, #e53e3e);
  }

  .rate-info {
    color: var(--color-text-secondary, #718096);
  }

  .from-amount {
    color: var(--color-text-primary, #2d3748);
  }

  .equals {
    color: var(--color-text-secondary, #718096);
  }

  .to-amount {
    color: var(--color-text-secondary, #a0aec0);
  }

  .rate-timestamp {
    color: var(--color-text-secondary, #a0aec0);
  }

  .swap-button {
    color: var(--color-text-secondary, #718096);
    background-color: var(--color-bg-accent, #f7fafc);
  }
</style> 