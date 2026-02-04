// AWS Bedrock integration for intelligent recipe parsing using HTTP API
import 'react-native-get-random-values';

import Constants from 'expo-constants';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

// AWS Configuration from environment variables via app.config.js
const AWS_ACCESS_KEY_ID = Constants.expoConfig?.extra?.awsAccessKeyId || '';
const AWS_SECRET_ACCESS_KEY = Constants.expoConfig?.extra?.awsSecretAccessKey || '';
const AWS_REGION = Constants.expoConfig?.extra?.awsRegion || 'us-east-1';

export interface FormattedRecipe {
  name: string;
  description: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  cuisine: string;
  category: string;
  difficulty: string;
  tags: string[];
  dietaryInfo: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
  };
}

export interface FormatResult {
  success: boolean;
  recipe: FormattedRecipe | null;
  error?: string;
}

// The prompt template for recipe extraction
const RECIPE_EXTRACTION_PROMPT = `You are a recipe parser. Extract structured recipe data from the following OCR text.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just the JSON):
{
  "name": "Recipe Name",
  "description": "Brief 1-2 sentence description of the dish",
  "ingredients": [
    { "name": "ingredient name", "amount": "1", "unit": "cup" }
  ],
  "instructions": [
    "Step 1 instruction text",
    "Step 2 instruction text"
  ],
  "prepTime": "15",
  "cookTime": "30",
  "servings": "4",
  "cuisine": "Italian",
  "category": "dinner",
  "difficulty": "medium",
  "tags": ["pasta", "quick", "vegetarian"],
  "dietaryInfo": {
    "vegetarian": false,
    "vegan": false,
    "glutenFree": false,
    "dairyFree": false
  }
}

Rules:
- For ingredients: amount should be a string number (e.g., "1", "0.5", "2"), unit should be the measurement unit (cup, tbsp, tsp, oz, lb, g, ml, etc.), name is the ingredient name
- IMPORTANT: Keep ALL ingredient entries as separate items, even if the same ingredient appears multiple times with different amounts (e.g., "1 tsp salt" for seasoning and "salt and pepper to taste" should be TWO separate entries, not merged)
- DO NOT deduplicate or combine ingredients - preserve each line from the recipe exactly as a separate entry
- For compound ingredients like "salt and pepper", split into separate entries: one for "salt" and one for "pepper"
- For times: extract just the number in minutes as a string (e.g., "15" not "15 minutes")
- For servings: just the number as a string
- For category: use one of: breakfast, lunch, dinner, snack, dessert, appetizer
- For difficulty: use one of: easy, medium, hard
- For cuisine: identify the cuisine type (American, Italian, Mexican, Asian, Indian, etc.)
- For tags: include relevant tags like cooking method, dietary info, occasion
- For dietaryInfo: analyze ingredients to determine dietary flags
- If information is not found, use empty string for strings, empty array for arrays, false for booleans
- Clean up any OCR artifacts or typos in ingredient names and instructions

OCR Text:
`;

// Create AWS SigV4 signer
function createSigner() {
  return new SignatureV4({
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    region: AWS_REGION,
    service: 'bedrock',
    sha256: Sha256,
  });
}

// Format recipe using AWS Bedrock HTTP API
export async function formatRecipeWithBedrock(ocrText: string): Promise<FormatResult> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return {
      success: false,
      recipe: null,
      error: 'AWS credentials not configured for Bedrock.',
    };
  }

  if (!ocrText || ocrText.trim().length === 0) {
    return {
      success: false,
      recipe: null,
      error: 'No text provided to format.',
    };
  }

  try {
    const signer = createSigner();
    const prompt = RECIPE_EXTRACTION_PROMPT + ocrText;

    // Use Amazon Nova Pro for recipe parsing
    const modelId = 'amazon.nova-pro-v1:0';
    const hostname = `bedrock-runtime.${AWS_REGION}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(modelId)}/invoke`;

    // Nova models use a different request format
    const requestBody = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
      },
    });

    // Create the request to sign
    const request = {
      method: 'POST',
      protocol: 'https:',
      hostname,
      path,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Host: hostname,
      },
      body: requestBody,
    };

    // Sign the request
    const signedRequest = await signer.sign(request);

    // Make the HTTP request
    const response = await fetch(`https://${hostname}${path}`, {
      method: 'POST',
      headers: signedRequest.headers as Record<string, string>,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 403) {
        return {
          success: false,
          recipe: null,
          error: 'AWS access denied. Please check your credentials have Bedrock permissions.',
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          recipe: null,
          error: 'Too many requests. Please wait a moment and try again.',
        };
      }

      if (response.status === 400) {
        return {
          success: false,
          recipe: null,
          error: 'Invalid request to Bedrock. The model may not be available in your region.',
        };
      }

      return {
        success: false,
        recipe: null,
        error: `Bedrock API error (${response.status}): ${errorText}`,
      };
    }

    const responseBody = await response.json();
    // Nova response format: { output: { message: { content: [{ text: "..." }] } } }
    const content = responseBody.output?.message?.content?.[0]?.text;

    if (!content) {
      return {
        success: false,
        recipe: null,
        error: 'No response from Bedrock.',
      };
    }

    // Parse the JSON from Nova's response
    // Nova might wrap it in markdown code blocks, so we need to extract the JSON
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the parsed data
    const recipe: FormattedRecipe = {
      name: parsed.name || 'Untitled Recipe',
      description: parsed.description || '',
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((ing: any) => ({
            name: String(ing.name || ''),
            amount: String(ing.amount || ''),
            unit: String(ing.unit || ''),
          }))
        : [],
      instructions: Array.isArray(parsed.instructions)
        ? parsed.instructions.map((inst: any) => String(inst))
        : [],
      prepTime: String(parsed.prepTime || ''),
      cookTime: String(parsed.cookTime || ''),
      servings: String(parsed.servings || ''),
      cuisine: String(parsed.cuisine || ''),
      category: String(parsed.category || ''),
      difficulty: String(parsed.difficulty || 'medium'),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)) : [],
      dietaryInfo: {
        vegetarian: Boolean(parsed.dietaryInfo?.vegetarian),
        vegan: Boolean(parsed.dietaryInfo?.vegan),
        glutenFree: Boolean(parsed.dietaryInfo?.glutenFree),
        dairyFree: Boolean(parsed.dietaryInfo?.dairyFree),
      },
    };

    return {
      success: true,
      recipe,
    };
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        recipe: null,
        error: 'Failed to parse recipe structure from AI response.',
      };
    }

    return {
      success: false,
      recipe: null,
      error: `Recipe formatting failed: ${error.message || error}`,
    };
  }
}

// Format with retry logic
export async function formatRecipeWithRetry(
  ocrText: string,
  maxRetries: number = 2
): Promise<FormatResult> {
  let lastError: FormatResult | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const result = await formatRecipeWithBedrock(ocrText);

    if (result.success) {
      return result;
    }

    // Don't retry for configuration or permission errors
    if (
      result.error?.includes('credentials not configured') ||
      result.error?.includes('access denied') ||
      result.error?.includes('not available in your region')
    ) {
      return result;
    }

    lastError = result;

    // Short delay before retry
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return (
    lastError || {
      success: false,
      recipe: null,
      error: 'Recipe formatting failed after multiple attempts.',
    }
  );
}
