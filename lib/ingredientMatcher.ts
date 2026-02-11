import { Ingredient } from '../types/ingredient';
import { CustomIngredient } from './storage';

type IngredientLike = Ingredient | CustomIngredient;

export const matchIngredient = (
  searchName: string,
  ingredients: IngredientLike[]
): IngredientLike | undefined => {
  const normalized = searchName.toLowerCase().trim();
  return ingredients.find((ing) => {
    if (ing.name.toLowerCase() === normalized) return true;
    if ('alternativeNames' in ing && ing.alternativeNames?.some((alt) => alt.toLowerCase() === normalized)) return true;
    return false;
  });
};

export const hasIngredient = (searchName: string, fridgeIngredients: IngredientLike[]): boolean => {
  return matchIngredient(searchName, fridgeIngredients) !== undefined;
};

export const findBuiltInIngredient = (
  searchName: string,
  builtInIngredients: Ingredient[]
): Ingredient | undefined => {
  const normalized = searchName.toLowerCase().trim();
  return builtInIngredients.find((ing) => {
    if (ing.name.toLowerCase() === normalized) return true;
    if (ing.alternativeNames?.some((alt) => alt.toLowerCase() === normalized)) return true;
    return false;
  });
};

export const findCustomIngredient = (
  searchName: string,
  customIngredients: CustomIngredient[]
): CustomIngredient | undefined => {
  const normalized = searchName.toLowerCase().trim();
  return customIngredients.find((ing) => ing.name.toLowerCase() === normalized);
};

// IDs of items miscategorized as spices that should not be excluded
const SPICE_EXCLUSION_IDS = new Set([334, 679]); // Salt Cod, Unsalted Pistachio

type IngredientInfo = { id: number; name: string; category: string; alternativeNames?: string[] };

const findInList = (
  ingredientName: string,
  builtInIngredients: IngredientInfo[]
): IngredientInfo | undefined => {
  const normalized = ingredientName.toLowerCase().trim();
  return builtInIngredients.find((ing) => {
    if (ing.name.toLowerCase() === normalized) return true;
    if (ing.alternativeNames?.some((alt) => alt.toLowerCase() === normalized)) return true;
    return false;
  });
};

export const isSpiceOrHerb = (
  ingredientName: string,
  builtInIngredients: IngredientInfo[]
): boolean => {
  const found = findInList(ingredientName, builtInIngredients);
  if (!found) return false;
  if (SPICE_EXCLUSION_IDS.has(found.id)) return false;
  return found.category === 'spices' || found.category === 'herbs';
};

const KEY_CATEGORIES = new Set(['meat', 'seafood', 'produce', 'dairy', 'grains', 'grain', 'baking']);

export const isKeyIngredient = (
  ingredientName: string,
  builtInIngredients: IngredientInfo[]
): boolean => {
  const found = findInList(ingredientName, builtInIngredients);
  if (!found) return false;
  return KEY_CATEGORIES.has(found.category);
};
