
// FIX: Import GoogleGenAI and GenerateContentResponse from "@google/genai"
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
// FIX: Import GEMINI_TEXT_MODEL from constants
import { GEMINI_TEXT_MODEL } from '../constants';

// FIX: Initialize GoogleGenAI with named apiKey parameter using process.env.API_KEY
// As per guidelines, assume process.env.API_KEY is pre-configured and valid.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates text content using the Gemini API.
 * @param prompt The text prompt for content generation.
 * @returns The generated text as a string, or undefined if an error occurs.
 */
export async function generateText(prompt: string): Promise<string | undefined> {
  try {
    // FIX: Use ai.models.generateContent directly, specifying the model and contents.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL, // Use the recommended model for general text tasks
      contents: prompt,
    });

    // FIX: Access the generated text directly from response.text
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for text generation:", error);
    // Further error handling can be implemented here, e.g., checking error type
    // For now, return undefined or re-throw a custom error.
    return undefined;
  }
}

/**
 * Generates content using the Gemini API with multiple parts (e.g., text and image).
 * @param promptString The text part of the prompt.
 * @param base64ImageData The base64 encoded string of the image data.
 * @param imageMimeType The IANA standard MIME type of the image (e.g., 'image/png').
 * @returns The generated text as a string, or undefined if an error occurs.
 */
export async function generateTextWithImage(
  promptString: string,
  base64ImageData: string,
  imageMimeType: string
): Promise<string | undefined> {
  try {
    const imagePart = {
      inlineData: {
        mimeType: imageMimeType,
        data: base64ImageData,
      },
    };
    const textPart = {
      text: promptString,
    };

    // FIX: Use ai.models.generateContent for multi-part content
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL, // Ensure this model supports multimodal input
      contents: { parts: [imagePart, textPart] },
    });

    // FIX: Access the generated text directly from response.text
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for multi-part content generation:", error);
    return undefined;
  }
}

/**
 * Generates images using the Imagen API via Gemini SDK.
 * @param prompt The text prompt for image generation.
 * @param numberOfImages The number of images to generate.
 * @returns An array of base64 encoded image strings, or undefined if an error occurs.
 */
export async function generateImagesFromPrompt(
  prompt: string,
  numberOfImages: number = 1
): Promise<string[] | undefined> {
  try {
    // FIX: Use ai.models.generateImages for image generation tasks
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002', // Use the recommended model for image generation
      prompt: prompt,
      config: { numberOfImages: numberOfImages, outputMimeType: 'image/png' }, // Defaulting to PNG
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages.map(img => img.image.imageBytes);
    }
    return [];
  } catch (error) {
    console.error("Error calling Imagen API for image generation:", error);
    return undefined;
  }
}

// Example of streaming content generation
/**
 * Generates text content in a streaming fashion using the Gemini API.
 * @param prompt The text prompt for content generation.
 * @returns An async iterable of GenerateContentResponse chunks.
 */
export async function generateTextStream(prompt: string) {
  // Returns an async iterable which can be consumed with `for await...of`
  // Each chunk will be of type GenerateContentResponse, and chunk.text can be used.
  try {
    // FIX: Use ai.models.generateContentStream for streaming
    const responseStream = await ai.models.generateContentStream({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    return responseStream;
  } catch (error) {
    console.error("Error calling Gemini API for streaming text generation:", error);
    throw error; // Re-throw or handle as appropriate
  }
}
