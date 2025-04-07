<script lang="ts">
  export let features: string[] = [];
  export let currency: string = "Unknown";
  
  // Check if this is a PHP currency
  $: isPhp = currency.includes("PHP") || currency.includes("Philippine Peso");
  
  // Information about PHP bill materials
  const phpMaterialInfo = {
    paper: {
      title: "Standard Paper",
      years: "1949-2019",
      notes: "Used in traditional banknotes; feels like regular paper with a distinct texture.",
      denominations: "All older denominations (₱20, ₱50, ₱100, ₱200, ₱500, ₱1000)"
    },
    polymer: {
      title: "Polymer",
      years: "2019-Present",
      notes: "More durable, water-resistant, and harder to counterfeit than paper bills.",
      denominations: "New ₱1000 bills (blue/design), with other denominations being converted gradually"
    }
  };
</script>

<div class="security-features-widget">
  <div class="widget-header">
    <div class="icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="11" r="8" />
        <line x1="12" y1="8" x2="12" y2="14" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </svg>
    </div>
    <div class="title">Security Features</div>
  </div>
  <div class="widget-content">
    {#if features && features.length > 0}
      <ul class="features-list">
        {#each features as feature}
          <li class="feature-item">
            {#if (feature.includes("Material: Standard paper") || feature.includes("paper or polymer")) && isPhp}
              <span>Material: <strong>Two types used in Philippine Peso</strong></span>
              <div class="material-info">
                <div class="material-type">
                  <div class="material-icon paper"></div>
                  <span class="material-name">{phpMaterialInfo.paper.title}</span>
                  <span class="material-years">{phpMaterialInfo.paper.years}</span>
                </div>
                <div class="material-type">
                  <div class="material-icon polymer"></div>
                  <span class="material-name">{phpMaterialInfo.polymer.title}</span>
                  <span class="material-years">{phpMaterialInfo.polymer.years}</span>
                </div>
              </div>
              {#if isPhp}
                <div class="material-details">
                  <div class="material-section">
                    <h5>Standard Paper Bills</h5>
                    <p>{phpMaterialInfo.paper.notes}</p>
                    <p class="denominations"><strong>Denominations:</strong> {phpMaterialInfo.paper.denominations}</p>
                  </div>
                  <div class="material-section">
                    <h5>Polymer Bills</h5>
                    <p>{phpMaterialInfo.polymer.notes}</p>
                    <p class="denominations"><strong>Denominations:</strong> {phpMaterialInfo.polymer.denominations}</p>
                  </div>
                </div>
              {/if}
            {:else}
              {feature}
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <div class="no-features">No security features information available</div>
    {/if}
  </div>
</div>

<style>
  .security-features-widget {
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
    background-color: #2563eb;
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
  }

  .features-list {
    padding-left: 20px;
    margin: 0;
  }

  .feature-item {
    margin-bottom: 16px;
    color: #334155;
    font-size: 14px;
    line-height: 1.5;
  }

  .feature-item:last-child {
    margin-bottom: 0;
  }

  .no-features {
    font-size: 14px;
    color: #64748b;
    text-align: center;
    padding: 10px 0;
  }

  .material-info {
    display: flex;
    justify-content: space-around;
    margin-top: 8px;
    padding: 12px;
    background-color: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .material-type {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
  }

  .material-name {
    font-weight: 600;
    color: #334155;
    margin-top: 6px;
  }

  .material-years {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }

  .material-icon {
    width: 40px;
    height: 40px;
    border-radius: 4px;
  }

  .paper {
    background-color: #f5f5dc;
    border: 1px dashed #94a3b8;
    position: relative;
  }

  .paper::after {
    content: "";
    position: absolute;
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    background-image: 
      linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%), 
      linear-gradient(-45deg, rgba(0,0,0,0.05) 25%, transparent 25%);
    background-size: 4px 4px;
  }

  .polymer {
    background-color: #e0f2fe;
    border: 1px solid #38bdf8;
    position: relative;
  }

  .polymer::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.3) 100%);
  }

  .material-details {
    margin-top: 12px;
    font-size: 12px;
    background-color: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    padding: 12px;
  }

  .material-section {
    margin-bottom: 12px;
  }

  .material-section:last-child {
    margin-bottom: 0;
  }

  .material-section h5 {
    font-size: 13px;
    margin: 0 0 5px 0;
    color: #334155;
  }

  .material-section p {
    margin: 0 0 5px 0;
    color: #64748b;
    line-height: 1.4;
  }

  .denominations {
    font-size: 11px;
  }
</style> 