import { OCRResult } from './ocrService';
import {
  parseIngredientLine,
  isInstructionLine,
  isSectionHeader,
  normalizeUnicodeFractions,
  SECTION_PATTERNS,
} from './ingredientPatterns';

export interface ParsedIngredient {
  name: string;
  amount: string;
  unit: string;
}

export interface ParsedRecipe {
  name: string;
  description: string;
  ingredients: ParsedIngredient[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  cuisine: string;
  category: string;
  confidence: number;
}

// Split text into lines, handling various line endings
function splitIntoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Extract recipe title (usually the first prominent text)
function extractTitle(lines: string[]): { title: string; startIndex: number } {
  // Skip common non-title elements at the start
  const skipPatterns = [/^page\s+\d+/i, /^\d+$/, /^www\./i, /^http/i, /^@/, /^copyright/i];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];

    // Skip patterns that are clearly not titles
    if (skipPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    // Skip very short lines (likely not a title)
    if (line.length < 3) {
      continue;
    }

    // Skip lines that look like section headers
    if (isSectionHeader(line)) {
      continue;
    }

    // Skip lines that start with numbers (likely ingredients or steps)
    if (/^\d+[.)\s]/.test(line)) {
      continue;
    }

    // Skip lines that look like ingredients (have units)
    const parsed = parseIngredientLine(line);
    if (parsed && parsed.amount && parsed.unit) {
      continue;
    }

    // This is probably the title
    return { title: line, startIndex: i };
  }

  return { title: 'Untitled Recipe', startIndex: 0 };
}

// Extract metadata like prep time, cook time, servings
function extractMetadata(text: string): {
  prepTime: string;
  cookTime: string;
  servings: string;
} {
  const result = {
    prepTime: '',
    cookTime: '',
    servings: '',
  };

  // Look for prep time
  const prepMatch = text.match(SECTION_PATTERNS.prepTime);
  if (prepMatch) {
    result.prepTime = prepMatch[2] || '';
  }

  // Look for cook time
  const cookMatch = text.match(SECTION_PATTERNS.cookTime);
  if (cookMatch) {
    result.cookTime = cookMatch[2] || '';
  }

  // Look for servings
  const servingsMatch = text.match(SECTION_PATTERNS.servings);
  if (servingsMatch) {
    result.servings = servingsMatch[1] || '';
  }

  return result;
}

// Identify sections in the text
function identifySections(lines: string[]): {
  ingredientsStart: number;
  ingredientsEnd: number;
  instructionsStart: number;
  instructionsEnd: number;
} {
  let ingredientsStart = -1;
  let ingredientsEnd = -1;
  let instructionsStart = -1;
  let instructionsEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const section = isSectionHeader(lines[i]);

    if (section === 'ingredients') {
      ingredientsStart = i + 1;
    } else if (section === 'instructions') {
      if (ingredientsStart !== -1 && ingredientsEnd === -1) {
        ingredientsEnd = i;
      }
      instructionsStart = i + 1;
    }
  }

  // If we found ingredients start but not end, look for instruction-like content
  if (ingredientsStart !== -1 && ingredientsEnd === -1) {
    for (let i = ingredientsStart; i < lines.length; i++) {
      if (isInstructionLine(lines[i])) {
        ingredientsEnd = i;
        if (instructionsStart === -1) {
          instructionsStart = i;
        }
        break;
      }
    }
  }

  // Set remaining boundaries
  if (ingredientsEnd === -1) {
    ingredientsEnd = instructionsStart !== -1 ? instructionsStart : lines.length;
  }
  if (instructionsStart === -1) {
    instructionsStart = ingredientsEnd;
  }
  if (instructionsEnd === -1) {
    instructionsEnd = lines.length;
  }

  return { ingredientsStart, ingredientsEnd, instructionsStart, instructionsEnd };
}

// Parse ingredients from lines
function parseIngredients(lines: string[]): ParsedIngredient[] {
  const ingredients: ParsedIngredient[] = [];

  for (const line of lines) {
    // Skip section headers and empty lines
    if (isSectionHeader(line) || line.length < 2) {
      continue;
    }

    const parsed = parseIngredientLine(line);
    if (parsed) {
      ingredients.push(parsed);
    }
  }

  return ingredients;
}

// Parse instructions from lines
function parseInstructions(lines: string[]): string[] {
  const instructions: string[] = [];
  let currentInstruction = '';

  for (const line of lines) {
    // Skip section headers
    if (isSectionHeader(line)) {
      continue;
    }

    // Check if this line starts a new numbered step
    const numberedMatch = line.match(/^(\d+)[.)]\s*(.*)$/);
    if (numberedMatch) {
      // Save previous instruction if exists
      if (currentInstruction) {
        instructions.push(currentInstruction.trim());
      }
      currentInstruction = numberedMatch[2];
    } else if (isInstructionLine(line)) {
      // Save previous instruction if exists
      if (currentInstruction) {
        instructions.push(currentInstruction.trim());
      }
      currentInstruction = line;
    } else if (currentInstruction) {
      // Continue previous instruction
      currentInstruction += ' ' + line;
    } else {
      // Start new instruction
      currentInstruction = line;
    }
  }

  // Don't forget the last instruction
  if (currentInstruction) {
    instructions.push(currentInstruction.trim());
  }

  return instructions.filter((inst) => inst.length > 0);
}

