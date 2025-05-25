
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
// FIX: Define __dirname in ES module scope as Vite config can be ESM
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        // FIX: Define environment variable for Gemini API Key
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        // Removed LocalAI specific environment variables
        // 'process.env.LOCALAI_API_BASE_URL': JSON.stringify(env.LOCALAI_API_BASE_URL),
        // 'process.env.LOCALAI_API_KEY': JSON.stringify(env.LOCALAI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});