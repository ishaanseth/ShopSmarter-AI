
import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai";
import { GeminiAnalysisResponse, Product } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable is not set.");
  // In a real app, you might throw an error or have a fallback,
  // but per instructions, we assume it's available.
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" });

const sanitizeAndParseJson = <T,>(jsonString: string): T | null => {
  let saneJsonString = jsonString.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Matches ```json ... ``` or ``` ... ```
  const match = saneJsonString.match(fenceRegex);
  if (match && match[2]) {
    saneJsonString = match[2].trim(); // Use the content within the fences
  }

  // Regex 1: Remove lines that are entirely 'identifier: []' or 'identifier: {}' (potentially with surrounding whitespace or a trailing comma)
  saneJsonString = saneJsonString.replace(/^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*(\[\]|\{\})\s*,?\s*$/gm, '');

  // Regex 2: Remove unquoted junk text prepended to a quoted string on a line.
  saneJsonString = saneJsonString.replace(/^(\s*)([a-zA-Z][a-zA-Z0-9\s_.-]*[a-zA-Z0-9]|[a-zA-Z])\s+(")/gm, '$1$3');
  
  // Filter out lines that are likely plain text junk interspersed in the JSON
  saneJsonString = saneJsonString.split('\n').filter(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) return true; // Keep empty lines for now, master trim handles later
    
    // Keep lines that are clearly part of JSON structure or syntax
    if (/^[\{\}\[\],"]/.test(trimmedLine)) return true; // Starts with typical JSON structural char or quote
    if (/[\{\}\[\],]$/.test(trimmedLine)) return true;  // Ends with typical JSON structural char or comma
    if (trimmedLine.includes('":"') && trimmedLine.indexOf('"') < trimmedLine.lastIndexOf('"')) return true; // Contains "key":"value" like pattern

    // If the line contains alphabetic characters but didn't match above criteria, it's likely junk
    if (/[a-zA-Z]/.test(trimmedLine)) {
        // Further check: if it's just a number or boolean, it might be a valid JSON value on its own line (less common but possible)
        if (/^(true|false|-?\d+(\.\d+)?([eE][+-]?\d+)?)$/.test(trimmedLine)) {
            return true;
        }
        return false; // Discard as junk text
    }
    
    return true; // Keep other lines (e.g., lines with only numbers, or purely structural lines missed by above)
  }).join('\n');

  // After potentially removing lines, there might be multiple consecutive blank lines or leading/trailing newlines.
  saneJsonString = saneJsonString.replace(/\n\s*\n/g, '\n').trim();


  try {
    // Attempt to parse the cleaned string directly
    return JSON.parse(saneJsonString) as T;
  } catch (e) {
    // console.warn("Initial JSON.parse failed:", e, "Processed string:", saneJsonString, "Original raw string:", jsonString);
    
    if (saneJsonString.length === 0) {
      // console.error("String is empty after initial cleaning, cannot parse.");
      return null;
    }

    // Fallback: Try to find the first complete JSON object or array using brace/bracket counting
    let openCount = 0;
    let endIndex = -1;
    let inString = false;
    let escapeNextChar = false; 

    const firstChar = saneJsonString.trimStart()[0]; // Use trimStart to handle leading whitespace before first char
    const expectedOpen = firstChar === '{' ? '{' : firstChar === '[' ? '[' : null;
    const expectedClose = firstChar === '{' ? '}' : firstChar === '[' ? ']' : null;

    if (expectedOpen) { 
      for (let i = 0; i < saneJsonString.length; i++) {
        const char = saneJsonString[i];
        if (escapeNextChar) {
          escapeNextChar = false;
          continue;
        }
        if (char === '\\') {
          escapeNextChar = true;
          continue;
        }
        if (char === '"') {
          inString = !inString; 
        }

        if (!inString) { 
          if (char === expectedOpen) {
            openCount++;
          } else if (char === expectedClose) {
            openCount--;
          }
        }

        if (openCount === 0 && i >= 0) {
            // Check if we actually encountered an opening bracket/brace that initiated counting
            let initialStructuralCharFound = false;
            for(let j=0; j<=i; j++) {
                if(saneJsonString[j] === expectedOpen) {
                    initialStructuralCharFound = true;
                    break;
                }
                if(saneJsonString[j] !== ' ' && saneJsonString[j] !== '\n' && saneJsonString[j] !== '\r' && saneJsonString[j] !== '\t') {
                    // some other non-whitespace char before the first expectedOpen
                    break;
                }
            }

            if (initialStructuralCharFound) {
                 endIndex = i + 1; 
                 break;
            }
        }
      }

      if (endIndex !== -1) {
        const potentialJson = saneJsonString.substring(0, endIndex);
        try {
          // console.log("Attempting to parse extracted JSON from brace/bracket counting fallback:", potentialJson);
          return JSON.parse(potentialJson) as T;
        } catch (e2) {
          // console.error("Fallback JSON.parse (brace/bracket counting) failed:", e2, "Substring was:", potentialJson);
        }
      } else {
        // console.warn("Brace/bracket counting did not find a complete JSON structure. String might be malformed or severely truncated.");
      }
    }
    
    // console.error("Failed to parse JSON response after all fallbacks. Initial error:", (e as Error).message, "Last processed string:", saneJsonString, "Original raw string:", jsonString);
    return null;
  }
};


export const analyzeImageAndSuggestProducts = async (
  imageBase64: string,
  imageType: string,
  userPrompt?: string
): Promise<GeminiAnalysisResponse> => {
  try {
    const model = 'gemini-2.5-flash-preview-04-17'; 
    
    const imagePart: Part = {
      inlineData: {
        mimeType: imageType, 
        data: imageBase64,
      },
    };

    const textPrompt = `
      You are an AI Shopping Assistant. Analyze the provided image.
      1. Briefly describe the key visual features of the main item(s) in the image (e.g., category, style, color, texture, material, any discernible patterns or brand-like attributes). Limit this to 2-3 sentences.
      2. Based on this analysis ${userPrompt ? `and the user's specific request: "${userPrompt}"` : ''}, suggest 3-5 visually similar products and 2-3 complementary products that might be found on an e-commerce store.
      3. For each suggested product, provide:
          - A unique "id" (e.g., "sim1", "comp1").
          - A plausible "name".
          - A short "description" (1-2 sentences).
          - An estimated "price" (e.g., "$49.99").
          - A placeholder "imageUrl" using the format: https://picsum.photos/200/300?random=N (ensure N is a unique integer for each product, e.g., 1, 2, 3...).
          - A general "category" (e.g., "Apparel", "Home Decor", "Electronics", "Accessories").

      Return your response as a single, VALID JSON object with the following structure:
      {
        "analysis": "<Your description of image features>",
        "similarProducts": [
          { "id": "sim1", "name": "Classic Blue Denim Jacket", "description": "A timeless denim jacket perfect for casual wear.", "price": "$59.99", "imageUrl": "https://picsum.photos/200/300?random=1", "category": "Apparel" }
        ],
        "complementaryProducts": [
          { "id": "comp1", "name": "White Graphic Tee", "description": "Comfortable cotton tee to wear under the jacket.", "price": "$19.99", "imageUrl": "https://picsum.photos/200/300?random=101", "category": "Apparel" }
        ]
      }
      Ensure the JSON is perfectly valid and complete. All keys and string values must be in double quotes. Do NOT include any extraneous text, comments, or unquoted keys. Do not include markdown like \`\`\`json.
      If the image is unclear or not product-related, state that in the analysis and provide empty arrays for products.
      ${userPrompt ? `Focus on fulfilling the user's request: "${userPrompt}".` : ''}
    `;

    const contents = { parts: [imagePart, { text: textPrompt }] };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        responseMimeType: "application/json",
      }
    });

    const rawJson = response.text;
    // console.log("Raw response from Gemini:", rawJson); // For debugging
    const parsedData = sanitizeAndParseJson<GeminiAnalysisResponse>(rawJson);

    if (!parsedData) {
      console.error("sanitizeAndParseJson returned null. Raw response from Gemini was:", rawJson);
      throw new Error("Failed to parse Gemini response or response was empty.");
    }
    
    // Ensure arrays exist even if Gemini omits them for empty results
    parsedData.similarProducts = parsedData.similarProducts || [];
    parsedData.complementaryProducts = parsedData.complementaryProducts || [];
    
    return parsedData;

  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during image analysis.";
    // Return a structured error response that the UI can handle
    return {
      analysis: `Error during analysis: ${errorMessage}. Please try a different image or prompt.`,
      similarProducts: [],
      complementaryProducts: [],
    };
  }
};

export const startChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash-preview-04-17',
    config: {
      systemInstruction: `You are ShopSmarter, a friendly and helpful AI personal shopping assistant. 
      Your goal is to help users find products based on their uploaded images and subsequent requests. 
      Be concise and focus on product recommendations and style advice. 
      If the user asks for modifications or has new inputs, try to incorporate them into your suggestions.
      If asked for new products, try to provide them in a similar structure if possible (name, description, price, category, image), but prioritize a conversational answer.
      You can use placeholder image URLs like https://picsum.photos/200/300?random=N.
      Do not attempt to re-analyze the original image unless specifically asked or provided with a new one. Focus on the ongoing conversation and previous product suggestions.
      Always ensure your responses are directly usable and avoid meta-comments about your process unless specifically relevant to clarifying a user's query.`,
    },
  });
};

export const sendMessageInChat = async (chat: Chat, message: string): Promise<string> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message: message });
    return response.text;
  } catch (error) {
    console.error("Error sending message with Gemini Chat:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during chat.";
    return `I apologize, but I encountered an error: ${errorMessage}`;
  }
};
