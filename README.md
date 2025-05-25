
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env` file in the project root (Vite will automatically load it). Add your Gemini API key to this file:
   \`\`\`env
   GEMINI_API_KEY=your_gemini_api_key
   \`\`\`
   Replace \`your_gemini_api_key\` with your actual API key.
3. Run the app:
   `npm run dev`

The application will then use the Gemini API for AI-powered analysis features.