// Heuristic approach when no clear sections are found
function parseWithoutSections(
  lines: string[],
  titleIndex: number
): {
  ingredients: ParsedIngredient[];
  instructions: string[];
} {
  const ingredients: ParsedIngredient[] = [];
  const instructions: string[] = [];
  let inIngredients = true;

  for (let i = titleIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip section headers but use them to switch modes
    const section = isSectionHeader(line);
    if (section === 'ingredients') {
      inIngredients = true;
      continue;
    } else if (section === 'instructions') {
      inIngredients = false;
      continue;
    }

    // Try to parse as ingredient
    const ingredientParsed = parseIngredientLine(line);

    if (inIngredients && ingredientParsed && (ingredientParsed.amount || ingredientParsed.unit)) {
      ingredients.push(ingredientParsed);
    } else if (isInstructionLine(line)) {
      inIngredients = false;
      // Remove leading numbers from instruction
      const cleanedLine = line.replace(/^\d+[.)]\s*/, '').trim();
      if (cleanedLine) {
        instructions.push(cleanedLine);
      }
    } else if (!inIngredients && line.length > 20) {
      // Long lines after we've switched to instructions mode are probably instructions
      instructions.push(line);
    } else if (ingredientParsed && ingredientParsed.name && !ingredientParsed.amount) {
      // Could be either - use heuristics
      if (line.length > 50) {
        instructions.push(line);
        inIngredients = false;
      } else {
        ingredients.push(ingredientParsed);
      }
    }
  }

  return { ingredients, instructions };
}

// Calculate confidence score based on parsing results
function calculateConfidence(parsed: ParsedRecipe): number {
  let score = 0;
  let maxScore = 0;

  // Title (20 points)
  maxScore += 20;
  if (parsed.name && parsed.name !== 'Untitled Recipe') {
    score += 20;
  }

  // Ingredients (40 points)
  maxScore += 40;
  if (parsed.ingredients.length >= 3) {
    score += 40;
  } else if (parsed.ingredients.length >= 1) {
    score += 20;
  }

  // Check ingredient quality (have amounts)
  const ingredientsWithAmounts = parsed.ingredients.filter((i) => i.amount).length;
  if (ingredientsWithAmounts >= parsed.ingredients.length * 0.5) {
    score += 10;
    maxScore += 10;
  }

  // Instructions (30 points)
  maxScore += 30;
  if (parsed.instructions.length >= 3) {
    score += 30;
  } else if (parsed.instructions.length >= 1) {
    score += 15;
  }

  // Metadata (10 points)
  maxScore += 10;
  if (parsed.prepTime || parsed.cookTime || parsed.servings) {
    score += 10;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

// Main parsing function
export function parseRecipeText(ocrResult: OCRResult): ParsedRecipe {
  const emptyRecipe: ParsedRecipe = {
    name: '',
    description: '',
    ingredients: [],
    instructions: [],
    prepTime: '',
    cookTime: '',
    servings: '',
    cuisine: '',
    category: '',
    confidence: 0,
  };

  if (!ocrResult.success || !ocrResult.rawText) {
    return emptyRecipe;
  }

  // Normalize the text
  const normalizedText = normalizeUnicodeFractions(ocrResult.rawText);
  const lines = splitIntoLines(normalizedText);

  if (lines.length === 0) {
    return emptyRecipe;
  }

  // Extract title
  const { title, startIndex } = extractTitle(lines);

  // Extract metadata from full text
  const metadata = extractMetadata(normalizedText);

  // Try to identify sections
  const sections = identifySections(lines);

  let ingredients: ParsedIngredient[] = [];
  let instructions: string[] = [];

  // If we found clear sections, use them
  if (sections.ingredientsStart !== -1 && sections.ingredientsStart < sections.ingredientsEnd) {
    ingredients = parseIngredients(lines.slice(sections.ingredientsStart, sections.ingredientsEnd));
  }

  if (sections.instructionsStart !== -1 && sections.instructionsStart < sections.instructionsEnd) {
    instructions = parseInstructions(
      lines.slice(sections.instructionsStart, sections.instructionsEnd)
    );
  }

  // If we didn't find enough content, try heuristic approach
  if (ingredients.length < 2 || instructions.length < 1) {
    const heuristic = parseWithoutSections(lines, startIndex);

    if (heuristic.ingredients.length > ingredients.length) {
      ingredients = heuristic.ingredients;
    }
    if (heuristic.instructions.length > instructions.length) {
      instructions = heuristic.instructions;
    }
  }

  const parsed: ParsedRecipe = {
    name: title,
    description: '',
    ingredients,
    instructions,
    prepTime: metadata.prepTime,
    cookTime: metadata.cookTime,
    servings: metadata.servings,
    cuisine: '',
    category: '',
    confidence: 0,
  };

  // Calculate confidence score
  parsed.confidence = calculateConfidence(parsed);

  return parsed;
}

// Convert parsed recipe to form-compatible format
export function convertToFormData(parsed: ParsedRecipe): {
  name: string;
  description: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  cuisine: string;
  category: string;
} {
  return {
    name: parsed.name,
    description: parsed.description,
    ingredients:
      parsed.ingredients.length > 0 ? parsed.ingredients : [{ name: '', amount: '', unit: '' }],
    instructions: parsed.instructions.length > 0 ? parsed.instructions : [''],
    prepTime: parsed.prepTime,
    cookTime: parsed.cookTime,
    servings: parsed.servings,
    cuisine: parsed.cuisine,
    category: parsed.category,
  };
}
