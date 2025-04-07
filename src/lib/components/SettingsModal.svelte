<script lang="ts">
  import { slide } from 'svelte/transition';
  
  export let show: boolean = false;
  export let autoAnnounce: boolean = false;
  
  // Create a copy of settings for editing
  let tempSettings = {
    autoAnnounce
  };
  
  // Update parent component with new settings
  function saveSettings() {
    autoAnnounce = tempSettings.autoAnnounce;
    closeModal();
  }
  
  function closeModal() {
    show = false;
  }
  
  // Reset to current settings
  function resetSettings() {
    tempSettings = {
      autoAnnounce
    };
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
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background-color: #3b82f6;
    color: white;
    border: none;
  }
  
  .btn-primary:hover {
    background-color: #2563eb;
  }
  
  .btn-secondary {
    background-color: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
  }
  
  .btn-secondary:hover {
    background-color: #e2e8f0;
  }
</style> 