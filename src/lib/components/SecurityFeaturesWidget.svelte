<script lang="ts">
  import { slide } from 'svelte/transition';
  export let features: string[] = [];
  export let currency: string = "Unknown";
  
  // Check if this is a PHP currency
  $: isPhp = currency.includes("PHP") || currency.includes("Philippine Peso");
  $: isUsd = currency.includes("USD") || currency.includes("US Dollar");
  $: isEur = currency.includes("EUR") || currency.includes("Euro");
  
  // Create a more detailed map of security features with descriptions and how to verify
  interface SecurityFeature {
    title: string;
    description: string;
    howToVerify: string;
    image?: string;
  }
  
  const securityFeatureDetails: Record<string, SecurityFeature> = {
    "Watermark": {
      title: "Watermark",
      description: "An embedded image in the paper that's visible when held up to light.",
      howToVerify: "Hold the bill up to light to see the watermark image, typically showing the same portrait as on the bill."
    },
    "Security thread": {
      title: "Security Thread",
      description: "A thin embedded strip running vertically through the bill.",
      howToVerify: "Hold the bill up to light to see the security thread. It often contains text visible only when backlit."
    },
    "Serial number": {
      title: "Serial Number",
      description: "Unique identifying numbers printed on the bill.",
      howToVerify: "Check that serial numbers are evenly printed with consistent spacing and colors."
    },
    "Optically variable device (OVD)": {
      title: "Optically Variable Device",
      description: "Elements that change appearance when viewed from different angles.",
      howToVerify: "Tilt the bill to see color shifts or moving patterns in specific areas of the bill."
    },
    "Material: Standard paper (older bills) or Polymer (new bills)": {
      title: "Bill Material",
      description: "Currency bills use specialized paper or polymer substrates.",
      howToVerify: "Feel the texture - paper bills have a distinctive texture, while polymer bills feel smoother and slightly slippery."
    },
    "Tactile marks for visually impaired": {
      title: "Tactile Marks",
      description: "Raised printing or patterns to help visually impaired people identify denominations.",
      howToVerify: "Run your fingertip across the bill to feel raised ink or textured patterns."
    },
    "Color-shifting ink": {
      title: "Color-Shifting Ink",
      description: "Ink that changes color when viewed from different angles.",
      howToVerify: "Tilt the bill to see color shifts in denomination numbers or specific design elements."
    },
    "Microprinting": {
      title: "Microprinting",
      description: "Tiny text that's barely visible to the naked eye.",
      howToVerify: "Use a magnifying glass to see tiny words or phrases hidden in what appears to be a line or pattern."
    },
    "Hologram patch": {
      title: "Hologram Patch",
      description: "A metallic patch that shows different images when tilted.",
      howToVerify: "Tilt the bill to see changing images or numbers within the hologram patch."
    },
    "Color-changing number": {
      title: "Color-Changing Number",
      description: "Numbers that shift color when viewed from different angles.",
      howToVerify: "Tilt the bill to see the numbers change from one color to another."
    },
    "See-through register": {
      title: "See-Through Register",
      description: "Partial images on both sides that align perfectly when held up to light.",
      howToVerify: "Hold the bill up to light to see the combined image formed by both sides."
    },
    "Ultraviolet feature": {
      title: "Ultraviolet Features",
      description: "Hidden elements that only appear under ultraviolet light.",
      howToVerify: "Use a UV light to reveal hidden markings, numbers, or patterns."
    },
    "Metallic thread": {
      title: "Metallic Thread",
      description: "A metallic strip embedded or woven into the bill.",
      howToVerify: "Hold the bill up to light to see the continuous thread running through it."
    },
    "Pearl ink": {
      title: "Pearl Ink",
      description: "Ink with a pearlescent or shimmering quality.",
      howToVerify: "Tilt the bill under good lighting to see the shimmering effect in specific areas."
    },
    "Microtext": {
      title: "Microtext",
      description: "Tiny text visible only with magnification.",
      howToVerify: "Use a magnifying glass to read the miniature text hidden within images or borders."
    },
    "Transparent window": {
      title: "Transparent Window",
      description: "A clear window integrated into the bill, common in polymer notes.",
      howToVerify: "Hold the bill up to light to examine the transparent window for embedded features."
    },
    "Color-changing effect": {
      title: "Color-Changing Effect",
      description: "Areas that shift colors when tilted.",
      howToVerify: "Tilt the bill to observe the color shift in designated areas."
    },
    "Tactile feature": {
      title: "Tactile Feature",
      description: "Raised printing that can be felt by touch.",
      howToVerify: "Run your finger over the bill's surface to feel raised areas of ink."
    },
    "Security printing": {
      title: "Security Printing",
      description: "Special printing techniques that are difficult to replicate.",
      howToVerify: "Look for fine-line patterns, microprinting, and precise details that are hard to counterfeit."
    },
    "Special paper (paper or polymer)": {
      title: "Specialized Paper",
      description: "Currency is printed on special paper with unique properties.",
      howToVerify: "Feel the texture and stiffness of the bill, genuine currency paper has a distinctive feel."
    }
  };

  // Currency-specific security information
  const currencySecurityInfo = {
    php: {
      name: "Philippine Peso",
      keyFeatures: [
        "New 1000-peso polymer notes have a clear window with multiple security elements",
        "Iridescent band on newer bills shifts from red to green when tilted",
        "Embossed prints with tactile marks for each denomination"
      ]
    },
    usd: {
      name: "US Dollar",
      keyFeatures: [
        "3D Security Ribbon on $100 bills with shifting bell images",
        "Color-shifting ink changes from copper to green when tilted",
        "Each denomination has a unique portrait and back design"
      ]
    },
    eur: {
      name: "Euro",
      keyFeatures: [
        "Emerald number on newer series shows light moving up and down",
        "Portrait watermarks with denomination value",
        "Raised printing provides tactile feedback"
      ]
    }
  };
  
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
  
  // Toggle state for expanded details
  let expandedFeature: string | null = null;
  
  function toggleFeatureDetails(feature: string) {
    if (expandedFeature === feature) {
      expandedFeature = null;
    } else {
      expandedFeature = feature;
    }
  }
  
  // Filter to get relevant currency info
  $: currencyInfo = isPhp ? currencySecurityInfo.php : 
                   isUsd ? currencySecurityInfo.usd : 
                   isEur ? currencySecurityInfo.eur : null;
