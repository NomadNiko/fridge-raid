// URL fetching service for recipe import
// Uses React Native's built-in fetch API - no additional libraries required

export interface UrlFetchResult {
  success: boolean;
  text: string;
  title?: string;
  error?: string;
}

// Common recipe website selectors to help extract main content
const RECIPE_CONTENT_PATTERNS = [
  // JSON-LD structured data (most reliable for recipe sites)
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
];

// HTML entities to decode
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&deg;': '°',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '...',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  let decoded = text;

  // Replace named entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }

  // Replace numeric entities (&#123; or &#x7B;)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

/**
 * Extract JSON-LD recipe data if available (structured data)
 */
function extractJsonLdRecipe(html: string): string | null {
  const jsonLdMatches = html.match(RECIPE_CONTENT_PATTERNS[0]);

  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        // Extract JSON content from script tag
        const jsonContent = match
          .replace(/<script[^>]*>/i, '')
          .replace(/<\/script>/i, '')
          .trim();

        const data = JSON.parse(jsonContent);

        // Handle array of schemas
        const schemas = Array.isArray(data) ? data : [data];

        for (const schema of schemas) {
          // Check for Recipe type
          if (schema['@type'] === 'Recipe' || (Array.isArray(schema['@type']) && schema['@type'].includes('Recipe'))) {
            return formatJsonLdRecipe(schema);
          }

          // Check @graph for Recipe
          if (schema['@graph']) {
            for (const item of schema['@graph']) {
              if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
                return formatJsonLdRecipe(item);
              }
            }
          }
        }
      } catch {
        // JSON parse failed, continue to next match
      }
    }
  }

  return null;
}

/**
 * Format JSON-LD recipe data into readable text
 */
function formatJsonLdRecipe(recipe: any): string {
  const parts: string[] = [];

  if (recipe.name) {
    parts.push(`Recipe: ${recipe.name}`);
  }

  if (recipe.description) {
    parts.push(`Description: ${recipe.description}`);
  }

  if (recipe.prepTime) {
    parts.push(`Prep Time: ${formatDuration(recipe.prepTime)}`);
  }

  if (recipe.cookTime) {
    parts.push(`Cook Time: ${formatDuration(recipe.cookTime)}`);
  }

  if (recipe.totalTime) {
    parts.push(`Total Time: ${formatDuration(recipe.totalTime)}`);
  }

  if (recipe.recipeYield) {
    const yield_ = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
    parts.push(`Servings: ${yield_}`);
  }

  if (recipe.recipeCategory) {
    const category = Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory.join(', ') : recipe.recipeCategory;
    parts.push(`Category: ${category}`);
  }

  if (recipe.recipeCuisine) {
    const cuisine = Array.isArray(recipe.recipeCuisine) ? recipe.recipeCuisine.join(', ') : recipe.recipeCuisine;
    parts.push(`Cuisine: ${cuisine}`);
  }

  parts.push('');
  parts.push('INGREDIENTS:');

  if (recipe.recipeIngredient && Array.isArray(recipe.recipeIngredient)) {
    for (const ingredient of recipe.recipeIngredient) {
      parts.push(`- ${ingredient}`);
    }
  }

  parts.push('');
  parts.push('INSTRUCTIONS:');

  if (recipe.recipeInstructions) {
    const instructions = Array.isArray(recipe.recipeInstructions)
      ? recipe.recipeInstructions
      : [recipe.recipeInstructions];

    let stepNum = 1;
    for (const instruction of instructions) {
      if (typeof instruction === 'string') {
        parts.push(`${stepNum}. ${instruction}`);
        stepNum++;
      } else if (instruction['@type'] === 'HowToStep') {
        parts.push(`${stepNum}. ${instruction.text || instruction.name || ''}`);
        stepNum++;
      } else if (instruction['@type'] === 'HowToSection') {
        if (instruction.name) {
          parts.push(`\n${instruction.name}:`);
        }
        if (instruction.itemListElement) {
          for (const step of instruction.itemListElement) {
            if (typeof step === 'string') {
              parts.push(`${stepNum}. ${step}`);
            } else {
              parts.push(`${stepNum}. ${step.text || step.name || ''}`);
            }
            stepNum++;
          }
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Format ISO 8601 duration to readable format
 */
function formatDuration(duration: string): string {
  if (!duration || typeof duration !== 'string') return duration;

  // Parse ISO 8601 duration (e.g., PT1H30M)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (match) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);

    if (hours > 0 && minutes > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minutes`;
    }
  }

  return duration;
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtmlToText(html: string): string {
  let text = html;

  // Remove script and style elements entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Add line breaks for block elements
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  return undefined;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch webpage content and extract text
 */
export async function fetchUrlContent(url: string): Promise<UrlFetchResult> {
  // Validate URL
  if (!url || !url.trim()) {
    return {
      success: false,
      text: '',
      error: 'Please enter a URL',
    };
  }

  // Add protocol if missing
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  if (!isValidUrl(normalizedUrl)) {
    return {
      success: false,
      text: '',
      error: 'Invalid URL format. Please enter a valid web address.',
    };
  }

  try {
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        // Use a browser-like user agent to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeImporter/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          text: '',
          error: 'Page not found. Please check the URL.',
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          text: '',
          error: 'Access denied. This website may be blocking automated requests.',
        };
      }
      return {
        success: false,
        text: '',
        error: `Failed to load page (HTTP ${response.status})`,
      };
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      return {
        success: false,
        text: '',
        error: 'The page appears to be empty.',
      };
    }

    // Try to extract structured recipe data first (JSON-LD)
    const jsonLdRecipe = extractJsonLdRecipe(html);
    if (jsonLdRecipe) {
      return {
        success: true,
        text: jsonLdRecipe,
        title: extractTitle(html),
      };
    }

    // Fall back to plain text extraction
    const textContent = stripHtmlToText(html);

    if (textContent.length < 100) {
      return {
        success: false,
        text: '',
        error: 'Could not extract enough content from this page. It may require JavaScript to load.',
      };
    }

    // Limit text length to avoid overwhelming Bedrock
    const maxLength = 15000;
    const truncatedText = textContent.length > maxLength
      ? textContent.substring(0, maxLength) + '\n\n[Content truncated...]'
      : textContent;

    return {
      success: true,
      text: truncatedText,
      title: extractTitle(html),
    };
  } catch (error: any) {
    // Handle specific error types
    if (error.message?.includes('Network request failed')) {
      return {
        success: false,
        text: '',
        error: 'Network error. Please check your internet connection.',
      };
    }

    if (error.message?.includes('timeout')) {
      return {
        success: false,
        text: '',
        error: 'Request timed out. The website may be slow or unavailable.',
      };
    }

    return {
      success: false,
      text: '',
      error: `Failed to fetch URL: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Fetch with retry logic
 */
export async function fetchUrlWithRetry(
  url: string,
  maxRetries: number = 2
): Promise<UrlFetchResult> {
  let lastError: UrlFetchResult | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const result = await fetchUrlContent(url);

    if (result.success) {
      return result;
    }

    // Don't retry for user errors
    if (
      result.error?.includes('Invalid URL') ||
      result.error?.includes('Please enter') ||
      result.error?.includes('not found') ||
      result.error?.includes('Access denied')
    ) {
      return result;
    }

    lastError = result;

    // Short delay before retry
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return lastError || {
    success: false,
    text: '',
    error: 'Failed to fetch URL after multiple attempts.',
  };
}
