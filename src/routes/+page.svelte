<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import ExchangeRateWidget from '$lib/components/ExchangeRateWidget.svelte';
  import SecurityFeaturesWidget from '$lib/components/SecurityFeaturesWidget.svelte';
  import TextToSpeechButton from '$lib/components/TextToSpeechButton.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';

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

  // New variable for auto-announcing bill details
  let autoAnnounce: boolean = false;
  
  // Add exchange rate target currency selection
  let targetCurrency: string = "USD";
  
  // Common currencies for conversion
  const commonCurrencies = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "PHP", name: "Philippine Peso" }
  ];
  
  // Settings modal state
  let showSettings = false;
  
  // Updated function to go back to the method selector
  let showMethodSelector = true; // Add this variable to track the method selector visibility
  
  // Add required file upload functions
  function triggerFileUpload(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  
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
              resetProcessingState();
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

  async function toggleCamera(): Promise<void> {
    if (showCamera) {
      // Turn off camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      showCamera = false;
      cameraFeed = null;
    } else {
      // Turn on camera
      async function startCamera() {
        try {
          // Reset any previous camera errors
          cameraError = false;
          cameraErrorMessage = "";
          processing = true;
          
          // Stop any existing stream
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
          
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          
          // Make sure cameraFeed is available (should be bound by Svelte)
          if (cameraFeed) {
            cameraFeed.srcObject = stream;
            resetProcessingState();
          } else {
            throw new Error("Camera feed element not found");
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
          cameraError = true;
          
          if (error instanceof Error) {
            cameraErrorMessage = "Could not access the camera: " + error.message;
          } else {
            cameraErrorMessage = "Could not access the camera. Please check your permissions.";
          }
          resetProcessingState();
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
      resetProcessingState();
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
    
    resetProcessingState();
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
    startProcessingAnimation();
    
    const context = canvas.getContext('2d');
    if (!context) {
      resetProcessingState();
      return;
    }
    
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    currentImage = imageData; // Store the captured image
    await processImage(imageData);
    
    resetProcessingState();
  }

  async function handleFileUpload(event: Event): Promise<void> {
    if (processing) return;
    
    const target = event.target as HTMLInputElement;
    if (!target || !target.files || !target.files[0]) return;
    
    const file = target.files[0];
    if (file) {
      processing = true;
      startProcessingAnimation();
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
        resetProcessingState();
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
    targetCurrency = "USD"; // Reset target currency
    selectMethod(''); // Go back to method selection
  }

  // Function to directly scan another bill without going back to method selection
  function scanAgain(): void {
    currentImage = null;
    currencyValue = "Unknown";
    billAmount = "Unknown";
    extractedText = "No text detected";
    targetCurrency = "USD"; // Reset target currency
    
    // Directly open the file upload dialog
    const fileInput = document.getElementById('globalFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Update processImage to use the animation
  async function processImage(imageSrc: string): Promise<void> {
    try {
      extractedText = "Processing...";
      processing = true;
      startProcessingAnimation();
      
      if (!puterLoaded) {
        extractedText = "Puter.js is not loaded yet";
        resetProcessingState();
        return;
      }
      
      // Use any to bypass TypeScript checks for dynamically loaded script
      const puter = (window as any).puter;
      if (!puter || !puter.ai || !puter.ai.img2txt) {
        extractedText = "Puter.js API is not available";
        resetProcessingState();
        return;
      }
      
      const result = await puter.ai.img2txt(imageSrc);
      console.log("Extracted text from image:", result);
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
      resetProcessingState();
    }
  }

  function resetProcessingState(): void {
    processing = false;
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
    processingProgress = 0;
  }

  function detectCurrencyAndAmount(text: string): void {
    let currency = "Unknown";
    let amount = "Unknown";

    console.log("Starting currency detection for text:", text);
    
    // Currency detection
    const currencyPatterns: Record<string, RegExp> = {
      "USD (US Dollar)": /DOLLARS|UNITED STATES OFAMERICA|FEDERAL RESERVE NOTE/i,
      "PHP (Philippine Peso)": /PISO|PILIPINAS|BANGKO SENTRAL|REPUBLIKA NG|SANLI(B|L)IB(S|G)|PHILIPPINES/i,
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
        console.log(`Matched currency pattern for: ${curr}`);
        currency = curr;
        break;
      }
    }
    
    // Special case for Philippine Peso detection - Look for visual clues in the text
    if (currency === "Unknown" && (
        text.includes("REPUBLIKA") || 
        text.includes("NG PILIPINAS") || 
        text.includes("PILIPINO") ||
        text.includes("SANDAAN") ||
        text.includes("LIBO") ||
        text.includes("KH") || // Serial number prefix on PHP bills
        text.includes("SANLIBONG PISO") // Specifically for 1000 peso bill
    )) {
      console.log("Detected Philippine Peso through special case patterns");
      currency = "PHP (Philippine Peso)";
    }

    // Amount detection
    const amountMatches = text.match(/\b\d{1,4}\b/g); // Extract possible numbers
    console.log("Possible amounts found:", amountMatches);
    
    if (amountMatches) {
      const knownDenominations = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
      
      // First pass: Look for exact matches with known denominations
      for (const num of amountMatches.map(Number)) {
        if (knownDenominations.includes(num)) {
          console.log(`Found matching denomination: ${num}`);
          amount = num.toString();
          break;
        }
      }
      
      // Second pass: If no match, try to find numbers that are part of the common denominations
      // This helps with bills where the number might be detected as part of other text
      if (amount === "Unknown") {
        // Look for denomination patterns in the text
        for (const denom of knownDenominations) {
          if (text.includes(denom.toString())) {
            console.log(`Found denomination in text: ${denom}`);
            amount = denom.toString();
            break;
          }
        }
      }
      
      // Third pass: For Philippine Peso specifically, look for text patterns indicating denomination
      if (currency === "PHP (Philippine Peso)" && amount === "Unknown") {
        if (text.match(/ONE THOUSAND|1000|SANLIBO/i)) amount = "1000";
        else if (text.match(/FIVE HUNDRED|500|LIMANDAA/i)) amount = "500";
        else if (text.match(/TWO HUNDRED|200|DALAWANDAA/i)) amount = "200";
        else if (text.match(/ONE HUNDRED|100|SANDAA/i)) amount = "100";
        else if (text.match(/FIFTY|50|LIMAMPU/i)) amount = "50";
        else if (text.match(/TWENTY|20|DALAWAMPU/i)) amount = "20";
        
        if (amount !== "Unknown") {
          console.log(`Detected PHP denomination from text pattern: ${amount}`);
        }
      }
      
      // Special case for 1000 Philippine Peso - Visual pattern match 
      if (currency === "PHP (Philippine Peso)" && amount === "Unknown") {
        // Check for visual indicators of 1000 Peso bill
        if (text.includes("1000") || 
            text.includes("SANLIBO") || 
            text.includes("LIBO") || 
            text.match(/SANL([IL])\1B([AO])NG/i)) {
          console.log("Detected 1000 PHP through visual patterns");
          amount = "1000";
        }
      }
    }

    currencyValue = currency;
    billAmount = amount !== "Unknown" ? `${amount}` : "Not detected";
    console.log(`Final detection - Currency: ${currency}, Amount: ${billAmount}`);
    
    // Set a relevant target currency based on the detected currency
    const detectedCode = getCurrencyCode(currency);
    if (detectedCode !== "Unknown") {
      // If the detected currency is USD, default to EUR, otherwise default to USD
      targetCurrency = detectedCode === "USD" ? "EUR" : "USD";
    }
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
      "PHP (Philippine Peso)": [
        "Watermark",
        "Security thread",
        "Serial number",
        "Optically variable device (OVD)",
        "Material: Standard paper (older bills) or Polymer (new bills)",
        "Tactile marks for visually impaired"
      ],
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
    
    return features[currency] || ["Watermark", "Security printing", "Special paper (paper or polymer)"];
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
    // Extract the currency code from format like "USD (US Dollar)"
    const match = value.match(/\b([A-Z]{3})\b/);
    return match && match[1] ? match[1] : "Unknown";
  }

  // Get numeric amount from billAmount string
  function getNumericAmount(amount: string): number {
    if (amount === "Unknown") return 1;
    
    // Try to parse as a number
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 1 : parsed;
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

  // Function to open settings modal
  function openSettings(): void {
    showSettings = true;
  }

  function handleDragOver(event: DragEvent): void {
    const dropzone = event.currentTarget as HTMLElement;
    dropzone.classList.add('dragover');
  }

  function handleDragLeave(event: DragEvent): void {
    const dropzone = event.currentTarget as HTMLElement;
    dropzone.classList.remove('dragover');
  }

  function handleDrop(event: DragEvent): void {
    const dropzone = event.currentTarget as HTMLElement;
    dropzone.classList.remove('dragover');
    
    if (event.dataTransfer && event.dataTransfer.files.length) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.files = event.dataTransfer.files;
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);
      }
    }
  }
</script>

<svelte:head>
  <title>Money Scanner</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<!-- Add the settings modal component -->
<SettingsModal 
  bind:show={showSettings}
  bind:autoAnnounce={autoAnnounce}
/>

<div class="container">
  <!-- Modern, minimal header -->
  <header class="app-header">
    <div class="header-content">
      <div class="logo-container">
        <div class="logo">
          <span class="logo-icon">💵</span>
        </div>
        <div class="logo-text">
          <h1>Money Scanner</h1>
          <span class="logo-subtitle">Currency Recognition Tool</span>
        </div>
      </div>
      <nav class="main-nav">
        <ul>
          <li><a href="/" class="active">Home</a></li>
          <li><a href="#currencies">Currencies</a></li>
          <li><a href="#settings" on:click={openSettings}>Settings</a></li>
        </ul>
      </nav>
      <button class="mobile-menu-toggle" on:click={toggleMobileMenu} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
    
    <!-- Minimal workflow progress indicator -->
    {#if activeMethod || currentImage}
      <div class="workflow-progress">
        <div class="progress-container">
          <div class="progress-step {!activeMethod && !currentImage ? 'active' : 'complete'}" title="Select scanning method">
            <div class="step-icon">1</div>
            <span class="step-label">Select</span>
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
  
  <!-- Processing Indicator Overlay -->
  {#if processing}
    <div class="processing-indicator">
      <div class="processing-content">
        <div class="spinner"></div>
        <p class="processing-text">Analyzing bill content...</p>
        <div class="progress-bar">
          <div class="progress-bar-inner" style="width: {processingProgress}%"></div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Simplified mobile menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu open" transition:slide={{ duration: 300 }}>
      <ul>
        <li><a href="/" class="active">Home</a></li>
        <li><a href="#currencies">Currencies</a></li>
        <li><a href="#settings" on:click={openSettings}>Settings</a></li>
      </ul>
    </div>
  {/if}
  
  <!-- Main content area with reduced text -->
  <main class="main-content">
    {#if !currentImage}
      {#if activeMethod === ''}
        <!-- Simplified scan method selector -->
        <div class="scan-method-selector">
          <div class="section-intro">
            <h3>Scan Currency</h3>
            <p>Choose how you'd like to scan your bill</p>
          </div>
          <div class="method-cards">
            <!-- Upload Method Card -->
            <div class="method-card" on:click={() => selectMethod('upload')} title="Upload an image from your device">
              <div class="method-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <h3>Upload Image</h3>
              <p class="method-card-description">Upload an image of your bill from your device</p>
              <button class="method-button">Select Image</button>
            </div>
            
            <!-- Camera Method Card -->
            <div class="method-card" on:click={() => selectMethod('camera')} title="Use your camera to scan a bill">
              <div class="method-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </div>
              <h3>Use Camera</h3>
              <p class="method-card-description">Use your camera to instantly scan a bill</p>
              <button class="method-button">Open Camera</button>
            </div>
          </div>
        </div>
        
      {:else if activeMethod === 'upload'}
        <!-- Simplified upload section -->
        <div class="upload-container">
          <div class="upload-header">
            <h2 class="upload-title">Upload Bill Image</h2>
            <button class="btn btn-secondary" on:click={() => { activeMethod = ''; showMethodSelector = true; }}>
              <i class="fas fa-arrow-left"></i> Back
            </button>
          </div>
          <div class="upload-content">
            <div class="dropzone" on:click={triggerFileUpload} on:dragover|preventDefault={handleDragOver} on:dragleave={handleDragLeave} on:drop|preventDefault={handleDrop}>
              <i class="fas fa-upload dropzone-icon"></i>
              <p class="dropzone-text">Click or drag and drop to upload</p>
              <p class="dropzone-subtext">Supported formats: JPEG, PNG</p>
            </div>
            <input type="file" accept="image/*" hidden on:change={handleFileUpload} />
          </div>
        </div>
        
      {:else if activeMethod === 'camera'}
        <!-- Simplified camera section -->
        <div class="camera-container">
          <div class="camera-header">
            <h2 class="camera-title">Scan Bill with Camera</h2>
            <button class="btn btn-secondary" on:click={() => { activeMethod = ''; showMethodSelector = true; }}>
              <i class="fas fa-arrow-left"></i> Back
            </button>
          </div>
          <div class="camera-content">
            {#if !showCamera}
              <button class="btn btn-primary" on:click={toggleCamera}>
                <i class="fas fa-camera"></i> Start Camera
              </button>
            {:else if cameraError}
              <div class="camera-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>{cameraErrorMessage}</p>
                <button class="btn btn-primary" on:click={toggleCamera}>Try Again</button>
              </div>
            {:else if processing}
              <div class="camera-loading">
                <div class="spinner"></div>
                <p>Initializing camera...</p>
              </div>
            {:else}
              <div class="camera-preview">
                <video bind:this={cameraFeed} autoplay playsinline></video>
              </div>
              <div class="camera-controls">
                <button class="btn btn-secondary" on:click={toggleCamera}>
                  <i class="fas fa-times"></i> Cancel
                </button>
                <button class="btn btn-primary" on:click={captureImage}>
                  <i class="fas fa-camera"></i> Capture Image
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <!-- Modern, clean results display -->
      <div class="result-card">
        <div class="result-header">
          <h2 class="result-title">Scan Results</h2>
        </div>
        <div class="result-content">
          <div class="scanned-image-container">
            <div class="image-controls">
              <button class="image-control-btn" on:click={() => handleImageZoom(1.1)} title="Zoom in">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <button class="image-control-btn" on:click={() => handleImageZoom(0.9)} title="Zoom out">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <button class="image-control-btn" on:click={() => handleImageRotation(90)} title="Rotate image">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
              <button class="image-control-btn" on:click={resetImageTransforms} title="Reset image">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 2v6h6"></path>
                  <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
                  <path d="M21 22v-6h-6"></path>
                  <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
                </svg>
              </button>
              <button class="image-control-btn" on:click={toggleFullscreen} title="View fullscreen">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 3h6v6"></path>
                  <path d="M9 21H3v-6"></path>
                  <path d="M21 3l-7 7"></path>
                  <path d="M3 21l7-7"></path>
                </svg>
              </button>
            </div>
            
            <div class="image-wrapper" class:fullscreen={isFullscreen}>
              {#if currentImage}
                <img 
                  src={currentImage} 
                  alt="Scanned currency"
                  class="scanned-image"
                  style="transform: scale({imageZoom}) rotate({imageRotation}deg); transition: transform 0.3s ease;"
                />
              {/if}
              
              {#if isFullscreen}
                <button class="close-fullscreen" on:click={toggleFullscreen}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              {/if}
            </div>
          </div>
          
          <div class="result-panels">
            <div class="result-panel">
              <div class="result-icon">💵</div>
              <h3>Bill Value</h3>
              <div class="result-value">{billAmount}</div>
            </div>
            
            <div class="result-panel">
              <div class="result-icon">🏛️</div>
              <h3>Currency</h3>
              <div class="result-value">{currencyValue}</div>
            </div>
            
            <!-- Add a speak button for accessibility -->
            <div class="result-panel speak-panel">
              <div class="result-icon">🔊</div>
              <h3>Voice Announcement</h3>
              <div class="result-value">
                <TextToSpeechButton 
                  amount={billAmount}
                  currency={getCurrencyCode(currencyValue)}
                  extraInfo={`Issued by ${getIssuingAuthority(currencyValue)}`}
                  iconOnly={false}
                />
              </div>
            </div>
          </div>
          
          <!-- Currency details in clean, modern grid -->
          <div class="currency-details">
            <h3 class="details-header">
              Currency Information
            </h3>
            
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
                  <div class="exchange-rate-container">
                    <div class="currency-selector">
                      <label for="targetCurrency">Convert to:</label>
                      <select 
                        id="targetCurrency" 
                        bind:value={targetCurrency}
                        class="currency-select"
                      >
                        {#each commonCurrencies as currency}
                          <option value={currency.code} disabled={currency.code === getCurrencyCode(currencyValue)}>
                            {currency.code} - {currency.name}
                          </option>
                        {/each}
                      </select>
                    </div>
                    <div class="conversion-info">
                      <p class="conversion-from">
                        {billAmount !== "Unknown" && billAmount !== "Not detected" ? billAmount : "1"} {getCurrencyCode(currencyValue)}
                      </p>
                      <div class="conversion-arrow">→</div>
                    </div>
                    <ExchangeRateWidget 
                      fromCurrency={getCurrencyCode(currencyValue) !== "Unknown" ? getCurrencyCode(currencyValue) : "PHP"} 
                      toCurrency={targetCurrency} 
                      amount={getNumericAmount(billAmount)} 
                    />
                  </div>
                </div>
              </div>
              
              <div class="detail-item">
                <div class="detail-icon">🔍</div>
                <div class="detail-content">
                  <h4>Security Features</h4>
                  <SecurityFeaturesWidget 
                    features={getSecurityFeatures(currencyValue)} 
                    currency={currencyValue}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <button class="btn btn-secondary" on:click={resetScan} title="Return to home screen">
            <span class="btn-icon">🏠</span> Back to Home
          </button>
          <button class="btn btn-primary" on:click={scanAgain} title="Scan another bill">
            <span class="btn-icon">🔄</span> Scan Another Bill
          </button>
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- Hidden canvas for image processing -->
<canvas bind:this={canvas} style="display: none;"></canvas>

<!-- Global hidden file input for scanAgain function -->
<input type="file" id="globalFileInput" accept="image/*" hidden on:change={handleFileUpload} />

<style>
  /* Modern base styles */
  :global(body) {
    background-color: #f9fafb;
    color: #1f2937;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    position: relative;
    overflow-x: hidden;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    margin: 0;
    line-height: 1.5;
  }
  
  /* Clean, subtle background */
  :global(body)::before {
    content: "";
    position: fixed;
    inset: 0;
    background-size: 60px 60px;
    background-image: 
      radial-gradient(circle, rgba(99, 102, 241, 0.03) 1px, transparent 0);
    z-index: -1;
    opacity: 0.5;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 120px 16px 32px;
    position: relative;
    z-index: 1;
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
  }
  
  /* Main content should expand to fill available space */
  .main-content {
    flex: 1 0 auto;
    padding: 20px 8px;
    margin-top: 30px;
  }
  
  /* Modern header styles */
  .app-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    padding: 12px 0 20px;
    height: auto;
  }
  
  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  /* Modern, minimal logo */
  .logo-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .logo {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }
  
  .logo-icon {
    font-size: 20px;
    position: relative;
    z-index: 2;
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
  }
  
  .logo-text h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #4f46e5;
    line-height: 1.2;
  }
  
  .logo-subtitle {
    font-size: 12px;
    color: #6b7280;
  }
  
  /* Clean navigation */
  .main-nav {
    display: none;
  }
  
  @media (min-width: 768px) {
    .main-nav {
      display: block;
    }
  }
  
  .main-nav ul {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 24px;
  }
  
  .main-nav a {
    color: #4b5563;
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    padding: 8px 0;
    position: relative;
    transition: color 0.2s ease;
  }
  
  .main-nav a:hover {
    color: #4f46e5;
  }
  
  .main-nav a.active {
    color: #4f46e5;
  }
  
  .main-nav a.active::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #4f46e5;
    border-radius: 2px;
  }
  
  /* Minimal, sleek mobile menu toggle */
  .mobile-menu-toggle {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    z-index: 1001;
  }
  
  @media (min-width: 768px) {
    .mobile-menu-toggle {
      display: none;
    }
  }
  
  .mobile-menu-toggle span {
    display: block;
    width: 24px;
    height: 2px;
    background-color: #4f46e5;
    border-radius: 2px;
    transition: all 0.3s ease;
  }
  
  /* Mobile menu */
  .mobile-menu {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    background: white;
    z-index: 900;
    padding: 16px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  }
  
  .mobile-menu ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  
  .mobile-menu li {
    margin-bottom: 8px;
  }
  
  .mobile-menu a {
    display: block;
    padding: 12px 16px;
    color: #4b5563;
    text-decoration: none;
    font-weight: 500;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .mobile-menu a:hover, .mobile-menu a.active {
    background-color: #f3f4f6;
    color: #4f46e5;
  }
  
  /* Section intro */
  .section-intro {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .section-intro h3 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px;
    color: #111827;
  }
  
  .section-intro p {
    font-size: 16px;
    color: #6b7280;
    margin: 0;
  }
  
  /* Method cards - modern, flat design */
  .scan-method-selector {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .method-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 40px;
  }
  
  @media (min-width: 768px) {
    .method-cards {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  .method-card {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: 24px;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    height: 100%;
    border: 1px solid #f3f4f6;
  }
  
  .method-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
    border-color: rgba(99, 102, 241, 0.2);
  }
  
  .method-card-icon {
    width: 56px;
    height: 56px;
    background-color: #f5f3ff;
    color: #6366f1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    margin-bottom: 20px;
  }
  
  .method-card h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }
  
  .method-card-description {
    margin: 0 0 24px 0;
    color: #6b7280;
    font-size: 14px;
  }
  
  .method-button {
    background-color: #6366f1;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-block;
    text-align: center;
    margin-top: auto;
  }
  
  .method-button:hover {
    background-color: #4f46e5;
  }
  
  /* Workflow progress - minimal clean design */
  .workflow-progress {
    display: flex;
    justify-content: center;
    margin: 1rem 0 1.5rem;
    position: relative;
    background-color: rgba(255, 255, 255, 1);
    padding: 10px 0;
    z-index: 10;
  }
  
  .progress-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 600px;
    width: 100%;
    position: relative;
  }
  
  .progress-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 2;
    padding: 0 5px;
  }
  
  .step-icon {
    background-color: #e5e7eb;
    color: #6b7280;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 12px;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .progress-step.active .step-icon {
    background-color: #3b82f6;
    color: white;
  }
  
  .progress-step.complete .step-icon {
    background-color: #3b82f6;
    color: white;
  }
  
  .step-label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    margin-top: 6px;
    text-align: center;
  }
  
  .progress-step.active .step-label {
    color: #111827;
    font-weight: 600;
  }
  
  .progress-line {
    flex: 1;
    height: 2px;
    background-color: #e5e7eb;
    margin: 0 10px;
    position: relative;
    top: -12px;
    z-index: 1;
    transition: background-color 0.3s ease;
  }
  
  .progress-line.active {
    background-color: #3b82f6;
  }

  /* Modern buttons */
  .btn {
    font-size: 15px;
    font-weight: 500;
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
  }
  
  .btn-primary {
    background-color: #6366f1;
    color: white;
  }
  
  .btn-primary:hover {
    background-color: #4f46e5;
  }
  
  .btn-secondary {
    background-color: #f3f4f6;
    color: #4b5563;
  }
  
  .btn-secondary:hover {
    background-color: #e5e7eb;
    color: #1f2937;
  }

  /* Upload section */
  .upload-container, .camera-container {
    background-color: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    margin-bottom: 24px;
    margin-top: 40px;
  }
  
  .upload-header, .camera-header {
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .upload-title, .camera-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #111827;
  }
  
  .upload-content, .camera-content {
    padding: 20px;
  }
  
  .dropzone {
    border: 2px dashed #e5e7eb;
    border-radius: 12px;
    padding: 50px 16px;
    text-align: center;
    background-color: #f9fafb;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 20px;
    position: relative;
    z-index: 5;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.03);
  }
  
  .dropzone:hover, .dropzone.dragover {
    border-color: #6366f1;
    background-color: #f5f3ff;
  }
  
  .dropzone-icon {
    font-size: 40px;
    color: #9ca3af;
    margin-bottom: 16px;
  }
  
  .dropzone:hover .dropzone-icon {
    color: #6366f1;
  }
  
  .dropzone-text {
    font-size: 16px;
    font-weight: 500;
    color: #6b7280;
  }
  
  .dropzone-subtext {
    font-size: 14px;
    color: #9ca3af;
    margin-top: 8px;
  }
  
  /* Camera UI */
  .camera-preview {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    background-color: #f3f4f6;
  }
  
  .camera-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .camera-controls {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }
  
  .camera-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
    color: #ef4444;
  }
  
  .camera-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
  }
  
  .camera-tabs {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .tab-button {
    background-color: #f3f4f6;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
    text-align: center;
  }
  
  .tab-button.active {
    background-color: #6366f1;
    color: white;
  }
  
  .tab-icon {
    margin-right: 8px;
  }
  
  .live-scan-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  /* Results display */
  .result-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    margin-bottom: 24px;
    margin-top: 30px;
  }
  
  .result-header {
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .result-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #111827;
  }
  
  .result-content {
    padding: 20px;
  }
  
  .result-panels {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin: 20px 0;
  }
  
  @media (min-width: 640px) {
    .result-panels {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (min-width: 768px) {
    .result-panels {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  .result-panel {
    background-color: #f9fafb;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .result-icon {
    font-size: 24px;
    margin-bottom: 12px;
    color: #6366f1;
  }
  
  .result-panel h3 {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    margin: 0 0 8px;
  }
  
  .result-value {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }
  
  .speak-panel {
    background-color: #f5f3ff;
    border: 1px solid #e0d7ff;
  }
  
  .speak-panel .result-icon {
    color: #6366f1;
  }
  
  .speak-panel .result-value {
    display: flex;
    justify-content: center;
    margin-top: 8px;
  }
  
  /* Loading indicator */
  .processing-indicator {
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
  }
  
  .processing-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    max-width: 320px;
    width: 90%;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .processing-text {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background-color: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 12px;
  }
  
  .progress-bar-inner {
    height: 100%;
    background-color: #6366f1;
    border-radius: 4px;
    transition: width 0.3s ease-in-out;
  }

  /* Image controls and display */
  .scanned-image-container {
    margin-bottom: 24px;
  }
  
  .image-controls {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .image-control-btn {
    background-color: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .image-control-btn:hover {
    background-color: #e5e7eb;
    color: #1f2937;
  }
  
  .image-wrapper {
    position: relative;
    width: 100%;
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background-color: #f3f4f6;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  
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
  
  .scanned-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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
  
  /* Currency details */
  .currency-details {
    background-color: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: 20px;
    margin-top: 24px;
  }
  
  .details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }
  
  .details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  @media (min-width: 640px) {
    .details-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .detail-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    background-color: #f9fafb;
    border-radius: 12px;
  }
  
  .detail-icon {
    font-size: 24px;
    color: #6366f1;
  }
  
  .detail-content {
    flex: 1;
  }
  
  .detail-content h4 {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    margin: 0 0 4px;
  }
  
  .detail-content p {
    font-size: 16px;
    font-weight: 500;
    color: #111827;
    margin: 0;
  }
  
  /* Exchange rate selector styles */
  .exchange-rate-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .currency-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
  }
  
  .currency-selector label {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
  }
  
  .currency-select {
    background-color: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
    padding-right: 32px;
    cursor: pointer;
  }
  
  .currency-select:hover {
    border-color: #d1d5db;
  }
  
  .currency-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }
  
  .currency-select option:disabled {
    color: #9ca3af;
    font-style: italic;
  }
  
  .conversion-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  
  .conversion-from {
    font-size: 14px;
    font-weight: 600;
    color: #4b5563;
    margin: 0;
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 6px;
  }
  
  .conversion-arrow {
    color: #6366f1;
    font-weight: bold;
  }
  
  /* Action bar */
  .action-bar {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin: 24px 0;
  }
  
  .action-buttons {
    display: flex;
    gap: 12px;
  }
  
  .action-button {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-button:hover {
    background-color: #f9fafb;
    border-color: #d1d5db;
    color: #111827;
  }
  
  .action-icon {
    font-size: 18px;
  }
  
  /* Card footer */
  .card-footer {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
    padding: 0 20px 20px;
  }
</style>
  