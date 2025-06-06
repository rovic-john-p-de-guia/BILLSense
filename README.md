# Currency Recognition App

A Svelte application that allows users to scan and detect currency type and value from bills using OCR with Puter.js.

## Features

- **Camera Capture**: Use your device camera to take a picture of a bill for detection
- **Image Upload**: Upload an image of a bill from your device
- **OCR Processing**: Uses Puter.js OCR (puter.ai.img2txt) to extract text from the image
- **Currency Detection**: Analyzes the extracted text to determine currency type and value
- **Responsive UI**: Clean and user-friendly interface with Tailwind CSS

## Supported Currencies

The app can detect the following currencies:
- USD (US Dollar)
- PHP (Philippine Peso)
- EUR (Euro)
- GBP (British Pound)
- MXN (Mexican Peso)
- CAD (Canadian Dollar)
- JPY (Japanese Yen)
- INR (Indian Rupee)
- CNY (Chinese Yuan)
- KRW (South Korean Won)
- SGD (Singapore Dollar)
- AUD (Australian Dollar)

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and add your API keys
4. Run the development server with `npm run dev`
5. Open your browser to the URL shown in the terminal

## Environment Setup

The application uses environment variables to securely store API keys and other sensitive information. These are accessed through SvelteKit's `$env` module and never exposed to the client directly.

Required environment variables:
- `EXCHANGE_RATE_API_KEY`: API key for the Exchange Rate API
- `JWT_SECRET`: Secret key for JWT token generation (for future authentication)

## Usage

1. Allow camera access when prompted
2. Use the camera button to capture an image of a bill, or upload an image using the file input
3. Wait for the OCR processing to complete
4. View the detected currency type and value displayed on the screen

## Technologies Used

- SvelteKit
- Tailwind CSS
- Puter.js (for OCR processing)
- Web APIs (navigator.mediaDevices.getUserMedia, File API)

## License

MIT
