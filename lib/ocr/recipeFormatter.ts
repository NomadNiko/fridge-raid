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
  ingredients: { name: string; amount: string; unit: string; preparation?: string; alternatives?: string[] }[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  cuisine: string;
  category: string;
  mealType: string;
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
const RECIPE_EXTRACTION_PROMPT = `You are a recipe parser for a cooking app. Extract structured recipe data from the following OCR text.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just the JSON):
{
  "name": "Recipe Name",
  "description": "Brief 1-2 sentence description of the dish",
  "ingredients": [
    { "name": "Chicken Breast", "amount": "2", "unit": "whole", "preparation": "diced" },
    { "name": "Vegetable Oil", "amount": "2", "unit": "tbsp", "preparation": "", "alternatives": ["Sunflower Oil"] },
    { "name": "Salt", "amount": "1", "unit": "to taste", "preparation": "" }
  ],
  "instructions": [
    "Preheat the oven to 180C (350F).",
    "Season the chicken with salt and pepper.",
    "Heat olive oil in a large skillet over medium-high heat.",
    "Sear chicken for 3 minutes per side until golden brown.",
    "Transfer to the oven and bake for 20 minutes until cooked through."
  ],
  "prepTime": "15",
  "cookTime": "30",
  "servings": "4",
  "cuisine": "Italian",
  "category": "dinner",
  "mealType": "Chicken",
  "difficulty": "medium",
  "tags": ["baked", "quick", "high-protein"],
  "dietaryInfo": {
    "vegetarian": false,
    "vegan": false,
    "glutenFree": true,
    "dairyFree": true
  }
}

INGREDIENT RULES:
- "name": The ingredient only, in Title Case. NO preparation words in the name (e.g., "Onion" not "Onion, diced"). NO amounts or units in the name.
- "amount": A string number (e.g., "1", "0.5", "2"). Convert fractions: 1/2 = "0.5", 1/4 = "0.25", 3/4 = "0.75", 1/3 = "0.33".
- "unit": Use ONLY these values: g, tsp, tbsp, cup, ml, slice, clove, whole, pinch, dash, handful, bunch, can, sprig, head, stalk, to taste, to serve, for frying, for greasing. Use "whole" when counting items (e.g., "2 eggs" = amount "2", unit "whole"). Use "to taste" for "salt to taste" or "as needed".
- "preparation": How the ingredient is prepared (e.g., "diced", "chopped", "minced", "sliced", "grated", "melted", "softened", "juiced", "zested"). Use empty string "" if no preparation is specified.
- IMPORTANT: Keep ALL ingredient entries as separate items, even if the same ingredient appears multiple times with different amounts
- DO NOT deduplicate or combine ingredients - preserve each line from the recipe exactly as a separate entry
- For compound ingredients like "salt and pepper", split into separate entries: one for "Salt" and one for "Black Pepper"
- ALTERNATIVE INGREDIENTS: When the recipe says "X or Y" for an ingredient (e.g., "vegetable or sunflower oil", "heavy cream or coconut cream", "veg or chicken stock"), use the FIRST option as the "name" and list the other option(s) in an "alternatives" array. Expand abbreviations to full names (e.g., "veg stock" becomes "Vegetable Stock"). Each alternative must be a complete, Title Case ingredient name. If there are no alternatives, omit the "alternatives" field entirely.

INSTRUCTION RULES:
- Break instructions into short, single-action steps (aim for 100-250 characters each)
- Each step should describe ONE action (e.g., "Preheat oven", "Mix dry ingredients", "Add eggs and stir")
- If the source has long paragraphs, split them into individual steps
- Do NOT prefix steps with "Step 1:", "1.", etc. - just the instruction text
- Clean up any OCR artifacts or typos

METADATA RULES:
- For times: extract just the number in minutes as a string (e.g., "15" not "15 minutes")
- For servings: just the number as a string
- For category: use one of: breakfast, dinner, dessert, side, starter
- For mealType: use one of: Beef, Chicken, Lamb, Pork, Seafood, Vegetarian, Vegan, Pasta, Dessert, Side, Breakfast, Starter, Goat, Miscellaneous
- For difficulty: use one of: easy, medium, hard
- For cuisine: use one of: American, Asian, Australian, British, Canadian, Dutch, French, Indian, Irish, Italian, Jamaican, Mexican, Moroccan, Polish, Portuguese, Russian, South American, Spanish, Turkish, Ukrainian. Use the closest match if the exact cuisine is not listed.
- For tags: include relevant tags like cooking method, dietary info, key ingredients
- For dietaryInfo: analyze ingredients to determine dietary flags accurately
- If information is not found, use empty string for strings, empty array for arrays, false for booleans

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
            preparation: String(ing.preparation || ''),
            ...(Array.isArray(ing.alternatives) && ing.alternatives.length > 0
              ? { alternatives: ing.alternatives.map((a: any) => String(a)) }
              : {}),
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
      mealType: String(parsed.mealType || ''),
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

// URL-specific prompt for extracting recipes from web content
const URL_RECIPE_EXTRACTION_PROMPT = `You are a recipe parser for a cooking app. Extract structured recipe data from the following web page content.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just the JSON):
{
  "name": "Recipe Name",
  "description": "Brief 1-2 sentence description of the dish",
  "ingredients": [
    { "name": "Chicken Breast", "amount": "2", "unit": "whole", "preparation": "diced" },
    { "name": "Vegetable Oil", "amount": "2", "unit": "tbsp", "preparation": "", "alternatives": ["Sunflower Oil"] },
    { "name": "Salt", "amount": "1", "unit": "to taste", "preparation": "" }
  ],
  "instructions": [
    "Preheat the oven to 180C (350F).",
    "Season the chicken with salt and pepper.",
    "Heat olive oil in a large skillet over medium-high heat.",
    "Sear chicken for 3 minutes per side until golden brown.",
    "Transfer to the oven and bake for 20 minutes until cooked through."
  ],
  "prepTime": "15",
  "cookTime": "30",
  "servings": "4",
  "cuisine": "Italian",
  "category": "dinner",
  "mealType": "Chicken",
  "difficulty": "medium",
  "tags": ["baked", "quick", "high-protein"],
  "dietaryInfo": {
    "vegetarian": false,
    "vegan": false,
    "glutenFree": true,
    "dairyFree": true
  }
}

