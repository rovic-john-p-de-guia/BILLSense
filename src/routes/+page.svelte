<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import ExchangeRateWidget from '$lib/components/ExchangeRateWidget.svelte';
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

  // Simplify the camera setup to directly show what the camera is seeing
  async function setupCamera(): Promise<void> {
    try {
      // First check if the camera is already in use by another application
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      // Simple direct camera access, similar to your HTML example
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      if (cameraFeed) {
        cameraFeed.srcObject = stream;
        cameraFeed.play(); // Explicitly play the video
      } else {
        throw new Error("Camera feed element not found");
      }
    } catch (error) {
      console.error("Camera access error:", error);
      cameraError = true;
      cameraErrorMessage = "Could not access camera. Please ensure camera permissions are granted.";
      throw error;
    }
  }

  // Simplify toggleCamera to directly show the camera feed
  async function toggleCamera(): Promise<void> {
    if (showCamera) {
      // Turn off camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      showCamera = false;
    } else {
      // Turn on camera - set showCamera first so the video element is in the DOM
      showCamera = true;
      
      // Wait for UI to update and video element to be available
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        // Simple direct camera setup without all the extra processing state
        await setupCamera();
      } catch (error) {
        console.error("Error accessing camera:", error);
        cameraError = true;
      }
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
      // Turn on live scanning - only when explicitly requested
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

  // Make sure the camera feed is properly displayed
  function startCameraPreview(): void {
    if (showCamera) return;
    
    showCamera = true;
    cameraError = false;
    cameraErrorMessage = "";
    
    // Use setTimeout to allow the DOM to update before accessing the camera
    setTimeout(async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (cameraFeed) {
          cameraFeed.srcObject = stream;
        } else {
          cameraError = true;
          cameraErrorMessage = "Camera feed element not found";
        }
      } catch (error) {
        console.error("Camera access error:", error);
        cameraError = true;
        
        if (error instanceof Error) {
          cameraErrorMessage = "Camera error: " + error.message;
        } else {
          cameraErrorMessage = "Failed to access camera";
        }
      }
      }, 100);
  }

  // Updated capture image function
  async function captureImage(): Promise<void> {
    if (!cameraFeed || !canvas) return;
    
    // Prevent multiple processing
    if (processing) return;
    
      processing = true;
      startProcessingAnimation();
    
    try {
      // Setup canvas with video dimensions
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error("Could not get canvas context");
      }
      
      canvas.width = cameraFeed.videoWidth;
      canvas.height = cameraFeed.videoHeight;
      
      // Capture current video frame
      context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
      
      // Convert to image data
      const imageData = canvas.toDataURL('image/png');
      currentImage = imageData;
      
      // Turn off camera after capture
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      
      showCamera = false;
      
      // Process the captured image
      await processImage(imageData);
    } catch (error) {
      console.error("Error capturing image:", error);
      if (error instanceof Error) {
        extractedText = "Error capturing: " + error.message;
      } else {
        extractedText = "Error capturing image";
      }
    } finally {
      resetProcessingState();
    }
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
        // Remove automatic live scan mode activation - let user choose explicitly
        // By default, use photo mode not live mode
        cameraMode = 'photo';
        liveScanMode = false;
      }, 100);
    }
  }
  
  function setCameraMode(mode: string): void {
    cameraMode = mode;
    
    // If switching to live mode, DON'T automatically start live scanning
    // Let the user press a specific button to start scanning
    if (mode === 'live' && showCamera && stream) {
      // Don't auto-start: toggleLiveScan();
      // Instead, just prepare for live mode but wait for user to press scan
      liveScanMode = false;
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

  // Add variables to distinguish between coins and bills
  let isCoin = false;
  let coinMatchDetails = "";
  // Add a variable to track whether to show extracted text
  let showExtractedText = false;

  // Function to toggle visibility of extracted text
  function toggleExtractedText(): void {
    showExtractedText = !showExtractedText;
  }
  
  // Update processImage function to better detect coins
  async function processImage(imageSrc: string): Promise<void> {
    try {
      extractedText = "Processing...";
      processing = true;
      startProcessingAnimation();
      isCoin = false; // Reset coin detection
      
      if (!puterLoaded) {
        extractedText = "Puter.js is not loaded yet";
        resetProcessingState();
        return;
      }
      
      const puter = (window as any).puter;
      if (!puter || !puter.ai || !puter.ai.img2txt) {
        extractedText = "Puter.js API is not available";
        resetProcessingState();
        return;
      }
      
      // First check if the image is likely a coin
      const isCircular = await isCircularImage(imageSrc);
      
      if (isCircular) {
        // It looks like a coin
        isCoin = true;
        
        // Specific prompt for Philippine peso coins
        const coinPrompt = "This is a Philippine peso coin. Look carefully for the denomination (1, 5, 10 pesos) and text like 'REPUBLIKA NG PILIPINAS', 'PISO', year numbers, and portraits of Filipino heroes like Bonifacio or Rizal.";
        
        const result = await puter.ai.img2txt(imageSrc, { prompt: coinPrompt });
        console.log("Extracted text from coin:", result);
        extractedText = result || "No text found";
        
        // Enhanced coin detection
        const coinInfo = detectCoinFromText(extractedText);
        currencyValue = coinInfo.currency;
        billAmount = coinInfo.amount; // We'll still use billAmount but update the display label
        
        // Add details about the coin with enhanced information for all types
        if (isCoin && billAmount !== "Unknown") {
          // Check if it's a New Generation Currency coin (2018 onwards)
          const isNGC = extractedText.match(/NEW GENERATION CURRENCY|NGC|BSP LOGO|NEW GENERATION/i);
          const yearMatch = extractedText.match(/\b(19\d\d|20\d\d)\b/);
          const year = yearMatch ? yearMatch[1] : "";
          
          if (billAmount === "10") {
            if (isNGC) {
              coinMatchDetails = "New Generation Currency 10 peso coin featuring the Mangkono tree (2018 onwards)";
            } else if (extractedText.match(/BONIFACIO|ANDRES|MABINI|APOLINARIO/i)) {
              coinMatchDetails = `Old series 10 peso coin featuring Andres Bonifacio and Apolinario Mabini${year ? ` (${year})` : ""}`;
            } else {
              coinMatchDetails = `10 peso Philippine coin${year ? ` (${year})` : ""}`;
            }
          } else if (billAmount === "5") {
            if (isNGC) {
              coinMatchDetails = "New Generation Currency 5 peso coin featuring the Tayabak plant (2018 onwards)";
            } else if (extractedText.match(/AQUINO|MELCHORA|TANDANG SORA/i)) {
              coinMatchDetails = `5 peso coin with Melchora Aquino (Tandang Sora)${year ? ` (${year})` : ""}`;
            } else if (extractedText.match(/AGUINALDO|EMILIO/i)) {
              coinMatchDetails = `5 peso coin featuring Emilio Aguinaldo${year ? ` (${year})` : ""}`;
            } else {
              coinMatchDetails = `5 peso Philippine coin${year ? ` (${year})` : ""}`;
            }
          } else if (billAmount === "1") {
            if (isNGC) {
              coinMatchDetails = "New Generation Currency 1 peso coin featuring the Sampaguita flower (2018 onwards)";
            } else if (extractedText.match(/RIZAL|JOSE/i)) {
              coinMatchDetails = `1 peso coin featuring Jose Rizal${year ? ` (${year})` : ""}`;
            } else {
              coinMatchDetails = `1 peso Philippine coin${year ? ` (${year})` : ""}`;
            }
          } else if (billAmount === "20") {
            if (isNGC) {
              coinMatchDetails = "New Generation Currency 20 peso coin featuring the Mindanao Tree/Kalaw (2019 onwards)";
            } else {
              coinMatchDetails = `20 peso Philippine coin${year ? ` (${year})` : ""}`;
            }
          } else if (billAmount === "0.25") {
            coinMatchDetails = `25 centavo/sentimo coin${year ? ` (${year})` : ""}`;
          } else if (billAmount === "0.10") {
            coinMatchDetails = `10 centavo/sentimo coin${year ? ` (${year})` : ""}`;
          } else if (billAmount === "0.05") {
            coinMatchDetails = `5 centavo/sentimo coin${year ? ` (${year})` : ""}`;
          } else if (billAmount === "0.01") {
            coinMatchDetails = `1 centavo/sentimo coin${year ? ` (${year})` : ""}`;
          } else {
            coinMatchDetails = `${billAmount} peso Philippine coin${year ? ` (${year})` : ""}`;
          }
        } else {
          coinMatchDetails = "";
        }
      } else {
        // Probably a bill - use standard detection
        const options = {
          prompt: "This is a Philippine currency bill. Identify all text including 'BANGKO SENTRAL NG PILIPINAS' and denomination indicators."
        };
        
        const result = await puter.ai.img2txt(imageSrc, options);
        console.log("Extracted text from image:", result);
        extractedText = result || "No text found";
        
        // Use your existing currency detection
        detectCurrencyAndAmount(extractedText);
      }
    } catch (error) {
      if (error instanceof Error) {
        extractedText = "Error: " + error.message;
      } else {
        extractedText = "Unknown error occurred";
      }
    } finally {
      resetProcessingState();
    }
  }

  // Enhanced function specifically for coin detection
  function detectCoinFromText(text: string): { currency: string, amount: string } {
    let currency = "Unknown";
    let amount = "Unknown";
    
    console.log("Coin detection: analyzing text:", text);
    
    // Normalize text for easier pattern matching - remove excess spaces
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    
    // Check for Philippine Peso indicators first (most important)
    if (normalizedText.match(/PILIPINAS|PISO|REPUBLIKA NG|BANGKO SENTRAL|PHILIPPINES|PHILIPPINE|CENTRAL BANK/i)) {
      currency = "PHP (Philippine Peso)";
      console.log("Detected Philippine Peso currency from text");
      
      // Check for specific year ranges that can indicate new vs old series
      const yearMatch = normalizedText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 0;
      const isNewSeries = year >= 2018;
      const isOldSeries = year > 0 && year < 2018;
      
      console.log(`Year detected: ${year}, New series: ${isNewSeries}, Old series: ${isOldSeries}`);
      
      // Detect specific denomination patterns, starting with the most explicit
      
      // Check for explicit denomination patterns with "PISO" or "PESO"
      if (normalizedText.match(/\b1\s*PISO\b|\bISANG\s*PISO\b|\bONE\s*PESO\b|\b1\s*PESO\b/i)) {
        amount = "1";
        console.log("Detected 1 peso coin from explicit denomination");
      } else if (normalizedText.match(/\b5\s*PISO\b|\bLIMANG\s*PISO\b|\bFIVE\s*PESO\b|\b5\s*PESO\b/i)) {
        amount = "5";
        console.log("Detected 5 peso coin from explicit denomination");
      } else if (normalizedText.match(/\b10\s*PISO\b|\bSAMPUNG\s*PISO\b|\bTEN\s*PESO\b|\b10\s*PESO\b/i)) {
        amount = "10";
        console.log("Detected 10 peso coin from explicit denomination");
      } else if (normalizedText.match(/\b20\s*PISO\b|\bDALAWAMPUNG\s*PISO\b|\bTWENTY\s*PESO\b|\b20\s*PESO\b/i)) {
        amount = "20";
        console.log("Detected 20 peso coin from explicit denomination");
      }
      
      // If denomination wasn't found explicitly, check for numeric values that might indicate the denomination
      if (amount === "Unknown") {
        // New regex patterns to find isolated numbers that likely represent denomination
        const denominationMatch = normalizedText.match(/\b(1|5|10|20)\b/);
        if (denominationMatch) {
          amount = denominationMatch[1];
          console.log(`Found likely denomination from numeric value: ${amount}`);
        }
      }
      
      // If still unknown, check for historical figures that appear on specific coins
      if (amount === "Unknown" || (isOldSeries && amount !== "Unknown")) {
        // For old series coins
        if (normalizedText.match(/BONIFACIO|ANDRES B|A\.B\.|MABINI|APOLINARIO/i)) {
          amount = "10"; // Bonifacio and Mabini appear on 10 peso coins
          console.log("Detected 10 peso coin from Bonifacio/Mabini reference");
        } else if (normalizedText.match(/AGUINALDO|EMILIO/i)) {
          amount = "5"; // Aguinaldo appears on 5 peso coins
          console.log("Detected 5 peso coin from Aguinaldo reference");
        } else if (normalizedText.match(/RIZAL|JOSE P|J\.P\./i)) {
          amount = "1"; // Rizal appears on 1 peso coins
          console.log("Detected 1 peso coin from Rizal reference");
        } else if (normalizedText.match(/MELCHORA AQUINO|TANDANG SORA/i)) {
          amount = "5"; // Tandang Sora on newer 5 peso coins
          console.log("Detected 5 peso coin from Tandang Sora reference");
        }
      }
      
      // For newer series coins (2018 onwards) - check for distinctive features
      if ((amount === "Unknown" || isNewSeries) && normalizedText.match(/NEW GENERATION CURRENCY|NGC|BSP LOGO|NEW GENERATION/i)) {
        // Look for specific features of new generation coins
        if (normalizedText.match(/MAKA-DIYOS|MAKAKALIKASAN/i)) {
          // These are common words across new generation currency
          // Now try to determine the specific denomination
          
          if (normalizedText.match(/MALVAROSA|WALING-WALING/i)) {
            amount = "5"; // New 5-peso has flower imagery
            console.log("Detected new series 5 peso coin from flower references");
          } else if (normalizedText.match(/SAMPAGUITA|NATIONAL FLOWER/i)) {
            amount = "1"; // New 1-peso has sampaguita
            console.log("Detected new series 1 peso coin from sampaguita reference");
          } else if (normalizedText.match(/MANGKONO|IRON WOOD/i)) {
            amount = "10"; // New 10-peso has mangkono tree
            console.log("Detected new series 10 peso coin from mangkono reference");
          } else if (normalizedText.match(/MINDANAO TREE|KALAW/i)) {
            amount = "20"; // New 20-peso has Mindanao tree/kalaw
            console.log("Detected new series 20 peso coin from Mindanao tree reference");
          }
        }
      }
      
      // Check for specific year models that can help determine denomination
      if (amount === "Unknown") {
        if (year === 2001 || year === 2002) {
          // These years were common for 10 peso coins with Bonifacio & Mabini
          amount = "10";
          console.log("Detected likely 10 peso coin from 2001-2002 year");
        } else if (year >= 1995 && year <= 2000) {
          // This range often had 1 peso coins with Rizal
          amount = "1";
          console.log(`Detected likely 1 peso coin from ${year} year`);
        }
      }
      
      // Check for sentimos (fractional values)
      if (amount === "Unknown" && normalizedText.match(/SENTIMO|SENTIMOS/i)) {
        if (normalizedText.match(/25\s*SENTIMO/i) || normalizedText.match(/\b25\b/)) {
          amount = "0.25";
          console.log("Detected 25 sentimos coin");
        } else if (normalizedText.match(/10\s*SENTIMO/i) || normalizedText.match(/\b10\b/)) {
          amount = "0.10";
          console.log("Detected 10 sentimos coin");
        } else if (normalizedText.match(/5\s*SENTIMO/i) || normalizedText.match(/\b5\b/)) {
          amount = "0.05";
          console.log("Detected 5 sentimos coin");
        } else if (normalizedText.match(/1\s*SENTIMO/i) || normalizedText.match(/\b1\b/)) {
          amount = "0.01";
          console.log("Detected 1 sentimo coin");
        }
      }
      
      // If we still can't determine but have a Philippine coin, make a best guess based on visual features
      if (currency === "PHP (Philippine Peso)" && amount === "Unknown") {
        console.log("Making best guess based on detected features...");
        
        // Check for the number 10 anywhere in the text as a last resort
        if (normalizedText.match(/\b10\b/)) {
          amount = "10";
          console.log("Detected 10 pesos as fallback from standalone number 10");
        } 
        // Similar fallbacks for other denominations
        else if (normalizedText.match(/\b5\b/)) {
          amount = "5";
          console.log("Detected 5 pesos as fallback from standalone number 5");
        }
        else if (normalizedText.match(/\b1\b/)) {
          amount = "1";
          console.log("Detected 1 peso as fallback from standalone number 1");
        }
        else if (normalizedText.match(/\b20\b/)) {
          amount = "20";
          console.log("Detected 20 pesos as fallback from standalone number 20");
        }
      }
    }
    
    console.log(`Final coin detection - Currency: ${currency}, Amount: ${amount}`);
    return { currency, amount };
  }

  // Simple function to check if image is circular (likely a coin)
  async function isCircularImage(imageSrc: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // If image is roughly square (aspect ratio close to 1), it might be a coin
        const aspectRatio = img.width / img.height;
        resolve(aspectRatio >= 0.9 && aspectRatio <= 1.1);
      };
      img.onerror = () => resolve(false);
      img.src = imageSrc;
    });
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

  // Add a variable to track camera inversion state
  let invertCamera: boolean = true; // Set to true by default for front-facing cameras

  // Add a function to toggle camera inversion
  function toggleCameraInversion(): void {
    invertCamera = !invertCamera;
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
              <button class="btn btn-primary start-camera-btn" on:click={startCameraPreview}>
                <i class="fas fa-camera"></i> Start Camera Preview
              </button>
            {:else if cameraError}
              <div class="camera-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>{cameraErrorMessage}</p>
                <button class="btn btn-primary" on:click={startCameraPreview}>Try Again</button>
              </div>
            {:else}
              <div class="camera-preview-container">
                <video 
                  bind:this={cameraFeed} 
                  autoplay 
                  playsinline 
                  muted 
                  class="camera-feed"
                ></video>
                
                <!-- Simple guideline overlay -->
                <div class="camera-guidelines">
                  <div class="guideline-frame"></div>
                  <div class="guideline-text">Center bill here</div>
                </div>
                
                <button class="btn-capture" on:click={captureImage} disabled={processing}>
                  <div class="btn-capture-inner"></div>
                </button>
              </div>
              
              <div class="camera-hint">
                <p>Position currency bill in view and tap the circle to capture</p>
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
                  <circle cx="12" cy="12" r="8"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </button>
              <button class="image-control-btn" on:click={() => handleImageZoom(0.9)} title="Zoom out">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="8"></circle>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </button>
              <button class="image-control-btn" on:click={() => handleImageRotation(90)} title="Rotate image">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
              </button>
              <button class="image-control-btn" on:click={resetImageTransforms} title="Reset image">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </button>
              <button class="image-control-btn" on:click={toggleFullscreen} title="View fullscreen">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
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
              <div class="result-icon">{isCoin ? '🪙' : '💵'}</div>
              <h3>{isCoin ? 'Coin' : 'Bill'} Value</h3>
              <div class="result-value">{billAmount}</div>
              {#if isCoin && coinMatchDetails}
                <div class="coin-details">{coinMatchDetails}</div>
              {/if}
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
              
              <!-- Add specifications information -->
              {#if isCoin}
                <div class="detail-item">
                  <div class="detail-icon">📏</div>
                  <div class="detail-content">
                    <h4>Coin Specifications</h4>
                    <ul class="specs-list">
                      {#if billAmount === "1"}
                        <li><strong>Material:</strong> Nickel-plated steel (old) / Nickel-brass plated steel (NGC)</li>
                        <li><strong>Diameter:</strong> 24mm</li>
                        <li><strong>Weight:</strong> 6.10g</li>
                      {:else if billAmount === "5"}
                        <li><strong>Material:</strong> Nickel-plated steel (old) / Nickel-brass plated steel (NGC)</li>
                        <li><strong>Diameter:</strong> 27mm</li>
                        <li><strong>Weight:</strong> 7.70g</li>
                      {:else if billAmount === "10"}
                        <li><strong>Material:</strong> Bi-metallic: Nickel-brass ring, Nickel-plated center</li>
                        <li><strong>Diameter:</strong> 27mm</li>
                        <li><strong>Weight:</strong> 8.00g</li>
                      {:else if billAmount === "20"}
                        <li><strong>Material:</strong> Bi-metallic: Nickel-brass center, Nickel-plated ring</li>
                        <li><strong>Diameter:</strong> 30mm</li>
                        <li><strong>Weight:</strong> 11.50g</li>
                      {:else}
                        <li><strong>Material:</strong> Nickel-plated or brass-plated steel</li>
                        <li><strong>Size:</strong> Varies by denomination</li>
                      {/if}
                      {#if billAmount !== "Unknown" && billAmount !== "Not detected"}
                        <li><strong>Value:</strong> {billAmount} {billAmount === "1" ? "peso" : "pesos"}</li>
                      {/if}
                    </ul>
                  </div>
                </div>
              {:else}
                <div class="detail-item">
                  <div class="detail-icon">📃</div>
                  <div class="detail-content">
                    <h4>Bill Specifications</h4>
                    <ul class="specs-list">
                      {#if getCurrencyCode(currencyValue) === "PHP"}
                        <li><strong>Material:</strong> {billAmount === "1000" ? "Polymer (new series)" : "Cotton and abaca fibers"}</li>
                        <li><strong>Size:</strong> {billAmount === "20" || billAmount === "50" ? "130mm × 60mm" : 
                                                  billAmount === "100" || billAmount === "200" ? "146mm × 66mm" : 
                                                  billAmount === "500" || billAmount === "1000" ? "160mm × 66mm" : "Varies by denomination"}</li>
                        <li><strong>Series:</strong> New Generation Currency (NGC)</li>
                      {:else}
                        <li><strong>Material:</strong> Cotton-based paper or polymer</li>
                        <li><strong>Size:</strong> Varies by denomination</li>
                      {/if}
                      {#if billAmount !== "Unknown" && billAmount !== "Not detected"}
                        <li><strong>Value:</strong> {billAmount} {billAmount === "1" ? "unit" : "units"}</li>
                      {/if}
                    </ul>
                  </div>
                </div>
              {/if}
              
              <!-- Add visual identification tips -->
              <div class="detail-item">
                <div class="detail-icon">👁️</div>
                <div class="detail-content">
                  <h4>Visual Identification</h4>
                  {#if isCoin}
                    <ul class="specs-list">
                      {#if billAmount === "1"}
                        <li><strong>Observe:</strong> Jose Rizal portrait (old) or Sampaguita flower (NGC)</li>
                        <li><strong>Color:</strong> Silver/gray (old) or brass golden (NGC)</li>
                        <li><strong>Edge:</strong> Plain/smooth</li>
                      {:else if billAmount === "5"}
                        <li><strong>Observe:</strong> Emilio Aguinaldo or Tandang Sora (old) or Tayabak plant (NGC)</li>
                        <li><strong>Color:</strong> Silver/gray (old) or brass golden (NGC)</li>
                        <li><strong>Edge:</strong> Reeded/ridged</li>
                      {:else if billAmount === "10"}
                        <li><strong>Observe:</strong> Bonifacio & Mabini (old) or Mangkono tree (NGC)</li>
                        <li><strong>Color:</strong> Bi-color: golden ring, silver center</li>
                        <li><strong>Edge:</strong> Interrupted reeding</li>
                      {:else if billAmount === "20"}
                        <li><strong>Observe:</strong> Mabini (old) or Kalaw & Mindanao Tree (NGC)</li>
                        <li><strong>Color:</strong> Bi-color: silver ring, golden center</li>
                        <li><strong>Edge:</strong> Fine reeding</li>
                      {:else}
                        <li><strong>Look for:</strong> Denomination, BSP logo, and Filipino heroes</li>
                        <li><strong>Edge:</strong> Varies by denomination</li>
                      {/if}
                    </ul>
                  {:else}
                    <ul class="specs-list">
                      {#if getCurrencyCode(currencyValue) === "PHP"}
                        {#if billAmount === "20"}
                          <li><strong>Color:</strong> Orange</li>
                          <li><strong>Features:</strong> Manuel L. Quezon, Malacañang Palace</li>
                        {:else if billAmount === "50"}
                          <li><strong>Color:</strong> Red</li>
                          <li><strong>Features:</strong> Sergio Osmeña, National Museum</li>
                        {:else if billAmount === "100"}
                          <li><strong>Color:</strong> Purple</li>
                          <li><strong>Features:</strong> Manuel Roxas, Central Bank Building</li>
                        {:else if billAmount === "200"}
                          <li><strong>Color:</strong> Green</li>
                          <li><strong>Features:</strong> Diosdado Macapagal, PICC</li>
                        {:else if billAmount === "500"}
                          <li><strong>Color:</strong> Yellow</li>
                          <li><strong>Features:</strong> Benigno & Corazon Aquino, UPIS</li>
                        {:else if billAmount === "1000"}
                          <li><strong>Color:</strong> Blue</li>
                          <li><strong>Features:</strong> Jose Abad Santos, Vicente Lim, Josefa Escoda</li>
                        {:else}
                          <li><strong>Look for:</strong> Distinct colors for each denomination</li>
                          <li><strong>Features:</strong> Filipino heroes and landmarks</li>
                        {/if}
                      {:else}
                        <li><strong>Look for:</strong> Distinct colors and design elements</li>
                        <li><strong>Features:</strong> Varies by country and denomination</li>
                      {/if}
                    </ul>
                  {/if}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Add extracted text section -->
          <div class="extracted-text-section">
            <div class="extracted-text-header">
              <h3>Advanced Details</h3>
              <button 
                class="toggle-extracted-text" 
                on:click={toggleExtractedText}
                aria-label={showExtractedText ? "Hide extracted text" : "Show extracted text"}
                title={showExtractedText ? "Hide extracted text" : "Show extracted text"}
              >
                <span class="toggle-icon">{showExtractedText ? '−' : '+'}</span>
                {showExtractedText ? 'Hide extracted text' : 'Show extracted text'}
              </button>
            </div>
            
            {#if showExtractedText}
              <div class="extracted-text-content" transition:slide={{ duration: 200 }}>
                <div class="extracted-text-box">
                  <h4>Extracted Text</h4>
                  <p class="extracted-text-description">
                    This is the raw text extracted from the image using AI-powered text recognition:
                  </p>
                  <pre class="extracted-text-display">{extractedText}</pre>
                </div>
                
                <div class="detection-logic">
                  <h4>Detection Logic</h4>
                  <p>How the system identified this {isCoin ? 'coin' : 'bill'}:</p>
                  <ul class="detection-steps">
                    <li>
                      <strong>Currency:</strong> {currencyValue}
                      {#if currencyValue !== "Unknown"}
                        <span class="detection-confidence high">High confidence</span>
                      {:else}
                        <span class="detection-confidence low">Low confidence</span>
                      {/if}
                    </li>
                    <li>
                      <strong>Amount:</strong> {billAmount}
                      {#if billAmount !== "Unknown" && billAmount !== "Not detected"}
                        <span class="detection-confidence high">High confidence</span>
                      {:else}
                        <span class="detection-confidence low">Low confidence</span>
                      {/if}
                    </li>
                    {#if isCoin && coinMatchDetails}
                      <li>
                        <strong>Coin Type:</strong> {coinMatchDetails}
                      </li>
                    {/if}
                    {#if isCoin}
                      <li>
                        <strong>Format:</strong> Detected as a coin based on circular image shape
                      </li>
                    {/if}
                  </ul>
                </div>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="card-footer">
          <button class="btn btn-secondary" on:click={resetScan} title="Return to home screen">
            <span class="btn-icon">🏠</span> Back to Home
          </button>
          
          <button class="btn btn-primary" on:click={() => {
            // Open file upload dialog
            const fileInput = document.getElementById('globalFileInput') as HTMLInputElement;
            if (fileInput) {
              currentImage = null;
              currencyValue = "Unknown";
              billAmount = "Unknown";
              extractedText = "No text detected";
              fileInput.click();
            }
          }} title="Upload another bill image">
            <span class="btn-icon">📤</span> Upload Another Bill
          </button>
          
          <button class="btn btn-primary" on:click={() => {
            currentImage = null;
            currencyValue = "Unknown";
            billAmount = "Unknown";
            extractedText = "No text detected";
            selectMethod('camera');
          }} title="Scan another bill using camera">
            <span class="btn-icon">📷</span> Scan Another Bill
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
    margin-bottom: 16px;
  }
  
  .camera-feed {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block; /* Make sure it's displayed */
    transform:  scaleX(-1);
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
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 24px;
    padding: 0 20px 20px;
  }
  
  @media (max-width: 640px) {
    .card-footer {
      flex-direction: column;
    }
    
    .card-footer .btn {
      width: 100%;
    }
  }
  
  .btn-icon {
    margin-right: 8px;
  }
  
  /* ... existing styles ... */
  
  .camera-preview-container {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 12px;
    overflow: hidden;
    background-color: #000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .camera-feed {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .btn-capture {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.2);
    border: 3px solid white;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .btn-capture-inner {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background-color: white;
  }
  
  .btn-capture:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }
  
  .btn-capture:active .btn-capture-inner {
    width: 50px;
    height: 50px;
  }
  
  .camera-hint {
    text-align: center;
    margin-top: 16px;
    color: #6b7280;
    font-size: 14px;
  }
  
  .start-camera-btn {
    margin: 32px auto;
    display: block;
    padding: 12px 24px;
    font-size: 16px;
  }
  
  /* Clean, simple guidelines */
  .camera-guidelines {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  
  .guideline-frame {
    width: 80%;
    height: 50%;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.2);
  }
  
  .guideline-text {
    position: absolute;
    bottom: 20%;
    color: white;
    font-size: 14px;
    font-weight: 500;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 4px 12px;
    border-radius: 16px;
  }
  
  /* ... existing styles ... */
  
  .camera-feed.inverted {
    transform: scaleX(-1); /* This flips the camera horizontally */
  }
  
  .camera-controls {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
  }
  
  .camera-control-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.4);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .camera-control-btn:hover {
    background-color: rgba(0, 0, 0, 0.6);
  }
  
  /* Add this to your existing styles */
  .coin-details {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
  
  /* Extracted text section styles */
  .extracted-text-section {
    background-color: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: 20px;
    margin-top: 24px;
  }
  
  .extracted-text-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .extracted-text-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }
  
  .toggle-extracted-text {
    background-color: #f3f4f6;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .toggle-extracted-text:hover {
    background-color: #e5e7eb;
    color: #1f2937;
  }
  
  .toggle-icon {
    font-size: 18px;
    font-weight: bold;
    display: inline-block;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
  }
  
  .extracted-text-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  @media (min-width: 768px) {
    .extracted-text-content {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  .extracted-text-box, .detection-logic {
    background-color: #f9fafb;
    border-radius: 12px;
    padding: 16px;
  }
  
  .extracted-text-box h4, .detection-logic h4 {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 12px;
  }
  
  .extracted-text-description {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 12px;
  }
  
  .extracted-text-display {
    background-color: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    color: #1f2937;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
  }
  
  .detection-steps {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  
  .detection-steps li {
    padding: 10px 0;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  
  .detection-steps li:last-child {
    border-bottom: none;
  }
  
  .detection-confidence {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    margin-left: auto;
  }
  
  .detection-confidence.high {
    background-color: #d1fae5;
    color: #065f46;
  }
  
  .detection-confidence.medium {
    background-color: #fef3c7;
    color: #92400e;
  }
  
  .detection-confidence.low {
    background-color: #fee2e2;
    color: #b91c1c;
  }
  
  /* Styles for specifications lists */
  .specs-list {
    list-style-type: none;
    padding: 0;
    margin: 8px 0 0 0;
    font-size: 14px;
  }
  
  .specs-list li {
    margin-bottom: 6px;
    line-height: 1.4;
    color: #4b5563;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .specs-list li:last-child {
    margin-bottom: 0;
  }
  
  .specs-list li strong {
    color: #374151;
    font-weight: 600;
    min-width: 70px;
  }
  
  /* Make the detail items more compact on mobile */
  @media (max-width: 768px) {
    .detail-item {
      padding: 12px;
    }
    
    .specs-list {
      font-size: 13px;
    }
  }
</style>
  
