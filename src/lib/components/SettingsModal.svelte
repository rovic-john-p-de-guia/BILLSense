<script lang="ts">
  import { slide } from 'svelte/transition';
  import { onMount, createEventDispatcher } from 'svelte';
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
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
  
  // Track original settings to detect changes
  let originalSettings = { ...tempSettings };
  
  // Show save success indicator
  let showSaveSuccess = false;
  
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
  
  // Debounce function for performance optimization
  function debounce(func: Function, wait: number): (...args: any[]) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    };
  }
  
  // Function to update range slider fill with improved animation
  function updateRangeFill(slider: HTMLInputElement) {
        if (!slider) return;
    
        const value = (parseFloat(slider.value) - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min));
    
    // Add animation class temporarily
    slider.classList.add('value-changing');
    
    // Set the new value with animation - ensure it's formatted as a percentage
    slider.style.setProperty('--value', value * 100 + '%');
    
    // Force update the sliders parent node to trigger a repaint
    if (slider.parentNode) {
      (slider.parentNode as HTMLElement).style.opacity = '0.99';
      setTimeout(() => {
        if (slider.parentNode) {
          (slider.parentNode as HTMLElement).style.opacity = '1';
        }
      }, 10);
    }
    
    // Remove the animation class after animation completes
    setTimeout(() => {
      slider.classList.remove('value-changing');
    }, 300);
  }
  
  // Function to update all sliders with better animation support
  function updateAllSliders() {
    if (typeof document === 'undefined') return;
    
    // Use a small timeout to ensure DOM elements are rendered
    setTimeout(() => {
      // Get all sliders
        const sliders = document.querySelectorAll<HTMLInputElement>('.enhanced-slider');
      
      if (!sliders || sliders.length === 0) {
        console.warn('No sliders found in updateAllSliders');
        return;
      }
      
      console.log(`Found ${sliders.length} sliders to update`);
      
        sliders.forEach(slider => {
        // First remove any existing input listeners to prevent duplicates
        slider.removeEventListener('input', handleSliderInput);
        
        // Calculate normalized value (0-1)
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const value = parseFloat(slider.value);
        const normalizedValue = (value - min) / (max - min);
        
        console.log(`Updating slider ${slider.id}: value=${value}, normalized=${normalizedValue}`);
        
        // Set the CSS variable directly with proper percentage format
        slider.style.setProperty('--value', `${normalizedValue * 100}%`);
        
        // Update corresponding indicator
        if (slider.id === 'speech-rate') {
          const rateIndicator = document.getElementById('rate-indicator');
          if (rateIndicator) {
            rateIndicator.textContent = `${value.toFixed(1)}x`;
          }
        } else if (slider.id === 'speech-volume') {
          const volumeIndicator = document.getElementById('volume-indicator');
          if (volumeIndicator) {
            volumeIndicator.textContent = `${Math.round(value * 100)}%`;
          }
        }
        
        // Setup input event listeners
        slider.addEventListener('input', handleSliderInput);
      });
    }, 50); // Increased timeout for reliability
  }
  
  // Separate event handler function to reduce duplicate code
  function handleSliderInput(event: Event) {
    const slider = event.target as HTMLInputElement;
    
    // Calculate normalized value
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const value = parseFloat(slider.value);
    const normalizedValue = (value - min) / (max - min);
    
    console.log(`Slider input: ${slider.id}, value=${value}, normalized=${normalizedValue}`);
    
    // Add animation class
    slider.classList.add('value-changing');
    
    // Update CSS variable - ensure proper percentage format
    slider.style.setProperty('--value', `${normalizedValue * 100}%`);
    
    // Since we're now using bind:value, tempSettings is already updated
    // Log the current settings for debugging
    console.log('Current tempSettings:', JSON.stringify(tempSettings));
    
    // Update the indicator visually
    if (slider.id === 'speech-rate') {
      const rateIndicator = document.getElementById('rate-indicator');
      if (rateIndicator) {
        rateIndicator.textContent = `${value.toFixed(1)}x`;
        rateIndicator.classList.add('updating');
        setTimeout(() => rateIndicator.classList.remove('updating'), 300);
      }
    } else if (slider.id === 'speech-volume') {
      const volumeIndicator = document.getElementById('volume-indicator');
      if (volumeIndicator) {
        volumeIndicator.textContent = `${Math.round(value * 100)}%`;
        volumeIndicator.classList.add('updating');
        setTimeout(() => volumeIndicator.classList.remove('updating'), 300);
      }
    }
    
    // Force a repaint to ensure the visual update happens
    const parent = slider.parentElement;
    if (parent) {
      parent.style.opacity = '0.99';
      setTimeout(() => {
        parent.style.opacity = '1';
      }, 10);
    }
    
    // Remove animation class after delay
    setTimeout(() => {
      slider.classList.remove('value-changing');
    }, 300);
  }
  
  // Helper to detect if settings have changed
  function haveSettingsChanged(): boolean {
    return JSON.stringify(tempSettings) !== JSON.stringify(originalSettings);
  }
  
  // Check for voice support on mount and initialize
  onMount(() => {
    if (typeof window !== 'undefined') {
      console.log('SettingsModal mounted');
      voiceSupported = 'speechSynthesis' in window;
      
      // Load settings from localStorage if available
      loadSavedSettings();
      
      // Initialize event listeners
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && show) {
          // When tab becomes visible again, refresh slider visuals
          setTimeout(updateAllSliders, 50);
        }
      });
      
      // Set up a MutationObserver to ensure sliders and toggles are initialized
      // whenever the modal becomes visible
      try {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'style' &&
                document.querySelector('.modal-backdrop')) {
              console.log('Modal became visible via style change');
              initializeToggles();
              updateAllSliders();
            }
          });
        });
        
        // Start observing the body for style changes (modal appearing)
        observer.observe(document.body, { 
          attributes: true,
          childList: true,
          subtree: true
        });
      } catch (error) {
        console.error('Error setting up MutationObserver:', error);
      }
    }
    
    // Set original settings on component mount
    originalSettings = { ...tempSettings };
    
    return () => {
      // Cleanup: hide the modal on component unmount
      show = false;
    };
  });
  
  // Update sliders when modal is shown or temp settings change
  $: if (show || tempSettings) {
    setTimeout(updateAllSliders, 50);
  }
  
  // Watch for changes in specific settings
  $: if (tempSettings.speechRate) {
    if (typeof document !== 'undefined' && show) {
      const rateSlider = document.getElementById('speech-rate') as HTMLInputElement;
      if (rateSlider) updateRangeFill(rateSlider);
    }
  }
  
  $: if (tempSettings.speechVolume) {
    if (typeof document !== 'undefined' && show) {
      const volumeSlider = document.getElementById('speech-volume') as HTMLInputElement;
      if (volumeSlider) updateRangeFill(volumeSlider);
    }
  }
  
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
        
        // Apply theme based on loaded settings
        applyTheme(darkMode);
        
        // Update original settings to match loaded settings
        originalSettings = { ...tempSettings };
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }
  
  // Update parent component with new settings
  function saveSettings() {
    console.log('Saving settings', tempSettings);
    
    // Update parent variables - need to explicitly set them
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
        const settingsJson = JSON.stringify(tempSettings);
        console.log('Saving to localStorage:', settingsJson);
        localStorage.setItem('moneyScanner.settings', settingsJson);
        
        // Update original settings to match the new saved settings
        originalSettings = { ...tempSettings };
        
        // Force a DOM update of all toggles to ensure they're in the correct state
        setTimeout(() => {
          // Reinitialize all toggles to ensure DOM state matches tempSettings
          initializeToggles();
          // Update all sliders
          updateAllSliders();
        }, 50);
        
        // Dispatch event that settings were updated
        dispatch('settingsUpdated', {
          autoAnnounce,
          preferredCurrency,
          speechRate,
          speechVolume,
          invertCamera,
          alwaysUseBackCamera,
          darkMode
        });
        
        // Show success indicator
        showSaveSuccess = true;
        setTimeout(() => {
          showSaveSuccess = false;
          // Close modal after showing success
          closeModal();
        }, 1000);
        
        console.log('Settings saved successfully:', tempSettings);
      } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
        // Don't close modal if save fails
      }
    } else {
      console.warn('localStorage not available, cannot save settings');
      // Close modal even if localStorage not available
    closeModal();
    }
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
    console.log('Closing modal, original settings:', originalSettings, 'darkMode:', darkMode);
    show = false;
    
    // Only dispatch events if dark mode was explicitly changed through the UI
    // and the change was saved directly (not through the Save button)
    if (originalSettings.darkMode !== darkMode && tempSettings.darkMode === darkMode) {
      console.log('Dark mode changed directly, dispatching event');
      dispatch('settingsUpdated', {
        autoAnnounce,
        preferredCurrency,
        speechRate,
        speechVolume,
        invertCamera,
        alwaysUseBackCamera,
        darkMode
      });
    }
  }
  
  // Reset to current settings with enhanced animations
  function resetSettings() {
    // Reset temp settings to match parent component values
    tempSettings = {
      autoAnnounce,
      preferredCurrency,
      speechRate,
      speechVolume,
      invertCamera,
      alwaysUseBackCamera,
      darkMode
    };
    
    // If dark mode was modified in the temp settings, reapply the original theme
    if (tempSettings.darkMode !== originalSettings.darkMode) {
      applyTheme(tempSettings.darkMode);
    }
    
    // Update sliders visual state after settings reset
    setTimeout(() => {
      // Update all sliders with animation
      updateAllSliders();
      
      // Show reset animation on all settings sections
      const sections = document.querySelectorAll('.settings-section');
      sections.forEach((section, index) => {
        setTimeout(() => {
          section.classList.add('section-updated');
          setTimeout(() => {
            section.classList.remove('section-updated');
          }, 300);
        }, index * 50); // Stagger the animations
      });
      
      // Add flash to all toggles and sliders
      document.querySelectorAll('.switch, .enhanced-slider').forEach(element => {
        element.classList.add('reset-flash');
        setTimeout(() => {
          element.classList.remove('reset-flash');
        }, 500);
      });
      
      // Update toggle ripples
      setupToggleRipples();
    }, 50);
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
  
  // Ensure sliders are properly initialized when modal is opened
  $: if (show) {
    console.log('Modal shown, initializing settings');
    
    // Hide save success indicator when modal opens
    showSaveSuccess = false;
    
    // Wait for DOM to render before initializing
    setTimeout(() => {
      // Only initialize tempSettings once when modal is first opened
      if (JSON.stringify(tempSettings) === '{}' || !tempSettings) {
        console.log('Setting initial tempSettings from parent props');
        tempSettings = {
          autoAnnounce,
          preferredCurrency,
          speechRate,
          speechVolume,
          invertCamera,
          alwaysUseBackCamera,
          darkMode
        };
        
        // Set original settings to detect changes
        originalSettings = { ...tempSettings };
      } else {
        console.log('Keeping existing tempSettings:', tempSettings);
      }
      
      // Initialize all toggles with direct DOM manipulation for better reliability
      initializeToggles();
      
      // Use multiple timing attempts to ensure initialization works
      updateAllSliders();
      setTimeout(updateAllSliders, 100);
      setTimeout(updateAllSliders, 300);
    }, 50);
  }
  
  // New function to directly initialize toggles without relying on reactive binding
  function initializeToggles() {
    // Give DOM time to render
    setTimeout(() => {
      try {
        console.log('Initializing toggles with values:', JSON.stringify(tempSettings));
        
        // Set toggle switches directly through DOM
        const darkModeToggle = document.getElementById('dark-mode') as HTMLInputElement;
        if (darkModeToggle) {
          console.log(`Setting dark mode toggle to: ${tempSettings.darkMode}`);
          darkModeToggle.checked = tempSettings.darkMode;
          updateToggleVisuals(darkModeToggle);
        } else {
          console.error('Dark mode toggle not found in DOM');
        }
        
        const autoAnnounceToggle = document.getElementById('auto-announce') as HTMLInputElement;
        if (autoAnnounceToggle) {
          console.log(`Setting auto announce toggle to: ${tempSettings.autoAnnounce}`);
          autoAnnounceToggle.checked = tempSettings.autoAnnounce;
          updateToggleVisuals(autoAnnounceToggle);
        } else {
          console.error('Auto announce toggle not found in DOM');
        }
        
        const invertCameraToggle = document.getElementById('invert-camera') as HTMLInputElement;
        if (invertCameraToggle) {
          console.log(`Setting invert camera toggle to: ${tempSettings.invertCamera}`);
          invertCameraToggle.checked = tempSettings.invertCamera;
          updateToggleVisuals(invertCameraToggle);
        } else {
          console.error('Invert camera toggle not found in DOM');
        }
        
        const alwaysBackCameraToggle = document.getElementById('always-back-camera') as HTMLInputElement;
        if (alwaysBackCameraToggle) {
          console.log(`Setting back camera toggle to: ${tempSettings.alwaysUseBackCamera}`);
          alwaysBackCameraToggle.checked = tempSettings.alwaysUseBackCamera;
          updateToggleVisuals(alwaysBackCameraToggle);
        } else {
          console.error('Always back camera toggle not found in DOM');
        }
        
        // Setup ripple effects and event listeners
        setupToggleRipples();
      } catch (error) {
        console.error('Error initializing toggles:', error);
      }
    }, 100);
  }
  
  // Helper to update toggle visual state
  function updateToggleVisuals(toggleEl: HTMLInputElement) {
    const slider = toggleEl.nextElementSibling as HTMLElement;
    if (slider) {
      slider.style.backgroundColor = toggleEl.checked ? '#3b82f6' : '#cbd5e1';
    }
  }
  
  // Modified toggle event handlers - replace bind:checked with these
  function handleDarkModeToggle(e: Event) {
    const toggle = e.target as HTMLInputElement;
    console.log('Dark mode toggle changed to:', toggle.checked);
    tempSettings.darkMode = toggle.checked;
    addToggleRipple(e);
    
    // Apply theme immediately for visual feedback
    applyTheme(tempSettings.darkMode);
    updateToggleVisuals(toggle);
    console.log('tempSettings after dark mode toggle:', tempSettings);
  }
  
  function handleAutoAnnounceToggle(e: Event) {
    const toggle = e.target as HTMLInputElement;
    console.log('Auto announce toggle changed to:', toggle.checked);
    tempSettings.autoAnnounce = toggle.checked;
    addToggleRipple(e);
    updateToggleVisuals(toggle);
    console.log('tempSettings after auto announce toggle:', tempSettings);
  }
  
  function handleInvertCameraToggle(e: Event) {
    const toggle = e.target as HTMLInputElement;
    console.log('Invert camera toggle changed to:', toggle.checked);
    tempSettings.invertCamera = toggle.checked;
    addToggleRipple(e);
    updateToggleVisuals(toggle);
    console.log('tempSettings after invert camera toggle:', tempSettings);
  }
  
  function handleBackCameraToggle(e: Event) {
    const toggle = e.target as HTMLInputElement;
    console.log('Back camera toggle changed to:', toggle.checked);
    tempSettings.alwaysUseBackCamera = toggle.checked;
    addToggleRipple(e);
    updateToggleVisuals(toggle);
    console.log('tempSettings after back camera toggle:', tempSettings);
  }
  
  // Function to add ripple effect to toggle switches with improved reliability
  function addToggleRipple(event: Event) {
    if (typeof document === 'undefined') return;
    
    const toggleEl = event.target as HTMLInputElement;
    const slider = toggleEl.nextElementSibling as HTMLElement;
    
    if (!slider) return;
    
    // Remove any existing ripples first
    const existingRipples = slider.querySelectorAll('.toggle-ripple');
    existingRipples.forEach(ripple => ripple.remove());
    
    // Create ripple element
    const ripple = document.createElement('span');
    ripple.className = 'toggle-ripple';
    
    // Position ripple at proper location based on checked state
    ripple.style.left = toggleEl.checked ? '75%' : '25%';
    
    // Make it visible immediately
    slider.appendChild(ripple);
    
    // Force a browser reflow to ensure animation triggers
    void ripple.offsetWidth;
    
    // Remove after animation completes
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
  
  // Setup toggle effect directly and immediately
  function setupToggleRipples() {
    if (typeof document === 'undefined') return;
    
    // Force direct event handler attachment to all toggles
    setTimeout(() => {
      const toggles = document.querySelectorAll('.switch input[type="checkbox"]');
      toggles.forEach(toggle => {
        // Remove existing listeners to prevent duplicates
        toggle.removeEventListener('change', addToggleRipple);
        
        // Add new listener
        toggle.addEventListener('change', addToggleRipple);
        
        // Force trigger ripple effect on first render for any checked toggles
        if ((toggle as HTMLInputElement).checked) {
          const slider = toggle.nextElementSibling as HTMLElement;
          if (slider) {
            // Create initial ripple for checked toggles
            const initialRipple = document.createElement('span');
            initialRipple.className = 'toggle-ripple initial-state';
            initialRipple.style.left = '75%';
            slider.appendChild(initialRipple);
            
            // Remove after animation
            setTimeout(() => {
              initialRipple.remove();
            }, 600);
          }
        }
      });
    }, 10);
  }
  
  // Update toggles after show is true
  $: if (show) {
    // Initialize settings
    setTimeout(() => {
      updateAllSliders();
      setupToggleRipples();
      
      // Force immediate display of slider values and fill bars
      const rateSlider = document.getElementById('speech-rate') as HTMLInputElement;
      const volumeSlider = document.getElementById('speech-volume') as HTMLInputElement;
      
      if (rateSlider) {
        rateSlider.style.setProperty('--value', ((parseFloat(rateSlider.value) - parseFloat(rateSlider.min)) / (parseFloat(rateSlider.max) - parseFloat(rateSlider.min))) * 100 + '%');
        const rateIndicator = document.getElementById('rate-indicator');
        if (rateIndicator) {
          rateIndicator.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
        }
      }
      
      if (volumeSlider) {
        volumeSlider.style.setProperty('--value', ((parseFloat(volumeSlider.value) - parseFloat(volumeSlider.min)) / (parseFloat(volumeSlider.max) - parseFloat(volumeSlider.min))) * 100 + '%');
        const volumeIndicator = document.getElementById('volume-indicator');
        if (volumeIndicator) {
          volumeIndicator.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
        }
      }
    }, 50);
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeModal} transition:slide={{ duration: 200 }}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-button" on:click={closeModal} aria-label="Close settings">×</button>
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
                  on:change={handleDarkModeToggle}
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
                  on:change={handleAutoAnnounceToggle}
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
                  <span class="range-value-indicator" id="rate-indicator">{tempSettings.speechRate.toFixed(1)}x</span>
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
                  style="--value: {((tempSettings.speechRate - 0.5) / 1.5) * 100}%"
                  on:input={handleSliderInput}
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
                  <span class="range-value-indicator" id="volume-indicator">{Math.round(tempSettings.speechVolume * 100)}%</span>
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
                  style="--value: {tempSettings.speechVolume * 100}%"
                  on:input={handleSliderInput}
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
                  on:change={handleBackCameraToggle}
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
                  on:change={handleInvertCameraToggle}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="btn-secondary" 
          on:click={resetSettings}
          disabled={!haveSettingsChanged()}
          title={haveSettingsChanged() ? "Reset to current settings" : "No changes to reset"}
        >Reset</button>
        
        <button 
          class="btn-primary {showSaveSuccess ? 'save-success' : ''}" 
          on:click={saveSettings}
          disabled={!haveSettingsChanged()}
          title={haveSettingsChanged() ? "Save your changes" : "No changes to save"}
        >
          {#if showSaveSuccess}
            <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Saved!
          {:else}
            Save Changes
          {/if}
        </button>
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
    appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 10px;
    outline: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    position: relative;
    will-change: background;
    /* Important: Fixed gradient background with CSS variable */
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 var(--value, 0%), #e5e7eb var(--value, 0%), #e5e7eb 100%);
    transition: background-color 0.3s ease;
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
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease;
    margin-top: -8px;
    will-change: transform, box-shadow;
    z-index: 2;
  }
  
  .enhanced-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.15);
    border: 2px solid #ffffff;
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease;
    will-change: transform, box-shadow;
    z-index: 2;
  }
  
  /* Fixed dark theme for enhanced slider */
  .dark-theme .enhanced-slider {
    background: linear-gradient(to right, #3b82f6 0%, #3b82f6 var(--value, 0%), #374151 var(--value, 0%), #374151 100%);
  }
  
  /* Fixed toggle styling for better visibility and response */
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #cbd5e1;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 30px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: visible;
  }
  
  input:checked + .slider {
    background-color: #3b82f6;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 3;
    will-change: transform, box-shadow;
  }
  
  input:checked + .slider:before {
    transform: translateX(30px);
    background-color: white;
    box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.1);
  }
  
  /* Improved range value indicator */
  .range-value-indicator {
    font-size: 16px;
    font-weight: 600;
    color: #3b82f6;
    min-width: 48px;
    text-align: center;
    transition: all 0.2s ease;
  }
  
  .range-value-indicator.updating {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    color: #2563eb;
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
  }
  
  @keyframes pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  
  /* Fixed indicator container styling */
  .indicator-container {
    background-color: #e0e8ff;
    border-radius: 6px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    min-width: 60px;
  }
  
  .indicator-container:hover {
    background-color: #d0dcff;
  }
  
  .slider-ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--color-text-secondary, #64748b);
  }
  
  /* Reset animation flash */
  .reset-flash {
    animation: flash-glow 0.6s cubic-bezier(0.215, 0.61, 0.355, 1);
    position: relative;
    z-index: 1;
  }
  
  @keyframes flash-glow {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  
  /* Save button success animation */
  .btn-primary.save-success {
    background-color: var(--color-success, #22c55e);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background-color 0.3s ease;
  }
  
  .check-icon {
    animation: check-appear 0.4s cubic-bezier(0.2, 0.8, 0.2, 1.4);
    will-change: transform, opacity;
  }
  
  @keyframes check-appear {
    0% {
      transform: scale(0) rotate(-45deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.3) rotate(0deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  
  /* Settings section update animation */
  .section-updated {
    animation: section-highlight 0.5s ease;
  }
  
  @keyframes section-highlight {
    0% { background-color: rgba(59, 130, 246, 0); }
    30% { background-color: rgba(59, 130, 246, 0.08); }
    100% { background-color: rgba(59, 130, 246, 0); }
  }
  
  /* Indicator pulse animation */
  .range-value-indicator {
    animation: pulse-subtle 2s infinite alternate;
  }
  
  @keyframes pulse-subtle {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(1.05);
    }
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
    position: relative;
    overflow: hidden;
  }
  
  .btn-primary:hover {
    background-color: var(--color-button-primary-hover, #2563eb);
  }
  
  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
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