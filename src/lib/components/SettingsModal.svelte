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
  export let hapticFeedback: boolean = true;
  export let showWelcome: boolean = true;
  
  // Create a copy of settings for editing
  let tempSettings = {
    autoAnnounce,
    preferredCurrency,
    speechRate,
    speechVolume,
    invertCamera,
    alwaysUseBackCamera,
    darkMode,
    hapticFeedback,
    showWelcome
  };
  
  // Track previous state of auto-announce to detect when it's turned on
  let previousAutoAnnounce = autoAnnounce;
  
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
    const initializeSliders = () => {
      if (typeof window !== 'undefined' && document.readyState === 'complete') {
        // Function to update range fill
        const updateRangeFill = (slider: HTMLInputElement) => {
          if (!slider) return;
          const value = (parseFloat(slider.value) - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min));
          slider.style.setProperty('--value', value.toString());
        };
        
        // Set up the initial values and attach event listeners
        setTimeout(() => {
          const sliders = document.querySelectorAll<HTMLInputElement>('.enhanced-slider');
          if (sliders.length > 0) {
            console.log('Initializing', sliders.length, 'enhanced sliders');
            sliders.forEach(slider => {
              updateRangeFill(slider);
              
              // Create a handler function for each slider
              const inputHandler = () => updateRangeFill(slider);
              
              // Store the handler function on the element for future reference
              // Remove old handler if it exists
              const oldHandler = (slider as any)._inputHandler;
              if (oldHandler) {
                slider.removeEventListener('input', oldHandler);
              }
              
              // Add the new handler and store reference
              slider.addEventListener('input', inputHandler);
              (slider as any)._inputHandler = inputHandler;
            });
          }
        }, 100);
      } else {
        // If document not ready, wait a bit longer
        setTimeout(initializeSliders, 50);
      }
    };
    
    // Start the initialization process
    initializeSliders();
    
    // Also reinitialize when the modal is shown
    if (typeof window !== 'undefined') {
      const observer = new MutationObserver((mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'style' && 
              document.querySelector('.modal-backdrop')) {
            initializeSliders();
            break;
          }
        }
      });
      
      // Start observing the body for modal changes
      setTimeout(() => {
        if (document.body) {
          observer.observe(document.body, { 
            attributes: true,
            childList: true,
            subtree: true
          });
        }
      }, 500);
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
        hapticFeedback = parsedSettings.hapticFeedback ?? hapticFeedback;
        showWelcome = parsedSettings.showWelcome ?? showWelcome;
        
        // Update temp settings
        resetSettings();
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }
  
  // Update parent component with new settings
  function saveSettings() {
    console.log('Saving settings:', tempSettings);
    
    // Update parent variables
    autoAnnounce = tempSettings.autoAnnounce;
    preferredCurrency = tempSettings.preferredCurrency;
    speechRate = tempSettings.speechRate;
    speechVolume = tempSettings.speechVolume;
    invertCamera = tempSettings.invertCamera;
    alwaysUseBackCamera = tempSettings.alwaysUseBackCamera;
    darkMode = tempSettings.darkMode;
    hapticFeedback = tempSettings.hapticFeedback;
    showWelcome = tempSettings.showWelcome;
    
    // Apply dark mode immediately when saved
    applyTheme(darkMode);
    
    // Save to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('moneyScanner.settings', JSON.stringify(tempSettings));
        console.log('Settings saved to localStorage');
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
      darkMode,
      hapticFeedback,
      showWelcome
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
  
  // Auto-play short sample when auto-announce is turned on
  function playAutoAnnounceSample() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      console.log('Playing auto-announce sample with rate:', tempSettings.speechRate, 'volume:', tempSettings.speechVolume);
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance("Auto-announce enabled.");
      utterance.rate = tempSettings.speechRate;
      utterance.volume = tempSettings.speechVolume;
      
      window.speechSynthesis.speak(utterance);
    }
  }
  
  // Reset settings when modal is opened
  $: if (show) {
    resetSettings();
    previousAutoAnnounce = tempSettings.autoAnnounce;
  }
  
  // Watch for changes to auto-announce and play sample when turned on
  $: {
    if (voiceSupported && tempSettings.autoAnnounce && !previousAutoAnnounce) {
      // Auto-announce was just turned ON, play a sample
      playAutoAnnounceSample();
    }
    // Update the previous value after handling the change
    previousAutoAnnounce = tempSettings.autoAnnounce;
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
                  checked={tempSettings.darkMode}
                  on:click={() => {
                    tempSettings.darkMode = !tempSettings.darkMode;
                    applyTheme(tempSettings.darkMode);
                    console.log("Dark mode toggled to:", tempSettings.darkMode);
                  }}
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
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="auto-announce" 
                  checked={tempSettings.autoAnnounce}
                  on:click={() => {
                    tempSettings.autoAnnounce = !tempSettings.autoAnnounce;
                    // When turned on, play a sample
                    if (tempSettings.autoAnnounce && voiceSupported) {
                      setTimeout(() => playAutoAnnounceSample(), 100);
                    }
                    console.log("Auto-announce toggled to:", tempSettings.autoAnnounce);
                  }}
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
              </div>
              <div class="slider-wrapper">
                <input 
                  type="range" 
                  id="speech-rate" 
                  min="0.5" 
                  max="2" 
                  step="0.1" 
                  bind:value={tempSettings.speechRate}
                  class="enhanced-slider"
                >
                <span class="range-value-indicator">{tempSettings.speechRate}x</span>
              </div>
            </div>
            
            <div class="setting-item voice-setting-item">
              <div class="voice-setting-header">
                <div>
                  <label for="speech-volume">Voice Volume</label>
                  <span class="setting-description">How loud the voice speaks</span>
                </div>
              </div>
              <div class="slider-wrapper">
                <input 
                  type="range" 
                  id="speech-volume" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  bind:value={tempSettings.speechVolume}
                  class="enhanced-slider"
                >
                <span class="range-value-indicator">{Math.round(tempSettings.speechVolume * 100)}%</span>
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
                  checked={tempSettings.alwaysUseBackCamera}
                  on:click={() => {
                    tempSettings.alwaysUseBackCamera = !tempSettings.alwaysUseBackCamera;
                    console.log("Always use back camera toggled to:", tempSettings.alwaysUseBackCamera);
                  }}
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
                  checked={tempSettings.invertCamera}
                  on:click={() => {
                    tempSettings.invertCamera = !tempSettings.invertCamera;
                    console.log("Invert camera toggled to:", tempSettings.invertCamera);
                  }}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Other Settings Section -->
        <div class="settings-section">
          <h3>Other Settings</h3>
          
          <div class="setting-item">
            <div class="setting-label">
              <label for="haptic-feedback">Haptic feedback</label>
              <span class="setting-description">Vibrate when scanning completes</span>
            </div>
            <div class="setting-control">
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="haptic-feedback" 
                  checked={tempSettings.hapticFeedback}
                  on:click={() => {
                    tempSettings.hapticFeedback = !tempSettings.hapticFeedback;
                    console.log("Haptic feedback toggled to:", tempSettings.hapticFeedback);
                  }}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <label for="show-welcome">Show welcome dialog</label>
              <span class="setting-description">Display welcome dialog on startup</span>
            </div>
            <div class="setting-control">
              <label class="switch">
                <input 
                  type="checkbox" 
                  id="show-welcome" 
                  checked={tempSettings.showWelcome}
                  on:click={() => {
                    tempSettings.showWelcome = !tempSettings.showWelcome;
                    console.log("Show welcome toggled to:", tempSettings.showWelcome);
                  }}
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
  
  /* Voice settings specific styles */
  .voice-setting-item {
    flex-direction: column;
    align-items: stretch;
    padding-bottom: 28px;
  }
  
  .voice-setting-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    width: 100%;
  }
  
  .voice-setting-header label {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary, #334155);
    margin-bottom: 4px;
    display: block;
  }
  
  .voice-setting-header .setting-description {
    font-size: 14px;
    color: var(--color-text-secondary, #64748b);
    margin-top: 0;
  }
  
  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  
  .range-value-indicator {
    font-size: 16px;
    font-weight: 600;
    color: #3b82f6;
    min-width: 40px;
    text-align: right;
  }
  
  /* Enhanced slider - exactly matching image */
  .enhanced-slider {
    -webkit-appearance: none !important;
    appearance: none !important;
    width: 100% !important;
    height: 4px !important;
    border-radius: 2px !important;
    background: #e5e7eb !important;
    outline: none !important;
    padding: 0 !important;
    margin: 0 !important;
    cursor: pointer !important;
    position: relative !important;
  }
  
  .enhanced-slider::-webkit-slider-thumb {
    -webkit-appearance: none !important;
    appearance: none !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background: #3b82f6 !important;
    cursor: pointer !important;
    margin-top: -6px !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
    transition: none !important;
  }
  
  .enhanced-slider::-moz-range-thumb {
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background: #3b82f6 !important;
    cursor: pointer !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
    transition: none !important;
  }
  
  .enhanced-slider::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0.5) * 100%), #e5e7eb 0) !important;
    height: 4px !important;
    border-radius: 2px !important;
  }
  
  .enhanced-slider::-moz-range-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0.5) * 100%), #e5e7eb 0) !important;
    height: 4px !important;
    border-radius: 2px !important;
  }
  
  .dark-theme .enhanced-slider {
    background: #374151 !important;
  }
  
  .dark-theme .enhanced-slider::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0.5) * 100%), #374151 0) !important;
  }
  
  .dark-theme .enhanced-slider::-moz-range-track {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 calc(var(--value, 0.5) * 100%), #374151 0) !important;
  }
  
  .slider-wrapper {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    width: 100% !important;
    background: transparent !important;
  }
  
  .range-value-indicator {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #3b82f6 !important;
    min-width: 40px !important;
    text-align: right !important;
  }
  
  .dark-theme .range-value-indicator {
    color: #60a5fa !important;
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
  
  /* Round sliders */
  .slider.round {
    border-radius: 30px;
  }
  
  .slider.round:before {
    border-radius: 50%;
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
  
  /* Dark theme styles for toggle switches */
  .dark-theme input:checked + .slider {
    background-color: var(--color-button-primary, #60a5fa);
  }
  
  .dark-theme .slider {
    background-color: var(--color-bg-accent, #374151);
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
  
  /* Auto-announce button */
  .auto-announce-btn {
    padding: 8px 16px;
    min-width: 60px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--color-border, #e2e8f0);
    background-color: var(--color-bg-accent, #f1f5f9);
    color: var(--color-text-primary, #1e293b);
  }
  
  .auto-announce-btn.enabled {
    background-color: var(--color-button-primary, #3b82f6);
    color: white;
    border-color: var(--color-button-primary, #3b82f6);
  }
  
  .auto-announce-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .auto-announce-btn:active {
    transform: translateY(0);
  }
  
  /* Remove the old toggle button styles */
  .toggle-btn {
    display: none;
  }
</style> 