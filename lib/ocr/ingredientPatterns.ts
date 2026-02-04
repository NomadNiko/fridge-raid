// Common unit variations for ingredient parsing
export const UNIT_VARIATIONS: Record<string, string[]> = {
  cup: ['cup', 'cups', 'c.', 'c'],
  tablespoon: ['tablespoon', 'tablespoons', 'tbsp', 'tbsps', 'tbs', 'T'],
  teaspoon: ['teaspoon', 'teaspoons', 'tsp', 'tsps', 't'],
  ounce: ['ounce', 'ounces', 'oz', 'oz.'],
  pound: ['pound', 'pounds', 'lb', 'lbs', 'lb.'],
  gram: ['gram', 'grams', 'g', 'g.'],
  kilogram: ['kilogram', 'kilograms', 'kg', 'kg.'],
  milliliter: ['milliliter', 'milliliters', 'ml', 'ml.'],
  liter: ['liter', 'liters', 'l', 'L'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  clove: ['clove', 'cloves'],
  slice: ['slice', 'slices'],
  piece: ['piece', 'pieces', 'pc', 'pcs'],
  can: ['can', 'cans'],
  jar: ['jar', 'jars'],
  package: ['package', 'packages', 'pkg', 'pkgs'],
  bunch: ['bunch', 'bunches'],
  head: ['head', 'heads'],
  stalk: ['stalk', 'stalks'],
  sprig: ['sprig', 'sprigs'],
  handful: ['handful', 'handfuls'],
  large: ['large', 'lg'],
  medium: ['medium', 'med'],
  small: ['small', 'sm'],
};

// Unicode fractions mapping
export const UNICODE_FRACTIONS: Record<string, string> = {
  '\u00BC': '1/4', // 1/4
  '\u00BD': '1/2', // 1/2
  '\u00BE': '3/4', // 3/4
  '\u2153': '1/3', // 1/3
  '\u2154': '2/3', // 2/3
  '\u2155': '1/5', // 1/5
  '\u2156': '2/5', // 2/5
  '\u2157': '3/5', // 3/5
  '\u2158': '4/5', // 4/5
  '\u2159': '1/6', // 1/6
  '\u215A': '5/6', // 5/6
  '\u215B': '1/8', // 1/8
  '\u215C': '3/8', // 3/8
  '\u215D': '5/8', // 5/8
  '\u215E': '7/8', // 7/8
};

// Build regex pattern for all units
const allUnits = Object.values(UNIT_VARIATIONS).flat().join('|');

// Pattern to match fractions like 1/2, 1/4, etc.
const fractionPattern = '\\d+\\/\\d+';

// Pattern to match whole numbers with optional fractions
const numberPattern = `(?:\\d+\\s*(?:${fractionPattern})?|${fractionPattern})`;

// Pattern to match ranges like 1-2 or 1 to 2
const rangePattern = `${numberPattern}(?:\\s*[-–—]\\s*|\\s+to\\s+)${numberPattern}`;

// Combined amount pattern (range or single number)
const amountPattern = `(?:${rangePattern}|${numberPattern})`;

// Main ingredient line pattern
// Matches: "2 cups flour", "1/2 tsp salt", "1-2 large eggs", etc.
export const INGREDIENT_LINE_REGEX = new RegExp(
  `^\\s*(${amountPattern})\\s*(${allUnits})?[.,]?\\s+(.+?)\\s*$`,
  'i'
);

// Pattern for ingredient lines without amounts (e.g., "Salt and pepper to taste")
export const INGREDIENT_NO_AMOUNT_REGEX =
  /^[A-Za-z][^0-9]*(?:to taste|as needed|for garnish|optional)?\s*$/i;

// Section header patterns
export const SECTION_PATTERNS = {
  ingredients: /^(?:ingredients?|what you(?:'ll)? need|you(?:'ll)? need):?\s*$/i,
  instructions:
    /^(?:instructions?|directions?|method|steps?|how to (?:make|prepare)|preparation):?\s*$/i,
  prepTime: /(?:prep(?:aration)?[\s:]*(time)?|prep)[\s:]+(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)?/i,
  cookTime: /(?:cook(?:ing)?[\s:]*(time)?|cook)[\s:]+(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)?/i,
  totalTime: /(?:total[\s:]*(time)?)[\s:]+(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)?/i,
  servings: /(?:servings?|serves?|yields?|makes?)[\s:]+(\d+)/i,
};

// Normalize unicode fractions to standard format
export function normalizeUnicodeFractions(text: string): string {
  let result = text;
  for (const [unicode, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    result = result.replace(new RegExp(unicode, 'g'), ascii);
  }
  return result;
}

// Normalize unit to standard form
export function normalizeUnit(unit: string): string {
  const lowerUnit = unit.toLowerCase().trim();
  for (const [standard, variations] of Object.entries(UNIT_VARIATIONS)) {
    if (variations.some((v) => v.toLowerCase() === lowerUnit)) {
      return standard;
    }
  }
  return lowerUnit;
}

// Parse a single ingredient line
export function parseIngredientLine(line: string): {
  amount: string;
  unit: string;
  name: string;
} | null {
  // Normalize unicode fractions first
  const normalizedLine = normalizeUnicodeFractions(line.trim());

  // Skip empty lines or lines that are clearly not ingredients
  if (!normalizedLine || normalizedLine.length < 2) {
    return null;
  }

  // Try to match the standard ingredient pattern
  const match = normalizedLine.match(INGREDIENT_LINE_REGEX);
  if (match) {
    const [, amount, unit, name] = match;
    return {
      amount: amount?.trim() || '',
      unit: unit ? normalizeUnit(unit) : '',
      name: name?.trim() || '',
    };
  }

  // Check if it's an ingredient without amount (e.g., "Salt to taste")
  if (INGREDIENT_NO_AMOUNT_REGEX.test(normalizedLine)) {
    return {
      amount: '',
      unit: '',
      name: normalizedLine,
    };
  }

  // If no pattern matched but line looks like it could be an ingredient
  // (starts with a letter, reasonable length), return it as name only
  if (/^[A-Za-z]/.test(normalizedLine) && normalizedLine.length < 100) {
    return {
      amount: '',
      unit: '',
      name: normalizedLine,
    };
  }

  return null;
}

// Check if a line looks like an instruction step
export function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  // Starts with a number followed by period or parenthesis
  if (/^\d+[.)]\s/.test(trimmed)) {
    return true;
  }
  // Contains action verbs at the start
  const actionVerbs =
    /^(?:preheat|mix|stir|add|combine|pour|bake|cook|heat|boil|simmer|whisk|fold|beat|chop|slice|dice|mince|grate|blend|puree|saute|fry|roast|grill|broil|steam|drain|rinse|season|serve|garnish|let|allow|set|place|remove|transfer|cover|uncover)/i;
  return actionVerbs.test(trimmed);
}

// Check if a line is likely a section header
export function isSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(trimmed)) {
      return section;
    }
  }
  return null;
}