INGREDIENT RULES:
- "name": The ingredient only, in Title Case. NO preparation words in the name (e.g., "Onion" not "Onion, diced"). NO amounts or units in the name.
- "amount": A string number (e.g., "1", "0.5", "2"). Convert fractions: 1/2 = "0.5", 1/4 = "0.25", 3/4 = "0.75", 1/3 = "0.33".
- "unit": Use ONLY these values: g, tsp, tbsp, cup, ml, slice, clove, whole, pinch, dash, handful, bunch, can, sprig, head, stalk, to taste, to serve, for frying, for greasing. Use "whole" when counting items (e.g., "2 eggs" = amount "2", unit "whole"). Use "to taste" for "salt to taste" or "as needed".
- "preparation": How the ingredient is prepared (e.g., "diced", "chopped", "minced", "sliced", "grated", "melted", "softened", "juiced", "zested"). Use empty string "" if no preparation is specified.
- IMPORTANT: Keep ALL ingredient entries as separate items, even if the same ingredient appears multiple times with different amounts
- DO NOT deduplicate or combine ingredients - preserve each ingredient from the recipe exactly as a separate entry
- For compound ingredients like "salt and pepper", split into separate entries: one for "Salt" and one for "Black Pepper"
- ALTERNATIVE INGREDIENTS: When the recipe says "X or Y" for an ingredient (e.g., "vegetable or sunflower oil", "heavy cream or coconut cream", "veg or chicken stock"), use the FIRST option as the "name" and list the other option(s) in an "alternatives" array. Expand abbreviations to full names (e.g., "veg stock" becomes "Vegetable Stock"). Each alternative must be a complete, Title Case ingredient name. If there are no alternatives, omit the "alternatives" field entirely.

INSTRUCTION RULES:
- Break instructions into short, single-action steps (aim for 100-250 characters each)
- Each step should describe ONE action (e.g., "Preheat oven", "Mix dry ingredients", "Add eggs and stir")
- If the source has long paragraphs, split them into individual steps
- Do NOT prefix steps with "Step 1:", "1.", etc. - just the instruction text

METADATA RULES:
- For times: extract just the number in minutes as a string (e.g., "15" not "15 minutes")
- For servings: just the number as a string
- For category: use one of: breakfast, dinner, dessert, side, starter
- For mealType: use one of: Beef, Chicken, Lamb, Pork, Seafood, Vegetarian, Vegan, Pasta, Dessert, Side, Breakfast, Starter, Goat, Miscellaneous
- For difficulty: use one of: easy, medium, hard
- For cuisine: use one of: American, Asian, Australian, British, Canadian, Dutch, French, Indian, Irish, Italian, Jamaican, Mexican, Moroccan, Polish, Portuguese, Russian, South American, Spanish, Turkish, Ukrainian. Use the closest match if the exact cuisine is not listed.
- For tags: include relevant tags like cooking method, dietary info, key ingredients
- For dietaryInfo: analyze ingredients to determine dietary flags accurately
- If information is not found, use empty string for strings, empty array for arrays, false for booleans
- Ignore ads, navigation, comments, and non-recipe content
- Focus on extracting the main recipe from the page

Web Page Content:
`;

// Format recipe from URL content using AWS Bedrock
export async function formatRecipeFromUrl(webContent: string): Promise<FormatResult> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return {
      success: false,
      recipe: null,
      error: 'AWS credentials not configured for Bedrock.',
    };
  }

  if (!webContent || webContent.trim().length === 0) {
    return {
      success: false,
      recipe: null,
      error: 'No content provided to parse.',
    };
  }

  try {
    const signer = createSigner();
    const prompt = URL_RECIPE_EXTRACTION_PROMPT + webContent;

    // Use Amazon Nova Pro for recipe parsing
    const modelId = 'amazon.nova-pro-v1:0';
    const hostname = `bedrock-runtime.${AWS_REGION}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(modelId)}/invoke`;

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

    const signedRequest = await signer.sign(request);

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
    const content = responseBody.output?.message?.content?.[0]?.text;

    if (!content) {
      return {
        success: false,
        recipe: null,
        error: 'No response from Bedrock.',
      };
    }

    // Parse the JSON from Nova's response
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
            preparation: String(ing.preparation || ''),
            ...(Array.isArray(ing.alternatives) && ing.alternatives.length > 0
              ? { alternatives: ing.alternatives.map((a: any) => String(a)) }
              : {}),
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
      mealType: String(parsed.mealType || ''),
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
      error: `Recipe extraction failed: ${error.message || error}`,
    };
  }
}

// Format recipe from URL with retry logic
export async function formatRecipeFromUrlWithRetry(
  webContent: string,
  maxRetries: number = 2
): Promise<FormatResult> {
  let lastError: FormatResult | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const result = await formatRecipeFromUrl(webContent);

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
      error: 'Recipe extraction failed after multiple attempts.',
    }
  );
}
