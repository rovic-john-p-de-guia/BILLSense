<script lang="ts">
  import { slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  export let show: boolean = false;
  export let autoAnnounce: boolean = false;
  export let preferredCurrency: string = "USD";
  export let speechRate: number = 1;
  export let speechVolume: number = 1;
  export let invertCamera: boolean = true;
  export let alwaysUseBackCamera: boolean = true;
  export let darkMode: boolean = false;
  
  // Create a copy of settings for editing
  let tempSettings = {
    autoAnnounce,
    preferredCurrency,
    speechRate,
    speechVolume,
    invertCamera,
    alwaysUseBackCamera,
    darkMode
  };
  
  let voiceSupported = false;
  let commonCurrencies = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "PHP", name: "Philippine Peso" }
  ];
  
  // Check for voice support on mount
  onMount(() => {
    if (typeof window !== 'undefined') {
      voiceSupported = 'speechSynthesis' in window;
    }
    
    // Load settings from localStorage if available
    loadSavedSettings();
    
    // Initialize the range sliders to show proper fill tracks
    if (typeof window !== 'undefined') {
      // Function to update range fill
      const updateRangeFill = (slider: HTMLInputElement) => {
        if (!slider) return;
        const value = (parseFloat(slider.value) - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min));
        slider.style.setProperty('--value', value.toString());
      };
      
      // Set up the initial values and attach event listeners
      setTimeout(() => {
        const sliders = document.querySelectorAll<HTMLInputElement>('.enhanced-slider');
        sliders.forEach(slider => {
          updateRangeFill(slider);
          slider.addEventListener('input', () => updateRangeFill(slider));
        });
      }, 100);
    }
  });
  
  // Load settings from localStorage if available
  function loadSavedSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const savedSettings = localStorage.getItem('moneyScanner.settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        // Update parent variables with saved settings
        autoAnnounce = parsedSettings.autoAnnounce ?? autoAnnounce;
        preferredCurrency = parsedSettings.preferredCurrency ?? preferredCurrency;
        speechRate = parsedSettings.speechRate ?? speechRate;
        speechVolume = parsedSettings.speechVolume ?? speechVolume;
        invertCamera = parsedSettings.invertCamera ?? invertCamera;
        alwaysUseBackCamera = parsedSettings.alwaysUseBackCamera ?? alwaysUseBackCamera;
        darkMode = parsedSettings.darkMode ?? darkMode;
        
        // Update temp settings
        resetSettings();
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }
  
  // Update parent component with new settings
  function saveSettings() {
    // Update parent variables
    autoAnnounce = tempSettings.autoAnnounce;
    preferredCurrency = tempSettings.preferredCurrency;
    speechRate = tempSettings.speechRate;
    speechVolume = tempSettings.speechVolume;
    invertCamera = tempSettings.invertCamera;
    alwaysUseBackCamera = tempSettings.alwaysUseBackCamera;
    darkMode = tempSettings.darkMode;
    
    // Apply dark mode immediately when saved
    applyTheme(darkMode);
    
    // Save to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('moneyScanner.settings', JSON.stringify(tempSettings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }
    
    closeModal();
  }
  
  // Helper function to apply theme
  function applyTheme(isDark: boolean) {
    if (typeof document !== 'undefined') {
      console.log('SettingsModal: Applying theme, dark mode:', isDark);
      
      // Add or remove dark-theme class to HTML and body elements
      if (isDark) {
        document.documentElement.classList.add('dark-theme');
        document.body.classList.add('dark-theme');
        
        // Also apply dark theme to any iframes and their documents if present
        try {
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.contentDocument) {
              iframe.contentDocument.documentElement.classList.add('dark-theme');
              iframe.contentDocument.body.classList.add('dark-theme');
            }
          });
        } catch (e) {
          // Ignore cross-origin iframe errors
        }
        
        // Specifically target header elements
        const headers = document.querySelectorAll('.app-header, header, .header-content, .logo-container, .main-nav');
        headers.forEach(header => {
          try {
            (header as HTMLElement).classList.add('dark-theme');
          } catch (e) {
            console.warn('Error applying dark theme to header:', e);
          }
        });
        
        // Add dark theme to all header children
        const headerChildren = document.querySelectorAll('.app-header *, header *');
        headerChildren.forEach(child => {
          try {
            (child as HTMLElement).classList.add('dark-theme');
          } catch (e) {
            // Ignore errors
          }
        });
        
        // Fix any modals, transition masks, or overlay elements
        const overlayElements = document.querySelectorAll('.modal-backdrop, .transition-mask, .fade-out, .fade-in, .exit-transition');
        overlayElements.forEach(element => {
          element.classList.add('dark-theme');
        });
        
        // Update meta theme color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', '#000000');
        }
        
        // Handle additional iOS-specific meta tag
        const metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (metaAppleStatusBar) {
          metaAppleStatusBar.setAttribute('content', 'black');
        }
      } else {
        document.documentElement.classList.remove('dark-theme');
        document.body.classList.remove('dark-theme');
        
        // Also remove dark theme from any iframes and their documents if present
        try {
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.contentDocument) {
              iframe.contentDocument.documentElement.classList.remove('dark-theme');
              iframe.contentDocument.body.classList.remove('dark-theme');
            }
          });
        } catch (e) {
          // Ignore cross-origin iframe errors
        }
        
        // Reset header styles
        const headers = document.querySelectorAll('.app-header, header, .header-content, .logo-container, .main-nav');
        headers.forEach(header => {
          try {
            (header as HTMLElement).classList.remove('dark-theme');
          } catch (e) {
            console.warn('Error removing dark theme from header:', e);
          }
        });
        
        // Reset dark theme on all header children
        const headerChildren = document.querySelectorAll('.app-header *, header *');
        headerChildren.forEach(child => {
          try {
            (child as HTMLElement).classList.remove('dark-theme');
          } catch (e) {
            // Ignore errors
          }
        });
        
        // Fix any modals, transition masks, or overlay elements
        const overlayElements = document.querySelectorAll('.modal-backdrop, .transition-mask, .fade-out, .fade-in, .exit-transition');
        overlayElements.forEach(element => {
          element.classList.remove('dark-theme');
        });
        
        // Update meta theme color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', '#ffffff');
        }
        
        // Handle additional iOS-specific meta tag
        const metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (metaAppleStatusBar) {
          metaAppleStatusBar.setAttribute('content', 'default');
        }
      }
      
      // Force a small reflow/repaint to ensure all styles take effect
      setTimeout(() => {
        document.body.style.opacity = '0.99';
        setTimeout(() => {
          document.body.style.opacity = '1';
        }, 10);
      }, 10);
    }
  }
  
  function closeModal() {
    show = false;
  }
  
  // Reset to current settings
  function resetSettings() {
    tempSettings = {
      autoAnnounce,
      preferredCurrency,
      speechRate,
      speechVolume,
      invertCamera,
      alwaysUseBackCamera,
      darkMode
    };
  }
  
  // Test voice feature
  function testVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance("Testing voice settings. This is how the currency announcements will sound.");
      utterance.rate = tempSettings.speechRate;
      utterance.volume = tempSettings.speechVolume;
      
      window.speechSynthesis.speak(utterance);
    }
  }
  
  // Reset settings when modal is opened
  $: if (show) {
    resetSettings();
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeModal} transition:slide={{ duration: 200 }}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-button" on:click={closeModal}>×</button>
      </div>
      
      <div class="modal-content">
        <!-- Appearance Section (New) -->
        <div class="settings-section">
          <h3>Appearance</h3>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="dark-mode">Dark Mode</label>
              <span class="setting-description">Use dark theme for better visibility in low light</span>
            </div>
            <div class="setting-control">
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="dark-mode" 
                  bind:checked={tempSettings.darkMode}
                  on:change={() => applyTheme(tempSettings.darkMode)}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Currency Section -->
        <div class="settings-section">
          <h3>Currency Preferences</h3>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="preferred-currency">Default Target Currency</label>
              <span class="setting-description">Currency to convert to when scanning bills</span>
            </div>
            <div class="setting-control">
              <select 
                id="preferred-currency" 
                bind:value={tempSettings.preferredCurrency}
                class="setting-select"
              >
                {#each commonCurrencies as currency}
                  <option value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                {/each}
              </select>
            </div>
          </div>
        </div>
        
        <!-- Accessibility Section -->
        <div class="settings-section">
          <h3>Accessibility</h3>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="auto-announce">Auto-announce detected bills</label>
              <span class="setting-description">Automatically announce bill value and currency when detected</span>
            </div>
            <div class="setting-control">
              <label class="switch" title="Toggle auto-announce">
                <input 
                  type="checkbox" 
                  id="auto-announce" 
                  bind:checked={tempSettings.autoAnnounce}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          
          {#if voiceSupported}
            <div class="setting-item voice-setting-item">
              <div class="voice-setting-header">
                <div>
                  <label for="speech-rate">Voice Speed</label>
                  <span class="setting-description">How fast the voice speaks (1.0 is normal speed)</span>
                </div>
                <div class="indicator-container">
                  <span class="range-value-indicator">{tempSettings.speechRate}x</span>
                </div>
              </div>
              <div class="slider-container">
                <input 
                  type="range" 
                  id="speech-rate" 
                  min="0.5" 
                  max="2" 
                  step="0.1" 
                  bind:value={tempSettings.speechRate}
                  class="enhanced-slider"
                >
                <div class="slider-ticks">
                  <span>0.5x</span>
                  <span>1x</span>
                  <span>1.5x</span>
                  <span>2x</span>
                </div>
              </div>
            </div>
            
            <div class="setting-item voice-setting-item">
              <div class="voice-setting-header">
                <div>
                  <label for="speech-volume">Voice Volume</label>
                  <span class="setting-description">How loud the voice speaks</span>
                </div>
                <div class="indicator-container">
                  <span class="range-value-indicator">{Math.round(tempSettings.speechVolume * 100)}%</span>
                </div>
              </div>
              <div class="slider-container">
                <input 
                  type="range" 
                  id="speech-volume" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  bind:value={tempSettings.speechVolume}
                  class="enhanced-slider"
                >
                <div class="slider-ticks">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>Test Voice Settings</span>
                <span class="setting-description">Hear how the current voice settings sound</span>
              </div>
              <div class="setting-control">
                <button class="test-voice-btn" on:click={testVoice}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  Test Voice
                </button>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Camera Section -->
        <div class="settings-section">
          <h3>Camera</h3>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="always-back-camera">Always use back camera</label>
              <span class="setting-description">Always try to use the back camera when available</span>
            </div>
            <div class="setting-control">
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="always-back-camera" 
                  bind:checked={tempSettings.alwaysUseBackCamera}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="invert-camera">Invert camera display</label>
              <span class="setting-description">Mirror the camera preview horizontally</span>
            </div>
            <div class="setting-control">
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="invert-camera" 
                  bind:checked={tempSettings.invertCamera}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={resetSettings}>Reset</button>
        <button class="btn-primary" on:click={saveSettings}>Save Changes</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(3px);
  }
  
  .modal {
    background-color: var(--color-card-bg, white);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px var(--color-shadow, rgba(0, 0, 0, 0.2));
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background-color: var(--color-card-bg, white);
    z-index: 2;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--color-text-primary, #1e293b);
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--color-text-secondary, #64748b);
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }
  
  .close-button:hover {
    background-color: var(--color-bg-accent, #f1f5f9);
    color: var(--color-text-primary, #334155);
  }
  
  .modal-content {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
    color: var(--color-text-primary, #1e293b);
    /* Hide scrollbar but maintain scrolling functionality */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  .modal-content::-webkit-scrollbar {
    display: none;
  }
  
  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    position: sticky;
    bottom: 0;
    background-color: var(--color-card-bg, white);
    z-index: 2;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }
  
  .settings-section {
    margin-bottom: 24px;
  }
  
  .settings-section h3 {
    font-size: 16px;
    color: var(--color-text-primary, #334155);
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border, #f1f5f9);
  }
  
  .setting-item:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  
  .setting-label {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin-right: 20px;
  }
  
  .setting-label label {
    font-weight: 500;
    color: var(--color-text-primary, #334155);
    margin-bottom: 4px;
  }
  
  .setting-description {
    font-size: 12px;
    color: var(--color-text-secondary, #64748b);
  }
  
  .setting-control {
    display: flex;
    align-items: center;
  }
  
  .range-control {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    max-width: 380px;
  }
  
  .slider-container {
    flex: 1;
    padding: 10px 0;
    position: relative;
  }
  
  .enhanced-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 10px;
    background: #e5e7eb;
    outline: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }
  
  .enhanced-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.15);
    border: 2px solid #ffffff;
    transition: all 0.2s ease;
    margin-top: -8px;
  }
  
  .enhanced-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.15);
    border: 2px solid #ffffff;
    transition: all 0.2s ease;
  }
  
  .enhanced-slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 10px;
    background: #e5e7eb;
  }
  
  .enhanced-slider::-moz-range-track {
    height: 8px;
    border-radius: 10px;
    background: #e5e7eb;
  }
  
  .enhanced-slider:hover::-webkit-slider-thumb {
    transform: scale(1.1);
    box-shadow: 0 0 4px rgba(59, 130, 246, 0.3), 0 3px 8px rgba(0, 0, 0, 0.2);
  }
  
  .enhanced-slider:hover::-moz-range-thumb {
    transform: scale(1.1);
    box-shadow: 0 0 4px rgba(59, 130, 246, 0.3), 0 3px 8px rgba(0, 0, 0, 0.2);
  }
  
  .enhanced-slider:active::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4), 0 4px 10px rgba(0, 0, 0, 0.25);
  }
  
  .enhanced-slider:active::-moz-range-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4), 0 4px 10px rgba(0, 0, 0, 0.25);
  }
  
  .range-value-indicator {
    font-size: 16px;
    font-weight: 600;
    color: #3b82f6;
    min-width: 48px;
    text-align: right;
    transition: all 0.2s ease;
  }
  
  /* Custom track fill effect */
  .enhanced-slider::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0%) * 100%), #e5e7eb 0);
    height: 8px;
    border-radius: 10px;
  }
  
  .enhanced-slider::-moz-range-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0%) * 100%), #e5e7eb 0);
    height: 8px;
    border-radius: 10px;
  }
  
  /* Dark mode adjustments */
  .dark-theme .enhanced-slider::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0%) * 100%), #374151 0);
  }
  
  .dark-theme .enhanced-slider::-moz-range-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0%) * 100%), #374151 0);
  }
  
  .dark-theme .range-value-indicator {
    color: #60a5fa;
  }
  
  /* Add some JS to make the track fill work correctly */
  :global(.enhanced-slider) {
    position: relative;
  }
  
  /* Toggle switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 30px;
    user-select: none;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-bg-accent, #cbd5e1);
    transition: .3s;
    border-radius: 30px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .3s cubic-bezier(.17,.67,.45,1.32);
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 2;
  }
  
  input:checked + .slider {
    background-color: var(--color-button-primary, #3b82f6);
  }
  
  input:focus + .slider {
    box-shadow: 0 0 2px var(--color-button-primary, #3b82f6);
  }
  
  input:checked + .slider:before {
    transform: translateX(30px);
  }
  
  /* Keep hover and press effect styles */
  .switch:hover .slider:before {
    box-shadow: 0 0 0 4px rgba(203, 213, 225, 0.3);
  }
  
  .switch:hover input:checked + .slider:before {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  
  /* Add press effect */
  .switch:active .slider:before {
    width: 28px;
  }
  
  .switch:active input:checked + .slider:before {
    left: -2px;
  }
  
  /* Buttons */
  .btn-primary, .btn-secondary, .test-voice-btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-primary {
    background-color: var(--color-button-primary, #3b82f6);
    color: white;
  }
  
  .btn-primary:hover {
    background-color: var(--color-button-primary-hover, #2563eb);
  }
  
  .btn-secondary {
    background-color: var(--color-button-secondary, #f1f5f9);
    color: var(--color-text-primary, #1e293b);
  }
  
  .btn-secondary:hover {
    background-color: var(--color-button-secondary-hover, #e2e8f0);
  }
  
  .test-voice-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--color-button-secondary, #f1f5f9);
    color: var(--color-text-primary, #1e293b);
    padding: 8px 12px;
  }
  
  .test-voice-btn:hover {
    background-color: var(--color-button-secondary-hover, #e2e8f0);
  }
  
  .setting-select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background-color: var(--color-bg-accent, #f1f5f9);
    color: var(--color-text-primary, #1e293b);
    font-size: 14px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
    min-width: 120px;
  }
  
  /* Style for range inputs */
  input[type="range"] {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 5px;
    background: var(--color-bg-accent, #cbd5e1);
    outline: none;
  }
  
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-button-primary, #3b82f6);
    cursor: pointer;
  }
  
  input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-button-primary, #3b82f6);
    cursor: pointer;
    border: none;
  }
  
  /* Make it responsive on smaller screens */
  @media (max-width: 500px) {
    .setting-item {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .setting-label {
      margin-right: 0;
      margin-bottom: 10px;
      width: 100%;
    }
    
    .setting-control {
      width: 100%;
      justify-content: flex-end;
    }
    
    .range-control {
      width: 100%;
    }
    
    .range-control input[type="range"] {
      flex: 1;
    }
  }
  
  /* Voice settings specific styles */
  .voice-setting-item {
    flex-direction: column;
    align-items: stretch;
    padding-bottom: 24px;
  }
  
  .voice-setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    width: 100%;
  }
  
  .voice-setting-header label {
    margin-bottom: 2px;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary, #334155);
  }
  
  .voice-setting-header .setting-description {
    font-size: 13px;
    color: var(--color-text-secondary, #64748b);
    margin-top: 2px;
  }
  
  .slider-container {
    padding: 8px 0;
    position: relative;
    width: 100%;
  }
  
  .indicator-container {
    background-color: #e0e8ff;
    border-radius: 6px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }
  
  .indicator-container:hover {
    background-color: #d0dcff;
  }
  
  .range-value-indicator {
    font-size: 16px;
    font-weight: 600;
    color: #3b82f6;
    min-width: 48px;
    text-align: center;
    transition: all 0.2s ease;
  }
  
  .slider-ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--color-text-secondary, #64748b);
  }
</style> 