</script>

<div class="security-features-widget">
  <div class="widget-header">
    <div class="icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <div class="title">Security Features</div>
  </div>
  
  <div class="widget-content">
    {#if currencyInfo}
      <div class="currency-specific-info">
        <h4>{currencyInfo.name} Security Highlights</h4>
        <ul class="key-features-list">
          {#each currencyInfo.keyFeatures as keyFeature}
            <li>{keyFeature}</li>
          {/each}
        </ul>
      </div>
    {/if}
    
    {#if features && features.length > 0}
      <div class="features-grid">
        {#each features as feature}
          {#if (feature.includes("Material: Standard paper") || feature.includes("paper or polymer")) && isPhp}
            <div class="feature-card material">
              <div class="feature-header" on:click={() => toggleFeatureDetails("material")}>
                <h4>Bill Material</h4>
                <div class="expand-icon {expandedFeature === 'material' ? 'expanded' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              
              {#if expandedFeature === 'material'}
                <div class="feature-content" transition:slide={{ duration: 300 }}>
                  <span>Philippine Peso uses two primary materials:</span>
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
                  <div class="verification-tip">
                    <div class="tip-icon">💡</div>
                    <div class="tip-text">How to verify: Feel the bill. Paper bills have a distinct, slightly rough texture. Polymer bills feel smooth and slightly slippery.</div>
                  </div>
                </div>
              {/if}
            </div>
          {:else if feature in securityFeatureDetails}
            {@const featureDetails = securityFeatureDetails[feature]}
            <div class="feature-card">
              <div class="feature-header" on:click={() => toggleFeatureDetails(feature)}>
                <h4>{featureDetails.title}</h4>
                <div class="expand-icon {expandedFeature === feature ? 'expanded' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              
              {#if expandedFeature === feature}
                <div class="feature-content" transition:slide={{ duration: 300 }}>
                  <p class="feature-description">{featureDetails.description}</p>
                  <div class="verification-tip">
                    <div class="tip-icon">💡</div>
                    <div class="tip-text">How to verify: {featureDetails.howToVerify}</div>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <div class="feature-card">
              <div class="feature-header">
                <h4>{feature}</h4>
              </div>
            </div>
          {/if}
        {/each}
      </div>
      
      <div class="verification-instructions">
        <h4>How to Verify Currency Authenticity</h4>
        <ul class="verification-steps">
          <li>
            <span class="step-number">1</span>
            <span class="step-text">Feel the bill's texture - genuine bills have distinctive tactile features</span>
          </li>
          <li>
            <span class="step-number">2</span>
            <span class="step-text">Hold up to light to check for watermarks and security threads</span>
          </li>
          <li>
            <span class="step-number">3</span>
            <span class="step-text">Tilt the bill to observe color-shifting elements</span>
          </li>
          <li>
            <span class="step-number">4</span>
            <span class="step-text">Use a magnifying glass to check for microprinting</span>
          </li>
        </ul>
      </div>
    {:else}
      <div class="no-features">No security features information available</div>
    {/if}
  </div>
</div>

<style>
  .security-features-widget {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background-color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  .widget-header {
    display: flex;
    align-items: center;
    padding: 16px;
    background-color: #f0f4f8;
    border-bottom: 1px solid #e1e4e8;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #2563eb;
    color: white;
    margin-right: 12px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
  }

  .widget-content {
    padding: 16px;
  }

  .currency-specific-info {
    background-color: #f8fafc;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    border-left: 4px solid #2563eb;
  }

  .currency-specific-info h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #1e293b;
  }

  .key-features-list {
    margin: 0;
    padding-left: 20px;
  }

  .key-features-list li {
    margin-bottom: 8px;
    color: #475569;
    font-size: 14px;
  }

  .key-features-list li:last-child {
    margin-bottom: 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  @media (min-width: 640px) {
    .features-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .feature-card {
    background-color: #f8fafc;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }

  .feature-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .feature-card.material {
    grid-column: 1 / -1;
    border-left: 4px solid #2563eb;
  }

  .feature-header {
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }

  .feature-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: #334155;
  }

  .expand-icon {
    transition: transform 0.3s ease;
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  .feature-content {
    padding: 0 16px 16px;
    border-top: 1px solid #e2e8f0;
  }

  .feature-description {
    color: #475569;
    font-size: 14px;
    margin: 12px 0;
    line-height: 1.5;
  }

  .verification-tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background-color: #ecfdf5;
    padding: 10px 12px;
    border-radius: 6px;
    margin-top: 12px;
  }

  .tip-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .tip-text {
    font-size: 13px;
    color: #064e3b;
    line-height: 1.4;
  }

  .verification-instructions {
    background-color: #eff6ff;
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
  }

  .verification-instructions h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #1e40af;
  }

  .verification-steps {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  .verification-steps li {
    display: flex;
    align-items: flex-start;
    margin-bottom: 10px;
    font-size: 14px;
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background-color: #2563eb;
    color: white;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .step-text {
    color: #1e3a8a;
    line-height: 1.5;
    padding-top: 2px;
  }

  .no-features {
    font-size: 14px;
    color: #64748b;
    text-align: center;
    padding: 20px 0;
  }

  /* Material info styles */
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