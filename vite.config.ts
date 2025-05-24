
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // const env = loadEnv(mode, '.', ''); // Load environment variables if needed for other purposes
    return {
      define: {
        // API_KEY is no longer defined here as Gemini API is removed
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
