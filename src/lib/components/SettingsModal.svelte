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
  
  // Create a copy of settings for editing
  let tempSettings = {
    autoAnnounce,
    preferredCurrency,
    speechRate,
    speechVolume,
    invertCamera,
    alwaysUseBackCamera
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
      alwaysUseBackCamera
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
                  bind:checked={tempSettings.autoAnnounce}
                >
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          
          {#if voiceSupported}
            <div class="setting-item">
              <div class="setting-label">
                <label for="speech-rate">Voice Speed</label>
                <span class="setting-description">How fast the voice speaks (1.0 is normal speed)</span>
              </div>
              <div class="setting-control range-control">
                <input 
                  type="range" 
                  id="speech-rate" 
                  min="0.5" 
                  max="2" 
                  step="0.1" 
                  bind:value={tempSettings.speechRate}
                >
                <span class="range-value">{tempSettings.speechRate}x</span>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <label for="speech-volume">Voice Volume</label>
                <span class="setting-description">How loud the voice speaks</span>
              </div>
              <div class="setting-control range-control">
                <input 
                  type="range" 
                  id="speech-volume" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  bind:value={tempSettings.speechVolume}
                >
                <span class="range-value">{Math.round(tempSettings.speechVolume * 100)}%</span>
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
    background-color: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background-color: white;
    z-index: 2;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    color: #1e293b;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    color: #64748b;
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
    background-color: #f1f5f9;
    color: #334155;
  }
  
  .modal-content {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
  }
  
  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    position: sticky;
    bottom: 0;
    background-color: white;
    z-index: 2;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }
  
  .settings-section {
    margin-bottom: 24px;
  }
  
  .settings-section h3 {
    font-size: 16px;
    color: #334155;
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f1f5f9;
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
    color: #334155;
    margin-bottom: 4px;
  }
  
  .setting-description {
    font-size: 12px;
    color: #64748b;
  }
  
  .setting-control {
    display: flex;
    align-items: center;
  }
  
  .range-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .range-value {
    font-size: 14px;
    color: #334155;
    min-width: 45px;
    text-align: right;
  }
  
  /* Toggle switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
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
    background-color: #cbd5e1;
    transition: .4s;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
  }
  
  input:checked + .slider {
    background-color: #3b82f6;
  }
  
  input:focus + .slider {
    box-shadow: 0 0 1px #3b82f6;
  }
  
  input:checked + .slider:before {
    transform: translateX(26px);
  }
  
  .slider.round {
    border-radius: 24px;
  }
  
  .slider.round:before {
    border-radius: 50%;
  }
  
  /* Buttons */
  .btn-primary, .btn-secondary {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }
  
  .btn-primary:hover {
    background-color: #2563eb;
  }
  
  .btn-secondary {
    background-color: #e2e8f0;
    color: #334155;
  }
  
  .btn-secondary:hover {
    background-color: #cbd5e1;
    color: #1e293b;
  }
  
  /* Select input styles */
  .setting-select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background-color: white;
    font-size: 14px;
    color: #334155;
    min-width: 180px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 16px;
    padding-right: 30px;
  }
  
  .setting-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
  }
  
  .test-voice-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #e2e8f0;
    color: #334155;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .test-voice-btn:hover {
    background-color: #cbd5e1;
    color: #1e293b;
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
</style> 