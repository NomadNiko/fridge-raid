import { Ingredient } from '../types/ingredient';

export const matchIngredient = (
  searchName: string,
  ingredients: Ingredient[]
): Ingredient | undefined => {
  const normalized = searchName.toLowerCase().trim();
  return ingredients.find((ing) => {
    if (ing.name.toLowerCase() === normalized) return true;
    if (ing.alternativeNames?.some((alt) => alt.toLowerCase() === normalized)) return true;
    return false;
  });
};

export const hasIngredient = (searchName: string, fridgeIngredients: Ingredient[]): boolean => {
  return matchIngredient(searchName, fridgeIngredients) !== undefined;
};
