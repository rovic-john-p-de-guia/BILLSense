<script lang="ts">
  import { announceBill } from '../utils/speechUtils';
  
  export let amount: string | number = '';
  export let currency: string = '';
  export let extraInfo: string = '';
  export let autoAnnounce: boolean = false;
  export let iconOnly: boolean = false;
  export let speechRate: number = 1;
  export let speechVolume: number = 1;
  
  let speaking = false;
  let supported = true;
  
  // Check if speech synthesis is supported
  $: {
    if (typeof window !== 'undefined') {
      supported = 'speechSynthesis' in window;
    }
  }
  
  // Announce bill when autoAnnounce is true and we have valid data
  $: if (autoAnnounce && amount && currency && !speaking && supported) {
    handleSpeak();
  }
  
  // Watch for changes in speech settings
  $: if (speaking && window?.speechSynthesis) {
    // If speech rate or volume changes during speaking, cancel and restart
    window.speechSynthesis.cancel();
    announceBill(amount, currency, extraInfo, speechRate, speechVolume)
      .catch(error => console.error('Speech error during settings update:', error));
  }
  
  async function handleSpeak() {
    if (speaking || !supported) return;
    
    try {
      speaking = true;
      await announceBill(amount, currency, extraInfo, speechRate, speechVolume);
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      speaking = false;
    }
  }
</script>

{#if supported}
  <button 
    class="tts-button {speaking ? 'speaking' : ''} {iconOnly ? 'icon-only' : ''}" 
    on:click={handleSpeak}
    disabled={speaking}
    aria-label="Speak bill information"
    title="Speak bill information"
  >
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {#if speaking}
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        {:else}
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        {/if}
      </svg>
      
      {#if speaking}
        <div class="wave">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      {/if}
    </div>
    
    {#if !iconOnly}
      <span class="text">{speaking ? 'Speaking...' : 'Speak'}</span>
    {/if}
  </button>
{/if}

<style>
  .tts-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.1s ease;
    border: none;
    background-color: var(--color-button-primary, #3b82f6);
    color: white;
  }
  
  .tts-button.icon-only {
    padding: 8px;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    justify-content: center;
  }
  
  .tts-button:hover {
    background-color: var(--color-button-primary-hover, #2563eb);
  }
  
  .tts-button:active {
    transform: scale(0.98);
    background-color: var(--color-button-primary-hover, #4f46e5);
  }
  
  .tts-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .tts-button.speaking {
    background-color: #4f46e5;
    animation: pulse 2s infinite;
  }
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 24px;
    height: 24px;
  }
  
  .wave {
    position: absolute;
    top: -5px;
    right: -8px;
    height: 10px;
    display: flex;
    align-items: flex-end;
    gap: 1px;
  }
  
  .wave span {
    width: 2px;
    background-color: white;
    border-radius: 1px;
    animation: wave 1s infinite;
  }
  
  .wave span:nth-child(1) {
    height: 4px;
    animation-delay: 0s;
  }
  
  .wave span:nth-child(2) {
    height: 7px;
    animation-delay: 0.2s;
  }
  
  .wave span:nth-child(3) {
    height: 10px;
    animation-delay: 0.4s;
  }
  
  .wave span:nth-child(4) {
    height: 5px;
    animation-delay: 0.6s;
  }
  
  @keyframes wave {
    0%, 100% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(1.5);
    }
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
    }
    70% {
      box-shadow: 0 0 0 6px rgba(79, 70, 229, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    }
  }
  
  .waveform-container {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    background-color: var(--color-bg-primary, white);
  }
</style> 