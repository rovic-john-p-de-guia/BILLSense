/**
 * Utility functions for text-to-speech functionality
 */

/**
 * Speak text using the browser's speech synthesis API
 * @param text - Text to be spoken
 * @param lang - Language code (default: 'en-US')
 * @param rate - Speech rate (0.1 to 10, default: 1)
 * @param pitch - Speech pitch (0 to 2, default: 1)
 * @param volume - Speech volume (0 to 1, default: 1)
 * @returns Promise that resolves when speech is complete or rejects on error
 */
export function speak(
  text: string, 
  lang = 'en-US', 
  rate = 1, 
  pitch = 2, 
  volume = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
      console.warn('Text-to-speech not supported in this browser');
      reject(new Error('Text-to-speech not supported'));
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set speech properties
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    // Handle completion
    utterance.onend = () => {
      resolve();
    };
    
    // Handle errors
    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };
    
    // Speak the text
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Format currency for speech
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted text for speech
 */
export function formatCurrencyForSpeech(amount: string | number, currency: string): string {
  // Default to 'unknown amount' if no amount is provided
  const amountStr = amount ? amount.toString() : 'unknown amount';
  
  // Format currency names
  const currencyNames: Record<string, string> = {
    'PHP': 'Philippine Peso',
    'USD': 'US Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound',
    'JPY': 'Japanese Yen',
    'CNY': 'Chinese Yuan',
    'AUD': 'Australian Dollar',
    'CAD': 'Canadian Dollar'
  };
  
  // Get full currency name or use the code
  const currencyName = currencyNames[currency] || currency;
  
  return `${amountStr} ${currencyName}`;
}

/**
 * Announce bill details using text-to-speech
 * @param amount - Bill amount
 * @param currency - Currency code
 * @param extraInfo - Additional information to announce (optional)
 */
export function announceBill(
  amount: string | number, 
  currency: string,
  extraInfo?: string
): Promise<void> {
  const formattedText = formatCurrencyForSpeech(amount, currency);
  const textToSpeak = extraInfo 
    ? `Detected ${formattedText}. ${extraInfo}` 
    : `Detected ${formattedText}.`;
  
  return speak(textToSpeak);
} 