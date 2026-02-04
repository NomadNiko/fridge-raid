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
