<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';

  let cameraFeed: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let extractedText: string = "No text detected";
  let currencyValue: string = "Unknown";
  let billAmount: string = "Unknown";
  let stream: MediaStream | null = null;
  let processing: boolean = false;
  let puterLoaded: boolean = false;
  let cameraError: boolean = false;
  let cameraErrorMessage: string = "";
  let showCamera: boolean = false;
  let currentImage: string | null = null; // Store the current image
  let liveScanMode: boolean = false; // Toggle for live scanning
  let scanningInterval: number | null = null; // Store the interval ID
  let lastDetectionTime: number = 0; // To avoid too frequent detections
  let detectionCooldown: number = 2000; // Cooldown in ms between detections
  let detectionConfidence: number = 0; // Track confidence in detection
  let scanSuccess: boolean = false; // Indicate successful scan
  
  // New variables for the modular UI
  let activeMethod: string = ''; // '', 'upload', or 'camera'
  let cameraMode: string = 'photo'; // 'photo' or 'live'
  
  // Mobile menu state
  let mobileMenuOpen: boolean = false;
  
  let previewUrl: string | null = null;
  let uploadComplete: boolean = false;
  
  // Add image zoom functionality
  let imageZoom: number = 1;

  // Add image rotation functionality
  let imageRotation: number = 0;

  // Add fullscreen image viewer state
  let isFullscreen: boolean = false;

  function handleImageZoom(factor: number): void {
    imageZoom = Math.max(0.5, Math.min(2.5, imageZoom * factor));
  }

  function resetImageZoom(): void {
    imageZoom = 1;
  }
  
  function toggleMobileMenu(): void {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function handleImageRotation(degrees: number): void {
    imageRotation = (imageRotation + degrees) % 360;
  }

  function resetImageTransforms(): void {
    imageZoom = 1;
    imageRotation = 0;
  }
  
  // Handle file drag and drop
  function setupDragDrop(): void {
    // Make sure we're in the browser context
    if (typeof window === 'undefined') return;

    // Wait for DOM to load
    setTimeout(() => {
      const dropZone = document.getElementById('dropZone');
      if (!dropZone) return;

      // Prevent default drag behaviors
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
      });

      // Highlight drop zone when item is dragged over it
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
      });

      // Handle dropped files
      dropZone.addEventListener('drop', handleDrop, false);

      function preventDefaults(e: Event) {
        e.preventDefault();
        e.stopPropagation();
      }

      function highlight() {
        if (dropZone) dropZone.classList.add('dragover');
      }

      function unhighlight() {
        if (dropZone) dropZone.classList.remove('dragover');
      }

      function handleDrop(e: DragEvent) {
        if (processing) return;
        
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
          const file = dt.files[0];
          if (file && file.type.startsWith('image/')) {
            processing = true;
            const reader = new FileReader();
            reader.onload = async (e: ProgressEvent<FileReader>) => {
              if (e.target && e.target.result) {
                const imageData = e.target.result as string;
                currentImage = imageData;
                await processImage(imageData);
              }
              processing = false;
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }, 500);
  }

  // Add loading animation for image processing
  let processingProgress: number = 0;
  let processingInterval: number | null = null;

  function startProcessingAnimation(): void {
    processingProgress = 0;
    if (processingInterval) {
      clearInterval(processingInterval);
    }
    
    processingInterval = setInterval(() => {
      processingProgress += 5;
      if (processingProgress >= 100) {
        if (processingInterval) {
          clearInterval(processingInterval);
          processingInterval = null;
        }
      }
    }, 200) as unknown as number;
  }

  onMount(() => {
    // Load Puter.js script
    const puterScript = document.createElement('script');
    puterScript.src = 'https://js.puter.com/v2/';
    puterScript.onload = () => {
      puterLoaded = true;
    };
    document.head.appendChild(puterScript);

    // Setup canvas for image processing
    canvas = document.createElement('canvas');
    
    // Clean up any unwanted navigation text that might be in the DOM
    const removeUnwantedNavText = () => {
      // Remove classes with specific patterns seen in the screenshot
      document.querySelectorAll('.s_y_bCXRkrYIP').forEach(el => {
        if (el.textContent === 'Home' || el.textContent === 'Currencies' || el.textContent === 'About') {
          (el as HTMLElement).style.display = 'none';
        }
      });
      
      // Also try to find any direct links with these texts
      document.querySelectorAll('a').forEach(el => {
        // Only hide if it's not within a nav element
        if (!el.closest('nav') && !el.closest('.mobile-menu') && 
            (el.textContent?.trim() === 'Home' || 
             el.textContent?.trim() === 'Currencies' || 
             el.textContent?.trim() === 'About')) {
          (el as HTMLElement).style.display = 'none';
        }
      });
      
      // Try to find the blue bar that contains these links
      const blueBar = document.querySelector('div[style*="background-color: rgb(179, 208, 241)"]');
      if (blueBar) {
        (blueBar as HTMLElement).style.display = 'none';
      }
    };
    
    // Run cleanup after the DOM has finished rendering
    setTimeout(removeUnwantedNavText, 100);
    
    // Setup drag and drop for file upload
    setupDragDrop();
    
    return () => {
      // Cleanup camera stream when component unmounts
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      // Clear any intervals
      if (scanningInterval) {
        clearInterval(scanningInterval);
      }
      
      // Clean up processing interval
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };
  });

  async function setupCamera(): Promise<void> {
    try {
      // First check if the camera is already in use by another application
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      // First check if we have permission to use the camera
      try {
        // Request camera permission without starting the stream
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permError) {
        if (permError instanceof DOMException && permError.name === 'NotAllowedError') {
          cameraErrorMessage = "Camera access denied. Please allow camera permissions in your browser settings.";
          throw permError;
        }
      }
      
      // Now request the actual camera we want with specific constraints
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      if (cameraFeed) {
        // Set video attributes
        cameraFeed.setAttribute('autoplay', 'true');
        cameraFeed.setAttribute('playsinline', 'true');
        cameraFeed.setAttribute('muted', 'true');
        
        // Set srcObject
        cameraFeed.srcObject = stream;
        
        // Wait for metadata before playing
        cameraFeed.onloadedmetadata = () => {
          if (cameraFeed) {
            // Force play with a slight delay
            setTimeout(() => {
              cameraFeed?.play()
                .then(() => {
                  console.log("Camera playing successfully");
                  showCamera = true;
                  cameraError = false;
                })
                .catch(e => {
                  console.error("Error playing video:", e);
                  cameraError = true;
                  cameraErrorMessage = "Error starting video stream. Please try again.";
                });
            }, 500);
          }
        };
      } else {
        throw new Error("Camera feed element not found");
      }
    } catch (error) {
      console.error("Camera access error:", error);
      cameraError = true;
      
      // More detailed error messages based on the error
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          cameraErrorMessage = "Camera access denied. Please check your browser permissions and try again.";
        } else if (error.name === 'NotFoundError') {
          cameraErrorMessage = "No camera found on your device.";
        } else if (error.name === 'NotReadableError') {
          cameraErrorMessage = "Camera is already in use by another application or browser tab.";
        } else if (error.name === 'OverconstrainedError') {
          cameraErrorMessage = "Camera doesn't support the requested resolution or settings.";
        } else if (error.name === 'AbortError') {
          cameraErrorMessage = "Camera access was aborted. Please try again.";
        } else if (error.name === 'SecurityError') {
          cameraErrorMessage = "Camera access is blocked due to security restrictions.";
        } else {
          cameraErrorMessage = `Camera error: ${error.message}`;
        }
      } else {
        cameraErrorMessage = "Could not access camera. Please ensure camera permissions are granted.";
      }
      
      // Re-throw to be caught by toggleCamera
      throw error;
    }
  }

  // Add a fallback camera implementation
  async function tryFallbackCamera(): Promise<void> {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      // Try with very basic constraints
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (cameraFeed) {
        cameraFeed.srcObject = stream;
        
        // Set attributes directly
        cameraFeed.setAttribute('autoplay', '');
        cameraFeed.setAttribute('playsinline', '');
        cameraFeed.setAttribute('muted', '');
        
        // Manually trigger play after a short delay
        setTimeout(() => {
          cameraFeed?.play()
            .then(() => {
              console.log("Fallback camera playing successfully");
              showCamera = true;
              cameraError = false;
            })
            .catch(e => {
              throw e;
            });
        }, 500);
      } else {
        throw new Error("Camera feed element not found");
      }
    } catch (error) {
      console.error("Fallback camera failed:", error);
      throw error;
    }
  }

  function toggleCamera(): void {
    if (showCamera) {
      // Stop camera if it's already running
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        stream = null;
      }
      // Clear any scanning intervals
      if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
      }
      liveScanMode = false;
      showCamera = false;
      cameraError = false; // Reset error state
    } else {
      // Set UI state
      showCamera = true;
      processing = true;
      cameraError = false;
      
      // Simple implementation matching the HTML example
      async function startCamera() {
        try {
          // Basic camera access like in the HTML example
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          
          // Make sure cameraFeed is available (should be bound by Svelte)
          if (cameraFeed) {
            cameraFeed.srcObject = stream;
            processing = false;
          } else {
            throw new Error("Camera feed element not found");
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
          processing = false;
          cameraError = true;
          
          if (error instanceof Error) {
            cameraErrorMessage = "Could not access the camera: " + error.message;
          } else {
            cameraErrorMessage = "Could not access the camera. Please check your permissions.";
          }
        }
      }
      
      // Start camera immediately (no delay)
      startCamera();
    }
  }

  function toggleLiveScan(): void {
    if (!showCamera) return;

    if (liveScanMode) {
      // Turn off live scanning
      if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
      }
      liveScanMode = false;
    } else {
      // Turn on live scanning
      liveScanMode = true;
      scanningInterval = setInterval(scanFrame, 1000) as unknown as number;
    }
  }

  async function scanFrame(): Promise<void> {
    if (!cameraFeed || !canvas || processing) return;
    
    const now = Date.now();
    if (now - lastDetectionTime < detectionCooldown) return;
    
    processing = true;
    
    const context = canvas.getContext('2d');
    if (!context) {
      processing = false;
      return;
    }
    
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    
    try {
      // Process the frame without updating UI
      const result = await liveProcessImage(imageData);
      
      // If we got a strong detection, auto-capture
      if (detectionConfidence > 0.8) {
        scanSuccess = true;
        setTimeout(() => { scanSuccess = false; }, 500); // Flash success indicator
        
        // Auto-capture the image and process it fully
        currentImage = imageData;
        await processImage(imageData);
        
        // Stop live scanning and go to results
        if (scanningInterval) {
          clearInterval(scanningInterval);
          scanningInterval = null;
        }
        liveScanMode = false;
        
        lastDetectionTime = now;
      }
    } catch (error) {
      console.error("Live scan error:", error);
    }
    
    processing = false;
  }

  // Process image for live scanning without UI updates
  async function liveProcessImage(imageSrc: string): Promise<boolean> {
    try {
      if (!puterLoaded) return false;
      
      const puter = (window as any).puter;
      if (!puter || !puter.ai || !puter.ai.img2txt) return false;
      
      const result = await puter.ai.img2txt(imageSrc);
      if (!result) return false;
      
      const detectionResult = quickDetectCurrency(result);
      
      if (detectionResult.detected) {
        detectionConfidence = detectionResult.confidence;
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
  
  // Quick detection for live scanning
  function quickDetectCurrency(text: string): { detected: boolean, confidence: number } {
    // Currency detection patterns
    const currencyKeywords = [
      /DOLLARS|UNITED STATES|FEDERAL RESERVE/i,
      /PISO|PILIPINAS|BANGKO SENTRAL/i,
      /EURO|ECB|BCE/i,
      /POUNDS|BANK OF ENGLAND/i,
      /PESOS|BANCO DE MEXICO/i,
      /BANK OF CANADA|BANQUE DU CANADA/i,
      /YEN|日本銀行券|日銀/i,
      /RUPEES|RESERVE BANK OF INDIA/i,
      /YUAN|人民银行|中国银行/i
    ];
    
    // Amount detection for common denominations
    const amountKeywords = [
      /\b(1|5|10|20|50|100|500|1000)\b/
    ];
    
    let currencyMatches = 0;
    let amountMatches = 0;
    
    // Check for currency matches
    currencyKeywords.forEach(pattern => {
      if (pattern.test(text)) {
        currencyMatches++;
      }
    });
    
    // Check for amount matches
    amountKeywords.forEach(pattern => {
      if (pattern.test(text)) {
        amountMatches++;
      }
    });
    
    // Calculate confidence score (0 to 1)
    const confidence = (currencyMatches > 0 ? 0.6 : 0) + (amountMatches > 0 ? 0.4 : 0);
    
    return {
      detected: confidence > 0.5,
      confidence
    };
  }

  async function captureImage(): Promise<void> {
    if (!cameraFeed || !canvas || processing) return;
    
    processing = true;
    
    const context = canvas.getContext('2d');
    if (!context) {
      processing = false;
      return;
    }
    
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    currentImage = imageData; // Store the captured image
    await processImage(imageData);
    
    processing = false;
  }

  async function handleFileUpload(event: Event): Promise<void> {
    if (processing) return;
    
    const target = event.target as HTMLInputElement;
    if (!target || !target.files || !target.files[0]) return;
    
    const file = target.files[0];
    if (file) {
      processing = true;
      uploadComplete = false;
      previewUrl = URL.createObjectURL(file);
      
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        if (e.target && e.target.result) {
          const imageData = e.target.result as string;
          currentImage = imageData; // Store the uploaded image
          await processImage(imageData);
          uploadComplete = true;
          setTimeout(() => {
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
          }, 3000);
        }
        processing = false;
      };
      reader.readAsDataURL(file);
    }
  }
  
  function selectMethod(method: string): void {
    activeMethod = method;
    
    // Reset camera if switching away from camera method
    if (activeMethod !== 'camera' && showCamera) {
      toggleCamera();
    }
    
    // Automatically start camera when camera method is selected
    if (activeMethod === 'camera' && !showCamera) {
      // Set a slight delay to allow UI to render first
      setTimeout(() => {
        toggleCamera();
      }, 100);
    }
  }
  
  function setCameraMode(mode: string): void {
    cameraMode = mode;
    
    // If switching to live mode, automatically start live scanning
    if (mode === 'live' && showCamera && stream && !liveScanMode) {
      toggleLiveScan();
    }
    // If switching to photo mode, stop live scanning
    else if (mode === 'photo' && liveScanMode) {
      toggleLiveScan();
    }
  }

  function resetScan(): void {
    currentImage = null;
    currencyValue = "Unknown";
    billAmount = "Unknown";
    extractedText = "No text detected";
    selectMethod(''); // Go back to method selection
  }

  // Update processImage to use the animation
  async function processImage(imageSrc: string): Promise<void> {
    extractedText = "Processing...";
    processing = true;
    startProcessingAnimation();
    
    try {
      if (!puterLoaded) {
        extractedText = "Puter.js is not loaded yet";
        processing = false;
        return;
      }
      
      // Use any to bypass TypeScript checks for dynamically loaded script
      const puter = (window as any).puter;
      if (!puter || !puter.ai || !puter.ai.img2txt) {
        extractedText = "Puter.js API is not available";
        processing = false;
        return;
      }
      
      const result = await puter.ai.img2txt(imageSrc);
      extractedText = result || "No text found";
      detectCurrencyAndAmount(extractedText);
    } catch (error: unknown) {
      if (error instanceof Error) {
        extractedText = "Error: " + error.message;
      } else {
        extractedText = "Unknown error occurred";
      }
    } finally {
      // Stop loading animation
      if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
      }
      processing = false;
    }
  }

  function detectCurrencyAndAmount(text: string): void {
    let currency = "Unknown";
    let amount = "Unknown";

    // Currency detection
    const currencyPatterns: Record<string, RegExp> = {
      "USD (US Dollar)": /DOLLARS|UNITED STATES OF AMERICA|FEDERAL RESERVE NOTE/i,
      "PHP (Philippine Peso)": /PISO|BANGKO SENTRAL NG PILIPINAS|PILIPINAS/i,
      "EUR (Euro)": /EURO|ECB|BCE/i,
      "GBP (British Pound)": /POUNDS|BANK OF ENGLAND/i,
      "MXN (Mexican Peso)": /PESOS|BANCO DE MEXICO/i,
      "CAD (Canadian Dollar)": /BANK OF CANADA|BANQUE DU CANADA/i,
      "JPY (Japanese Yen)": /YEN|日本銀行券|日銀/i,
      "INR (Indian Rupee)": /RESERVE BANK OF INDIA|RUPEES/i,
      "CNY (Chinese Yuan)": /人民银行|中国银行|YUAN/i,
      "KRW (South Korean Won)": /한국은행|대한민국/i,
      "SGD (Singapore Dollar)": /SINGAPORE|MONETARY AUTHORITY OF SINGAPORE/i,
      "AUD (Australian Dollar)": /RESERVE BANK OF AUSTRALIA|DOLLARS/i
    };

    for (const [curr, pattern] of Object.entries(currencyPatterns)) {
      if (pattern.test(text)) {
        currency = curr;
        break;
      }
    }

    // Amount detection
    const amountMatches = text.match(/\b\d{1,4}\b/g); // Extract possible numbers
    if (amountMatches) {
      const knownDenominations = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
      for (const num of amountMatches.map(Number)) {
        if (knownDenominations.includes(num)) {
          amount = num.toString();
          break;
        }
      }
    }

    currencyValue = currency;
    billAmount = amount !== "Unknown" ? `${amount}` : "Not detected";
  }

  // Helper function to get issuing authority for the detected currency
  function getIssuingAuthority(currency: string): string {
    const authorities: Record<string, string> = {
      "USD (US Dollar)": "Federal Reserve System",
      "PHP (Philippine Peso)": "Bangko Sentral ng Pilipinas",
      "EUR (Euro)": "European Central Bank",
      "GBP (British Pound)": "Bank of England",
      "MXN (Mexican Peso)": "Bank of Mexico",
      "CAD (Canadian Dollar)": "Bank of Canada",
      "JPY (Japanese Yen)": "Bank of Japan",
      "INR (Indian Rupee)": "Reserve Bank of India",
      "CNY (Chinese Yuan)": "People's Bank of China",
      "KRW (South Korean Won)": "Bank of Korea",
      "SGD (Singapore Dollar)": "Monetary Authority of Singapore",
      "AUD (Australian Dollar)": "Reserve Bank of Australia"
    };
    
    return authorities[currency] || "Unknown";
  }
  
  // Helper function to get security features for the detected currency
  function getSecurityFeatures(currency: string): string[] {
    const features: Record<string, string[]> = {
      "USD (US Dollar)": [
        "Watermark", 
        "Security thread", 
        "Color-shifting ink",
        "Microprinting"
      ],
      "EUR (Euro)": [
        "Watermark", 
        "Security thread", 
        "Hologram patch",
        "Color-changing number"
      ],
      "GBP (British Pound)": [
        "Hologram", 
        "See-through register",
        "Ultraviolet feature", 
        "Metallic thread"
      ],
      "JPY (Japanese Yen)": [
        "Watermark", 
        "Hologram", 
        "Pearl ink",
        "Microprinting"
      ],
      "CNY (Chinese Yuan)": [
        "Watermark", 
        "Security thread", 
        "Color-changing ink",
        "Microtext"
      ],
      "AUD (Australian Dollar)": [
        "Transparent window", 
        "Color-changing effect",
        "Microprinting", 
        "Tactile feature"
      ]
    };
    
    return features[currency] || ["Watermark", "Security printing", "Special paper"];
  }

  // Add a simple camera test function like the HTML example
  async function testCamera(): Promise<void> {
    const testDiv = document.createElement('div');
    testDiv.style.position = 'fixed';
    testDiv.style.top = '0';
    testDiv.style.left = '0';
    testDiv.style.right = '0';
    testDiv.style.bottom = '0';
    testDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    testDiv.style.zIndex = '9999';
    testDiv.style.display = 'flex';
    testDiv.style.flexDirection = 'column';
    testDiv.style.alignItems = 'center';
    testDiv.style.justifyContent = 'center';
    testDiv.style.color = 'white';
    testDiv.style.fontFamily = 'Arial, sans-serif';
    testDiv.style.padding = '20px';
    
    const header = document.createElement('h2');
    header.textContent = 'Camera Test';
    header.style.marginBottom = '20px';
    
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.style.width = '80%';
    videoEl.style.maxWidth = '400px';
    videoEl.style.border = '2px solid white';
    videoEl.style.borderRadius = '10px';
    videoEl.style.marginBottom = '20px';
    
    const statusText = document.createElement('p');
    statusText.textContent = 'Trying to access camera...';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.backgroundColor = 'white';
    closeBtn.style.color = 'black';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
      if (videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      document.body.removeChild(testDiv);
    };
    
    testDiv.appendChild(header);
    testDiv.appendChild(videoEl);
    testDiv.appendChild(statusText);
    testDiv.appendChild(closeBtn);
    document.body.appendChild(testDiv);
    
    try {
      // Simple direct camera access like in HTML example
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoEl.srcObject = stream;
      statusText.textContent = '✅ Camera working properly!';
      statusText.style.color = '#4ade80';
    } catch (error) {
      statusText.textContent = `❌ Camera error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      statusText.style.color = '#ef4444';
    }
  }

  // Fix linter errors by safely handling the currency code extraction
  function getCurrencyCode(value: string): string {
    const match = value.match(/\((.*?)\)/);
    return match && match[1] ? match[1] : "Unknown";
  }

  // Add keyboard support for the dropzone
  function handleDropzoneKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.getElementById('imageUpload')?.click();
    }
  }

  function toggleFullscreen(): void {
    isFullscreen = !isFullscreen;
    
    // Reset transforms when exiting fullscreen
    if (!isFullscreen) {
      resetImageTransforms();
    }
  }
</script>

<svelte:head>
  <title>Money Scanner</title>
</svelte:head>

<div class="container">
  <!-- Decorative background elements -->
  <div class="bg-decoration bg-circle-1"></div>
  <div class="bg-decoration bg-circle-2"></div>
  <div class="bg-decoration bg-dots"></div>
  
  <!-- Update header to be more compact -->
  <header class="app-header">
    <div class="header-content">
      <div class="logo-container">
        <div class="logo">
          <span class="logo-icon">💵</span>
          <div class="logo-shine"></div>
        </div>
        <div class="logo-text">
          <h1>Money Scanner</h1>
          <span class="logo-subtitle">Quick & Accurate</span>
        </div>
      </div>
      <nav class="main-nav">
        <ul>
          <li><a href="/" class="active">Home</a></li>
          <li><a href="#currencies">Currencies</a></li>
          <li><a href="#history">History</a></li>
          <li><a href="#help">Help</a></li>
          <li><a href="#settings">Settings</a></li>
        </ul>
      </nav>
      <button class="mobile-menu-toggle" on:click={toggleMobileMenu} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
    
    <!-- Add workflow progress indicator -->
    {#if activeMethod || currentImage}
      <div class="workflow-progress">
        <div class="progress-container">
          <div class="progress-step {!activeMethod && !currentImage ? 'active' : 'complete'}" title="Select scanning method">
            <div class="step-icon">1</div>
            <span class="step-label">Select Method</span>
          </div>
          <div class="progress-line {activeMethod || currentImage ? 'active' : ''}"></div>
          <div class="progress-step {activeMethod && !currentImage ? 'active' : currentImage ? 'complete' : ''}" title="Capture or upload image">
            <div class="step-icon">2</div>
            <span class="step-label">{activeMethod === 'upload' ? 'Upload' : 'Capture'}</span>
          </div>
          <div class="progress-line {currentImage ? 'active' : ''}"></div>
          <div class="progress-step {currentImage ? 'active' : ''}" title="View scan results">
            <div class="step-icon">3</div>
            <span class="step-label">Results</span>
          </div>
        </div>
      </div>
    {/if}
   
  </header>
  
  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu open" transition:slide={{ duration: 300 }}>
      <ul>
        <li><a href="/" class="active">Home</a></li>
        <li><a href="#currencies">Currencies</a></li>
        <li><a href="#history">History</a></li>
        <li><a href="#help">Help</a></li>
        <li><a href="#settings">Settings</a></li>
      </ul>
    </div>
  {/if}
  
  <!-- Main content area with reduced text -->
  <main class="main-content">
    <div class="page-header">
      <h2>Money Scanner</h2>
    </div>
  
    {#if !currentImage}
      {#if activeMethod === ''}
        <!-- Selection of scan method with reduced text -->
        <div class="scan-method-selector">
          <div class="section-intro">
            <h3>Choose a Scanning Method</h3>
            <p>Select how you'd like to scan your currency</p>
          </div>
          <div class="method-cards">
            <!-- Upload Method Card -->
            <div class="method-card" on:click={() => selectMethod('upload')} title="Upload an image from your device">
              <div class="method-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="icon-animation"></div>
              </div>
              <div class="method-card-content">
                <h3>Upload Image</h3>
                <p class="method-card-description">Scan money from your photo gallery</p>
                <ul class="method-card-tips">
                  <li>Use a well-lit, clear image</li>
                  <li>Ensure the full bill is visible</li>
                  <li>Supports JPG, PNG formats</li>
                </ul>
              </div>
              <div class="method-button">
                <span class="button-text">Select</span>
                <span class="button-shine"></span>
              </div>
            </div>
            
            <!-- Camera Method Card -->
            <div class="method-card" on:click={() => selectMethod('camera')} title="Use your device's camera">
              <div class="method-card-icon camera-icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" class="camera-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div class="icon-animation camera-animation"></div>
              </div>
              <div class="method-card-content">
                <h3>Use Camera</h3>
                <p class="method-card-description">Scan money using your camera in real-time</p>
                <ul class="method-card-tips">
                  <li>Ensure good lighting</li>
                  <li>Keep the bill flat and steady</li>
                  <li>Position within the frame</li>
                </ul>
              </div>
              <div class="method-button">
                <span class="button-text">Select</span>
                <span class="button-shine"></span>
              </div>
            </div>
          </div>
        </div>
      {:else if activeMethod === 'upload'}
        <!-- Upload Section with enhanced UI -->
        <div class="card">
          <div class="card-content">
            <div class="section-header">
              <h2>Upload Image</h2>
              <div class="divider"></div>
            </div>
            
            <div class="upload-section-layout">
              <div class="upload-container">
                <div 
                  class="upload-box {processing ? 'uploading' : ''}" 
                  id="dropZone"
                  tabindex="0"
                  role="button"
                  aria-label="Upload an image of currency. Click or press Enter to select a file, or drag and drop an image here."
                  on:keydown={handleDropzoneKeyDown}
                >
                  <label for="imageUpload" title="Click to browse files or drag and drop an image">
                    {#if previewUrl}
                      <div class="preview-container {uploadComplete ? 'complete' : ''}">
                        <img src={previewUrl} alt="Preview" class="preview-image" />
                        {#if uploadComplete}
                          <div class="success-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                          </div>
                        {/if}
                      </div>
                    {:else}
                      <div class="upload-icon-container">
                        <svg xmlns="http://www.w3.org/2000/svg" class="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div class="upload-animation"></div>
                      </div>
                    {/if}
                    <div class="upload-text">
                      <span class="upload-primary">Drag & drop image here</span>
                      <span class="upload-secondary">or click to browse files</span>
                    </div>
                    {#if processing}
                      <div class="upload-progress">
                        <div class="progress-bar-container">
                          <div class="progress-bar" style="width: {processingProgress}%"></div>
                        </div>
                        <span>Processing image... {processingProgress}%</span>
                      </div>
                    {/if}
                    <input 
                      type="file" 
                      id="imageUpload" 
                      accept="image/*" 
                      on:change={handleFileUpload}
                      aria-label="Upload currency image"
                    />
                  </label>
                </div>
              </div>

              <div class="currency-examples">
                <h3>Sample Currency Images</h3>
                <div class="example-images">
                  <div class="example-image">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/United_States_one_dollar_bill%2C_obverse.jpg/320px-United_States_one_dollar_bill%2C_obverse.jpg" 
                      alt="Example of a US dollar bill for scanning" 
                    />
                    <span class="example-label">USD Example</span>
                  </div>
                  <div class="example-image">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/EUR_20_obverse_%282015_issue%29.jpg/320px-EUR_20_obverse_%282015_issue%29.jpg" alt="Sample Euro bill" />
                    <span class="example-label">EUR Example</span>
                  </div>
                </div>
                <div class="upload-tips">
                  <h4>For Best Results:</h4>
                  <ul>
                    <li>Ensure good lighting</li>
                    <li>Place bill on flat surface</li>
                    <li>Capture the entire bill</li>
                    <li>Avoid shadows and glare</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="text-center mt-4">
              <button class="btn btn-secondary" on:click={() => selectMethod('')} title="Return to method selection">
                <span class="btn-icon">←</span> Back
              </button>
            </div>
          </div>
        </div>
      {:else if activeMethod === 'camera'}
        <!-- Camera Section -->
        <div class="card">
          <div class="card-header">
            <h2>Camera Scanner</h2>
            <div class="divider"></div>
          </div>
          
          <div class="card-content">
            <div class="camera-tabs">
              <button 
                class="tab-button {cameraMode === 'photo' ? 'active' : ''}" 
                on:click={() => setCameraMode('photo')}
                title="Take a single photo of currency"
              >
                <span class="tab-icon">📷</span> Photo
              </button>
              <button 
                class="tab-button {cameraMode === 'live' ? 'active' : ''}" 
                on:click={() => setCameraMode('live')}
                title="Automatically scan bills in real-time"
              >
                <span class="tab-icon">🔄</span> Live Scan
              </button>
            </div>
            
            {#if processing}
              <div class="camera-loading">
                <div class="spinner"></div>
                <p>Loading camera...</p>
              </div>
            {:else if cameraError}
              <div class="error-container">
                <div class="error-message">
                  <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <p>{cameraErrorMessage}</p>
                </div>
                <div class="error-actions">
                  <button 
                    class="btn btn-primary" 
                    on:click={toggleCamera}
                    title="Try connecting to the camera again"
                  >
                    <span class="btn-icon">🔄</span> Retry
                  </button>
                  <button 
                    class="btn btn-primary" 
                    on:click={testCamera}
                    title="Test if your camera works properly"
                  >
                    <span class="btn-icon">🔍</span> Test Camera
                  </button>
                  <button 
                    class="btn btn-secondary" 
                    on:click={() => selectMethod('')}
                    title="Return to method selection"
                  >
                    <span class="btn-icon">←</span> Back
                  </button>
                </div>
              </div>
            {:else}
              <div class="camera-section-layout">
                <div class="camera-container-wrapper">
                  <div class="camera-container {cameraMode === 'live' ? 'live-mode' : ''}">
                    <video 
                      bind:this={cameraFeed}
                      autoplay 
                      playsInline
                      class="camera-video"
                    ></video>
                    
                    {#if processing}
                      <div class="camera-status-indicator">
                        <div class="spinner"></div>
                        <p>Starting camera...</p>
                      </div>
                    {/if}
                    
                    {#if cameraMode === 'photo'}
                      <div class="camera-guide-overlay">
                        <div class="camera-guide-frame"></div>
                      </div>
                      <button 
                        on:click={captureImage}
                        disabled={processing || !stream}
                        class="btn btn-round btn-camera"
                        title="Take photo"
                        aria-label="Capture image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    {:else if cameraMode === 'live'}
                      <div class="scan-frame"></div>
                      <div class="scan-status">
                        <div class="scan-indicator {scanSuccess ? 'success' : ''}"></div>
                        <span>{scanSuccess ? 'Detected!' : 'Position bill'}</span>
                      </div>
                    {/if}
                  </div>
                </div>
                
                <div class="camera-sidebar">
                  <div class="sidebar-header">
                    <h3>Camera Tips</h3>
                  </div>
                  <div class="sidebar-content">
                    {#if cameraMode === 'photo'}
                      <ul class="camera-tips">
                        <li>Position bill within the frame</li>
                        <li>Ensure good lighting</li>
                        <li>Keep camera steady</li>
                      </ul>
                    {:else if cameraMode === 'live'}
                      <ul class="camera-tips">
                        <li>Move bill slowly in front of camera</li>
                        <li>Ensure good lighting</li>
                        <li>System will detect automatically</li>
                      </ul>
                    {/if}
                  </div>
                  <div class="camera-controls">
                    {#if cameraMode === 'live' && stream}
                      <button 
                        class="btn {liveScanMode ? 'btn-primary' : 'btn-secondary'}" 
                        on:click={toggleLiveScan}
                        title={liveScanMode ? 'Pause scanning' : 'Start scanning'}
                      >
                        <span class="btn-icon">{liveScanMode ? '⏸️' : '▶️'}</span> {liveScanMode ? 'Pause' : 'Start'}
                      </button>
                    {/if}
                    
                    <button 
                      class="btn btn-secondary" 
                      on:click={() => selectMethod('')}
                      title="Return to method selection"
                    >
                      <span class="btn-icon">←</span> Back
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <!-- Results Section -->
      <div class="card results-card">
        <div class="results-header">
          <h2>Scan Results</h2>
          <div class="animated-divider"></div>
        </div>
        
        <div class="card-content">
          <div class="results-container">
            <div class="scanned-image-container">
              {#if processing}
                <div class="camera-overlay">
                  <div class="spinner"></div>
                  <p>Processing...</p>
                </div>
              {/if}
              <div class="image-controls">
                <button class="image-control-btn" title="Zoom in" on:click={() => handleImageZoom(1.2)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                </button>
                <button class="image-control-btn" title="Zoom out" on:click={() => handleImageZoom(0.8)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                </button>
                <button class="image-control-btn" title="Rotate left" on:click={() => handleImageRotation(-90)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12c0 5.5 4.5 10 10 10s10-4.5 10-10S17.5 2 12 2"></path>
                    <polyline points="2 8 6 12 2 16"></polyline>
                  </svg>
                </button>
                <button class="image-control-btn" title="Rotate right" on:click={() => handleImageRotation(90)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"></path>
                    <polyline points="22 8 18 12 22 16"></polyline>
                  </svg>
                </button>
                <button class="image-control-btn" title="Reset image" on:click={() => resetImageTransforms()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 2v6h6"></path>
                    <path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
                  </svg>
                </button>
                <button class="image-control-btn" title={isFullscreen ? "Exit fullscreen" : "View fullscreen"} on:click={toggleFullscreen}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    {#if isFullscreen}
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                    {:else}
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    {/if}
                  </svg>
                </button>
              </div>
              <div class="image-wrapper" class:fullscreen={isFullscreen}>
                <img 
                  src={currentImage} 
                  alt="Scanned bill" 
                  class="scanned-image" 
                  style="transform: scale({imageZoom}) rotate({imageRotation}deg);" 
                />
                {#if isFullscreen}
                  <button class="close-fullscreen" on:click={toggleFullscreen}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                {/if}
              </div>
              <div class="image-decoration"></div>
              <div class="image-instructions">
                Use controls above to zoom, rotate, and view fullscreen
              </div>
            </div>
            
            <div class="results-details">
              <div class="result-panel">
                <div class="result-icon">💰</div>
                <h3>Currency Type</h3>
                <div class="result-value">
                  {currencyValue}
                </div>
              </div>
              
              <div class="result-panel">
                <div class="result-icon">💵</div>
                <h3>Amount</h3>
                <div class="result-value">
                  {billAmount}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Enhanced currency information -->
          <div class="currency-details">
            <h3 class="details-header">Currency Information</h3>
            
            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-icon">🌐</div>
                <div class="detail-content">
                  <h4>Currency Code</h4>
                  <p>{getCurrencyCode(currencyValue)}</p>
                </div>
              </div>
              
              <div class="detail-item">
                <div class="detail-icon">🏦</div>
                <div class="detail-content">
                  <h4>Issuing Authority</h4>
                  <p>{getIssuingAuthority(currencyValue)}</p>
                </div>
              </div>
              
              <div class="detail-item">
                <div class="detail-icon">💱</div>
                <div class="detail-content">
                  <h4>Exchange Rate</h4>
                  <p>1 {getCurrencyCode(currencyValue)} ≈ $1.00 USD</p>
                  <span class="detail-note">Rates are approximate</span>
                </div>
              </div>
              
              <div class="detail-item">
                <div class="detail-icon">🔍</div>
                <div class="detail-content">
                  <h4>Security Features</h4>
                  <ul class="security-features">
                    {#each getSecurityFeatures(currencyValue) as feature}
                      <li>{feature}</li>
                    {/each}
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="detail-panel">
              <h4>Detected Text</h4>
              <div class="text-panel">
                <p>{extractedText}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="action-bar">
          <div class="action-buttons">
            <button class="action-button" title="Save this scan to history">
              <span class="action-icon">💾</span>
              <span>Save</span>
            </button>
            
            <button class="action-button" title="Share these results">
              <span class="action-icon">🔗</span>
              <span>Share</span>
            </button>
            
            <button class="action-button" on:click={() => window.print()} title="Print these results">
              <span class="action-icon">🖨️</span>
              <span>Print</span>
            </button>
          </div>
        </div>
        
        <div class="card-footer">
          <button class="btn btn-primary" on:click={resetScan} title="Scan another bill">
            <span class="btn-icon">🔄</span> Scan Again
          </button>
          <a href="#currencies" class="btn btn-secondary">
            <span class="btn-icon">📊</span> Currency Guide
          </a>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  /* Base styles with more visual interest */
  :global(body) {
    background: linear-gradient(135deg, #eef2ff 0%, #e6f7ff 100%);
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    position: relative;
    overflow-x: hidden;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    margin: 0;
  }
  
  /* Add subtle animated pattern to the background */
  :global(body)::before {
    content: "";
    position: fixed;
    inset: 0;
    background-image: 
      linear-gradient(transparent 0px, transparent 1px, rgba(59, 130, 246, 0.02) 1px, transparent 2px),
      linear-gradient(90deg, transparent 0px, transparent 1px, rgba(59, 130, 246, 0.02) 1px, transparent 2px);
    background-size: 35px 35px;
    z-index: -1;
    animation: pattern-shift 120s infinite linear;
    opacity: 0.7;
  }
  
  @keyframes pattern-shift {
    0% { background-position: 0 0; }
    100% { background-position: 1000px 500px; }
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding-top: 60px; /* Add space for the fixed header */
    position: relative;
    z-index: 1;
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    padding-bottom: 2rem; /* Add space at the bottom */
  }
  
  /* Main content should expand to fill available space */
  .main-content {
    flex: 1 0 auto;
  }
  
  /* Decorative background elements */
  .bg-decoration {
    position: fixed;
    z-index: -1;
    opacity: 0.4;
  }
  
  .bg-circle-1 {
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0) 70%);
    top: -200px;
    right: -200px;
  }
  
  .bg-circle-2 {
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, rgba(59, 130, 246, 0) 70%);
    bottom: -100px;
    left: -100px;
  }
  
  .bg-dots {
    width: 100%;
    height: 100%;
    background-image: radial-gradient(rgba(37, 99, 235, 0.1) 1px, transparent 1px);
    background-size: 30px 30px;
    background-position: 0 0;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  
  /* Enhanced header styles */
  .app-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.95), rgba(242, 246, 255, 0.95));
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.06),
      0 1px 0 rgba(59, 130, 246, 0.1);
    padding: 0.75rem 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 2px solid transparent;
    border-image: linear-gradient(to right, #60a5fa, #3b82f6, #1e40af);
    border-image-slice: 1;
  }
  
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }
  
  .logo-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .logo {
    font-size: 2rem;
    line-height: 1;
    padding: 0.25rem;
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    border-radius: 16px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    box-shadow: 
      0 6px 15px rgba(37, 99, 235, 0.3),
      inset 0 1px 2px rgba(255, 255, 255, 0.4),
      0 0 0 2px rgba(59, 130, 246, 0.15);
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .logo:hover {
    transform: scale(1.05) rotate(5deg);
    box-shadow: 
      0 8px 20px rgba(37, 99, 235, 0.4),
      inset 0 1px 3px rgba(255, 255, 255, 0.5),
      0 0 0 3px rgba(59, 130, 246, 0.2);
  }
  
  .logo-icon {
    position: relative;
    z-index: 2;
  }
  
  .logo-shine {
    position: absolute;
    top: -20px;
    left: -20px;
    width: 80px;
    height: 80px;
    background: linear-gradient(45deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%);
    z-index: 1;
    transform: rotate(45deg);
    animation: logo-shine 3s infinite;
  }
  
  @keyframes logo-shine {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    50% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
    100% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
  }
  
  .logo-text h1 {
    font-size: 1.4rem;
    margin: 0;
    font-weight: 700;
    color: #1e40af;
    letter-spacing: -0.02em;
    line-height: 1.2;
    position: relative;
    background: linear-gradient(to right, #1e40af, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .logo-subtitle {
    font-size: 0.8rem;
    color: #60a5fa;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  
  /* Improved main nav styles */
  .main-nav {
    display: none;
  }
  
  .main-nav ul {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: 2rem;
  }
  
  .main-nav a {
    text-decoration: none;
    color: #4b5563;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.5rem 0;
    position: relative;
    transition: color 0.2s ease;
  }
  
  .main-nav a:hover {
    color: #2563eb;
  }
  
  .main-nav a.active {
    color: #2563eb;
  }
  
  .main-nav a.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
  }
  
  /* Content styles enhancements */
  .card {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    margin-bottom: 2rem;
    border: 1px solid rgba(0, 0, 0, 0.04);
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
    overflow: hidden;
  }
  
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }
  
  .card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.02) 0%, transparent 20%),
      radial-gradient(circle at 85% 60%, rgba(37, 99, 235, 0.03) 0%, transparent 30%);
    z-index: 0;
    pointer-events: none;
  }
  
  .card > * {
    position: relative;
    z-index: 1;
  }
  
  .page-header {
    text-align: center;
    margin: 2.5rem 0 3rem;
    position: relative;
  }
  
  .page-header::before {
    content: "";
    position: absolute;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.05) 0%, transparent 70%);
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: -1;
    border-radius: 50%;
  }
  
  .page-header::after {
    content: "";
    display: block;
    width: 80px;
    height: 4px;
    background: linear-gradient(90deg, #2563eb, #60a5fa);
    margin: 1rem auto 0;
    border-radius: 2px;
    animation: pulse-width 3s infinite;
  }
  
  @keyframes pulse-width {
    0% { width: 40px; opacity: 0.7; }
    50% { width: 80px; opacity: 1; }
    100% { width: 40px; opacity: 0.7; }
  }
  
  .page-header h2 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0;
    color: #1e40af;
    letter-spacing: -0.02em;
  }
  
  /* Enhanced method cards - modified for horizontal layout on desktop */
  .method-cards {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin: 2rem auto;
    max-width: 800px;
    position: relative;
  }
  
  /* Add floating particles around method cards */
  .method-cards::before,
  .method-cards::after {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .method-cards::before {
    background-image: 
      radial-gradient(circle at 20% 35%, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0) 50px),
      radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 40px),
      radial-gradient(circle at 40% 80%, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0) 30px);
    filter: blur(1px);
    animation: float-particles 15s infinite ease-in-out;
  }
  
  .method-cards::after {
    background-image: 
      radial-gradient(circle at 70% 65%, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0) 40px),
      radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 50px),
      radial-gradient(circle at 60% 30%, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0) 35px);
    filter: blur(1px);
    animation: float-particles 20s infinite ease-in-out reverse;
  }
  
  @keyframes float-particles {
    0% { transform: rotate(0deg) scale(1); }
    33% { transform: rotate(2deg) scale(1.02); }
    66% { transform: rotate(-2deg) scale(0.98); }
    100% { transform: rotate(0deg) scale(1); }
  }
  
  /* Make cards horizontal on desktop with equal dimensions */
  @media (min-width: 768px) {
    .method-cards {
      flex-direction: row;
      justify-content: center;
      gap: 2rem;
      margin: 3rem auto;
    }
    
    .method-card {
      flex: 1;
      width: 350px;
      height: 420px; /* Fixed height for equal sizing */
      padding: 2rem;
      max-width: 350px;
    }
  }
  
  .method-card {
    background: linear-gradient(145deg, #ffffff, #f8faff);
    border-radius: 20px;
    box-shadow: 
      0 10px 25px rgba(37, 99, 235, 0.08), 
      0 5px 10px rgba(37, 99, 235, 0.05),
      inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    padding: 2rem;
    padding-bottom: 2.5rem;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
    border: 1px solid rgba(59, 130, 246, 0.1);
    position: relative;
    overflow: hidden;
    transform-style: preserve-3d;
    perspective: 1000px;
  }
  
  .method-card:hover {
    transform: translateY(-10px) scale(1.03) rotateX(3deg) rotateY(-3deg);
    box-shadow: 
      0 25px 50px rgba(37, 99, 235, 0.15), 
      0 15px 25px rgba(37, 99, 235, 0.1),
      0 0 0 2px rgba(147, 197, 253, 0.2),
      inset 0 0 0 1px rgba(255, 255, 255, 0.8);
    background: linear-gradient(145deg, #ffffff, #eef6ff);
  }
  
  /* Add 3D-like glow effect to card edges */
  .method-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 8px;
    height: 100%;
    background: linear-gradient(to bottom, #3b82f6, #60a5fa, #93c5fd);
    border-radius: 16px 0 0 16px;
    transition: all 0.4s ease;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
    transform: translateZ(10px);
  }
  
  .method-card::after {
    content: "";
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
    border-radius: 50%;
    z-index: 0;
    transform: translateZ(5px);
  }
  
  /* Add a subtle color-changing border */
  .method-card > * {
    position: relative;
    z-index: 2;
  }
  
  .method-card:hover {
    transform: translateY(-8px) scale(1.02) rotateX(2deg) rotateY(-2deg);
    box-shadow: 
      0 20px 40px rgba(37, 99, 235, 0.15), 
      0 15px 20px rgba(37, 99, 235, 0.1),
      0 0 0 2px rgba(147, 197, 253, 0.2);
    background: linear-gradient(145deg, #ffffff, #eef6ff);
  }
  
  .method-card:hover::before {
    width: 12px;
    background: linear-gradient(to bottom, #2563eb, #3b82f6, #60a5fa);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
    filter: brightness(1.2);
  }
  
  .method-card-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #eef6ff, #dbeafe);
    border-radius: 50%;
    margin-right: 1.75rem;
    color: #2563eb;
    flex-shrink: 0;
    position: relative;
    box-shadow: 
      0 8px 16px rgba(37, 99, 235, 0.15), 
      inset 0 -2px 6px rgba(0, 0, 0, 0.05),
      0 0 0 4px rgba(219, 234, 254, 0.4);
    overflow: hidden;
    transition: all 0.5s ease;
    transform: translateZ(20px);
  }
  
  .method-card:hover .method-card-icon {
    transform: translateZ(30px) scale(1.1);
    box-shadow: 
      0 12px 20px rgba(37, 99, 235, 0.2), 
      inset 0 -2px 6px rgba(0, 0, 0, 0.08),
      0 0 0 6px rgba(219, 234, 254, 0.5);
  }
  
  .icon-animation {
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.2));
    z-index: 1;
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  
  .method-card:hover .icon-animation {
    opacity: 1;
    animation: pulse-light 3s infinite;
  }
  
  @keyframes pulse-light {
    0% {
      opacity: 0.2;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.2;
      transform: scale(1);
    }
  }
  
  .camera-animation {
    background: linear-gradient(45deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3));
  }
  
  .method-card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-right: 1rem;
  }
  
  .method-card h3 {
    margin: 0 0 0.5rem;
    font-size: 1.4rem;
    font-weight: 600;
    color: #1e3a8a;
    transition: all 0.3s ease;
    transform: translateZ(15px);
  }
  
  .method-card:hover h3 {
    color: #1e40af;
    text-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    transform: translateZ(25px);
  }
  
  .method-card-description {
    margin: 0 0 1rem 0;
    color: #6b7280;
    font-size: 0.95rem;
    transition: all 0.3s ease;
    transform: translateZ(10px);
  }
  
  .method-card:hover .method-card-description {
    color: #4b5563;
    transform: translateZ(15px);
  }
  
  .method-button {
    background: linear-gradient(135deg, #4f8df8 0%, #2563eb 100%);
    color: white;
    padding: 0.8rem 1.5rem;
    border-radius: 14px;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    box-shadow: 
      0 8px 20px rgba(37, 99, 235, 0.3), 
      inset 0 2px 4px rgba(255, 255, 255, 0.4),
      0 0 0 1px rgba(37, 99, 235, 0.2);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    width: 90%;
    text-align: center;
    display: block;
    position: relative;
    bottom: 0;
    margin-top: auto;
    margin-bottom: 3rem;
    overflow: hidden;
    z-index: 5;
    transform: translateZ(20px);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    animation: button-pulse 3s infinite;
  }
  
  .button-text {
    position: relative;
    z-index: 3;
    font-weight: 700;
    display: inline-block;
    transform: translateZ(5px);
    transition: all 0.3s ease;
  }
  
  .button-shine {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(255, 255, 255, 0) 5%, 
      rgba(255, 255, 255, 0.25) 50%, 
      rgba(255, 255, 255, 0) 95%, 
      transparent 100%);
    transform: translateX(-100%) skewX(-15deg);
    z-index: 2;
  }
  
  @keyframes button-pulse {
    0% { box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.4), 0 0 0 1px rgba(37, 99, 235, 0.2); }
    50% { box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4), 0 0 0 1px rgba(37, 99, 235, 0.3); }
    100% { box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.4), 0 0 0 1px rgba(37, 99, 235, 0.2); }
  }
  
  .method-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
    transform: translateX(-100%);
    transition: transform 0.8s ease;
    z-index: 1;
  }
  
  .method-button::after {
    content: "";
    position: absolute;
    bottom: -50%;
    left: -10%;
    height: 200%;
    width: 120%;
    background: linear-gradient(transparent, rgba(255, 255, 255, 0.15), transparent);
    transform: rotate(25deg);
    transition: transform 0.8s ease;
    z-index: 1;
  }
  
  .method-card:hover .method-button {
    transform: translateZ(30px) scale(1.05);
    box-shadow: 
      0 15px 30px rgba(37, 99, 235, 0.5), 
      inset 0 2px 6px rgba(255, 255, 255, 0.8),
      0 0 0 2px rgba(59, 130, 246, 0.4);
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 80%, #2563eb 100%);
    animation: none;
  }
  
  .method-card:hover .method-button .button-text {
    transform: translateZ(10px) scale(1.05);
    letter-spacing: 0.03em;
  }
  
  .method-card:hover .method-button .button-shine {
    animation: shine-sweep 1.5s ease-in-out;
  }
  
  @keyframes shine-sweep {
    0% {
      transform: translateX(-100%) skewX(-15deg);
    }
    100% {
      transform: translateX(200%) skewX(-15deg);
    }
  }
  
  .method-card:hover .method-button::before {
    transform: translateX(100%);
    transition: transform 1.5s ease;
  }
  
  /* Workflow progress indicator */
  .workflow-progress {
    background: rgba(255, 255, 255, 0.9);
    border-top: 1px solid rgba(37, 99, 235, 0.1);
    padding: 0.75rem 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .progress-container {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  
  .progress-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;
    transition: all 0.3s ease;
  }
  
  .step-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #e2e8f0;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;
    border: 2px solid #e2e8f0;
  }
  
  .step-label {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  
  .progress-line {
    height: 3px;
    width: 80px;
    background-color: #e2e8f0;
    margin: 0 0.5rem;
    margin-bottom: 2rem;
    transition: all 0.3s ease;
    position: relative;
  }
  
  /* Active state */
  .progress-step.active .step-icon {
    background-color: #3b82f6;
    color: white;
    transform: scale(1.1);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
  }
  
  .progress-step.active .step-label {
    color: #3b82f6;
    font-weight: 600;
  }
  
  /* Complete state */
  .progress-step.complete .step-icon {
    background-color: #10b981;
    color: white;
    border-color: #10b981;
  }
  
  .progress-step.complete .step-label {
    color: #10b981;
  }
  
  .progress-line.active {
    background-color: #3b82f6;
  }
  
  /* Small screen adjustments */
  @media (max-width: 640px) {
    .progress-line {
      width: 40px;
    }
    
    .step-label {
      font-size: 0.7rem;
    }
    
    .step-icon {
      width: 28px;
      height: 28px;
      font-size: 0.8rem;
    }
  }

  /* Mobile menu enhancements */
  .mobile-menu {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    background: white;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    z-index: 999;
    transform: translateY(-100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    border-bottom: 2px solid #3b82f6;
  }
  
  .mobile-menu.open {
    transform: translateY(0);
    opacity: 1;
  }
  
  .mobile-menu ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .mobile-menu li {
    margin: 0.5rem 0;
  }
  
  .mobile-menu a {
    display: block;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: #4b5563;
    font-weight: 500;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .mobile-menu a:hover {
    background-color: #f3f4f6;
    color: #2563eb;
  }
  
  .mobile-menu a.active {
    background-color: #eff6ff;
    color: #2563eb;
    font-weight: 600;
  }
  
  .mobile-menu-toggle {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 24px;
    height: 18px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    z-index: 1000;
  }
  
  .mobile-menu-toggle span {
    width: 100%;
    height: 2px;
    background-color: #4b5563;
    transition: all 0.3s ease;
    transform-origin: left center;
  }
  
  .mobile-menu-toggle[aria-expanded="true"] span:first-child {
    transform: rotate(45deg);
    background-color: #2563eb;
  }
  
  .mobile-menu-toggle[aria-expanded="true"] span:nth-child(2) {
    opacity: 0;
  }
  
  .mobile-menu-toggle[aria-expanded="true"] span:last-child {
    transform: rotate(-45deg);
    background-color: #2563eb;
  }
  
  @media (min-width: 1024px) {
    .main-nav {
      display: block;
    }
    
    .mobile-menu-toggle {
      display: none;
    }
  }

  /* Enhanced currency details styles */
  .currency-details {
    margin-top: 2rem;
    background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  
  .details-header {
    font-size: 1.25rem;
    color: #334155;
    margin-bottom: 1.25rem;
    position: relative;
    padding-bottom: 0.75rem;
  }
  
  .details-header::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 60px;
    height: 3px;
    background: linear-gradient(to right, #3b82f6, #60a5fa);
    border-radius: 3px;
  }
  
  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }
  
  .detail-item {
    background-color: white;
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(226, 232, 240, 0.5);
    display: flex;
    align-items: flex-start;
    transition: all 0.3s ease;
  }
  
  .detail-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
  }
  
  .detail-icon {
    font-size: 1.75rem;
    margin-right: 1rem;
    color: #3b82f6;
    background: rgba(219, 234, 254, 0.3);
    width: 48px;
    height: 48px;
    min-width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
  }
  
  .detail-content {
    flex: 1;
  }
  
  .detail-content h4 {
    margin: 0 0 0.5rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .detail-content p {
    margin: 0;
    color: #334155;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .detail-note {
    display: block;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.25rem;
    font-weight: normal;
  }
  
  .security-features {
    margin: 0.5rem 0 0;
    padding: 0 0 0 1.25rem;
  }
  
  .security-features li {
    margin-bottom: 0.25rem;
    color: #334155;
    font-size: 0.9rem;
  }
  
  .detail-panel {
    background-color: white;
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(226, 232, 240, 0.5);
  }
  
  .detail-panel h4 {
    margin: 0 0 1rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .text-panel {
    background-color: #f8fafc;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .text-panel p {
    margin: 0;
    color: #475569;
    font-size: 0.9rem;
    line-height: 1.5;
    word-break: break-word;
    font-family: monospace;
    white-space: pre-wrap;
  }
  
  .action-bar {
    display: flex;
    justify-content: center;
    margin: 1.5rem 0;
    padding: 0 1rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .action-button {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }
  
  .action-button:hover {
    background-color: #f1f5f9;
    color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  
  .action-icon {
    font-size: 1.25rem;
  }
  
  @media (max-width: 768px) {
    .details-grid {
      grid-template-columns: 1fr;
    }
    
    .action-buttons {
      width: 100%;
    }
    
    .action-button {
      flex: 1;
      justify-content: center;
    }
  }

  /* Enhanced upload styles */
  .upload-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-bottom: 2rem;
  }
  
  .upload-box {
    width: 100%;
    max-width: 500px;
    height: 240px;
    border: 2px dashed #93c5fd;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(219, 234, 254, 0.3);
    padding: 2rem;
    position: relative;
    transition: all 0.3s ease;
    cursor: pointer;
    overflow: hidden;
  }
  
  .upload-box:hover, .upload-box.dragover {
    border-color: #3b82f6;
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.15);
    background-color: rgba(219, 234, 254, 0.5);
  }
  
  .upload-box label {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .upload-icon-container {
    width: 80px;
    height: 80px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
    border: 2px solid rgba(59, 130, 246, 0.2);
    transition: all 0.3s ease;
  }
  
  .upload-box:hover .upload-icon-container {
    background: rgba(59, 130, 246, 0.2);
    transform: scale(1.1);
    border-color: rgba(59, 130, 246, 0.4);
  }
  
  .upload-icon {
    width: 40px;
    height: 40px;
    color: #3b82f6;
    position: relative;
    z-index: 2;
    transition: all 0.3s ease;
  }
  
  .upload-box:hover .upload-icon {
    transform: scale(1.1);
    color: #2563eb;
  }
  
  .upload-animation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
    transform: scale(0);
    opacity: 0;
    transition: all 0.5s ease;
  }
  
  .upload-box:hover .upload-animation {
    transform: scale(2);
    opacity: 1;
    animation: pulse-upload 2s infinite;
  }
  
  @keyframes pulse-upload {
    0% { transform: scale(0.8); opacity: 0.3; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(0.8); opacity: 0.3; }
  }
  
  .upload-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .upload-primary {
    font-size: 1.1rem;
    font-weight: 600;
    color: #3b82f6;
    margin-bottom: 0.5rem;
  }
  
  .upload-secondary {
    font-size: 0.9rem;
    color: #64748b;
  }
  
  .upload-box input[type="file"] {
    width: 0.1px;
    height: 0.1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    z-index: -1;
  }
  
  .upload-box.uploading {
    background-color: rgba(219, 234, 254, 0.8);
    border-color: #60a5fa;
  }
  
  .upload-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1rem;
  }
  
  .progress-circle {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(59, 130, 246, 0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    margin-right: 0.75rem;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .currency-examples {
    margin-top: 2rem;
    width: 100%;
  }
  
  .currency-examples h3 {
    font-size: 1.1rem;
    color: #334155;
    margin-bottom: 1rem;
    text-align: center;
  }
  
  .example-images {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  
  .example-image {
    width: 160px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    position: relative;
  }
  
  .example-image:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  }
  
  .example-image img {
    width: 100%;
    height: auto;
    display: block;
  }
  
  .example-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    text-align: center;
  }
  
  .upload-tips {
    background-color: #f8fafc;
    border-radius: 10px;
    padding: 1rem;
    border: 1px solid #e2e8f0;
  }
  
  .upload-tips h4 {
    font-size: 0.9rem;
    color: #334155;
    margin: 0 0 0.5rem 0;
  }
  
  .upload-tips ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .upload-tips li {
    font-size: 0.85rem;
    color: #475569;
    margin-bottom: 0.25rem;
  }
  
  /* Media queries */
  @media (min-width: 768px) {
    .upload-section-layout {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 2rem;
      align-items: start;
    }
    
    .currency-examples {
      margin-top: 0;
    }
  }
  
  @media (max-width: 767px) {
    .upload-box {
      height: 200px;
      padding: 1.5rem;
    }
    
    .upload-icon-container {
      width: 60px;
      height: 60px;
      margin-bottom: 1rem;
    }
    
    .upload-icon {
      width: 30px;
      height: 30px;
    }
    
    .example-image {
      width: 130px;
    }
  }

  /* Add these styles to the <style> section */
  .progress-bar-container {
    width: 100%;
    height: 8px;
    background-color: rgba(226, 232, 240, 0.6);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 4px;
    transition: width 0.3s ease;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }
  
  .upload-box.dragover {
    border-color: #2563eb;
    background-color: rgba(219, 234, 254, 0.7);
    transform: translateY(-5px) scale(1.02);
    box-shadow: 0 15px 30px rgba(37, 99, 235, 0.2);
  }
  
  .upload-box.dragover .upload-icon-container {
    background: rgba(59, 130, 246, 0.3);
    transform: scale(1.1);
  }
  
  .upload-box.dragover .upload-primary {
    color: #2563eb;
  }

  /* Add these styles to the <style> section */
  .preview-container {
    width: 160px;
    height: 160px;
    margin-bottom: 1.5rem;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    position: relative;
    transition: all 0.3s ease;
    border: 3px solid #60a5fa;
  }
  
  .preview-container.complete {
    border-color: #10b981;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  }
  
  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: #f1f5f9;
  }
  
  .success-icon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(16, 185, 129, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    animation: fade-in 0.5s ease;
  }
  
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Add these accessibility-focused styles */
  
  /* Focus styling */
  .upload-box:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
  }
  
  /* Improved keyboard navigation indicators */
  .upload-box:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
  
  /* Make the file input more accessible to screen readers */
  .upload-box input[type="file"] {
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    z-index: -1;
  }
  
  /* Add aria-live region styling for status updates */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  /* High contrast mode support */
  @media (forced-colors: active) {
    .upload-box {
      border: 2px solid CanvasText;
    }
    
    .upload-box:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
    
    .preview-container {
      border: 2px solid CanvasText;
    }
  }

  /* Results Section Styling */
  .results-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  
  @media (min-width: 768px) {
    .results-container {
      grid-template-columns: minmax(0, 1fr) 300px;
      align-items: start;
    }
  }
  
  .scanned-image-container {
    background-color: #f8fafc;
    border-radius: 12px;
    padding: 1rem;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  
  .image-wrapper {
    position: relative;
    width: 100%;
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
  }
  
  .scanned-image {
    max-width: 100%;
    max-height: 280px;
    object-fit: contain;
    transition: transform 0.3s ease;
    transform-origin: center;
  }
  
  .image-controls {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .image-control-btn {
    background-color: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .image-control-btn:hover {
    background-color: #e2e8f0;
    color: #334155;
  }
  
  .image-decoration {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    opacity: 0.5;
  }
  
  .results-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .result-panel {
    background: white;
    border-radius: 10px;
    padding: 1rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .result-icon {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }
  
  .result-panel h3 {
    font-size: 0.9rem;
    color: #64748b;
    margin: 0;
    font-weight: 600;
  }
  
  .result-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #334155;
  }

  /* Add the following CSS to the style section */
  .image-wrapper.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: 0;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-wrapper.fullscreen .scanned-image {
    max-width: 90%;
    max-height: 80vh;
  }

  .close-fullscreen {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background-color: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .close-fullscreen:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .image-instructions {
    text-align: center;
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.75rem;
  }

  @media (max-width: 640px) {
    .image-controls {
      flex-wrap: wrap;
    }
    
    .image-control-btn {
      width: 28px;
      height: 28px;
    }
    
    .image-wrapper {
      height: 240px;
    }
    
    .scanned-image {
      max-height: 220px;
    }
  }
</style>
  