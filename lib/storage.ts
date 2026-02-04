import AsyncStorage from '@react-native-async-storage/async-storage';
import { recipesData } from './data/recipes';
import { ingredientsData } from './data/ingredients';
import { cookwareData } from './data/cookware';
import { unitConversionsData } from './data/unitConversions';

export type UserFridgeItem = {
  ingredientId: number;
  addedDate: string;
  notes?: string;
  customQuantity?: number;
  isCustom?: boolean;
};

export type CustomIngredient = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
};

export type UserCollectionItem = {
  recipeId: number;
  addedDate: string;
  notes?: string;
  customizations?: {
    ingredientSubstitutions?: { original: string; substitute: string }[];
    adjustedServings?: number;
    cookingNotes?: string;
  };
  lastCooked?: string;
  timesCooked?: number;
  userRating?: number;
  includeInShoppingList?: boolean;
};

export type UserRecipe = {
  id: number;
  name: string;
  description?: string;
  ingredients: { name: string; amount: number; unit: string }[];
  instructions: { step: number; text: string }[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  cuisine?: string;
  category?: string;
  addedDate: string;
  includeInShoppingList?: boolean;
};

const getItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.error(`Storage read error [${key}]:`, e);
    return null;
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error(`Storage write error [${key}]:`, e);
    throw e;
  }
};

export const initializeDatabase = async () => {
  try {
    await setItem('recipes', JSON.stringify(recipesData));
    await setItem('ingredients', JSON.stringify(ingredientsData));
    await setItem('cookware', JSON.stringify(cookwareData));
    await setItem('unitConversions', JSON.stringify(unitConversionsData));

    const keys = await AsyncStorage.getAllKeys();
    if (!keys.includes('userFridge')) await setItem('userFridge', JSON.stringify([]));
    if (!keys.includes('userCollection')) await setItem('userCollection', JSON.stringify([]));
    if (!keys.includes('userRecipes')) await setItem('userRecipes', JSON.stringify([]));
    if (!keys.includes('customIngredients')) await setItem('customIngredients', JSON.stringify([]));
  } catch (e) {
    console.error('Database initialization failed:', e);
    throw e;
  }
};

export const getUserFridge = async (): Promise<UserFridgeItem[]> => {
  try {
    const data = await getItem('userFridge');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get user fridge:', e);
    return [];
  }
};

export const addToFridge = async (
  ingredientId: number,
  notes?: string,
  customQuantity?: number
) => {
  const fridge = await getUserFridge();
  if (fridge.some((item) => item.ingredientId === ingredientId && !item.isCustom)) return;
  fridge.push({ ingredientId, addedDate: new Date().toISOString(), notes, customQuantity });
  await setItem('userFridge', JSON.stringify(fridge));
};

export const removeFromFridge = async (ingredientId: number) => {
  const fridge = (await getUserFridge()).filter(
    (item) => !(item.ingredientId === ingredientId && !item.isCustom)
  );
  await setItem('userFridge', JSON.stringify(fridge));
};

export const updateFridgeItem = async (
  ingredientId: number,
  updates: Partial<Omit<UserFridgeItem, 'ingredientId' | 'addedDate'>>
) => {
  const fridge = (await getUserFridge()).map((item) =>
    item.ingredientId === ingredientId ? { ...item, ...updates } : item
  );
  await setItem('userFridge', JSON.stringify(fridge));
};

export const getFridgeWithDetails = async () => {
  try {
    const fridge = await getUserFridge();
    const ingredients = JSON.parse((await getItem('ingredients')) || '[]');
    const customIngredients = await getCustomIngredients();
    return fridge.map((item) => ({
      ...item,
      ingredient: item.isCustom
        ? customIngredients.find((ing) => ing.id === item.ingredientId)
        : ingredients.find((ing: any) => ing.id === item.ingredientId),
    }));
  } catch (e) {
    console.error('Failed to get fridge with details:', e);
    return [];
  }
};

export const getCustomIngredients = async (): Promise<CustomIngredient[]> => {
  try {
    const data = await getItem('customIngredients');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get custom ingredients:', e);
    return [];
  }
};

export const addCustomIngredient = async (
  name: string,
  category: string = 'custom',
  unit: string = '',
  quantity: number = 1
): Promise<CustomIngredient> => {
  const customIngredients = await getCustomIngredients();
  const newId =
    customIngredients.length > 0 ? Math.max(...customIngredients.map((i) => i.id)) + 1 : 1;
  const newIngredient: CustomIngredient = { id: newId, name, category, unit, quantity };
  customIngredients.push(newIngredient);
  await setItem('customIngredients', JSON.stringify(customIngredients));
  return newIngredient;
};

export const deleteCustomIngredient = async (id: number) => {
  const customIngredients = (await getCustomIngredients()).filter((i) => i.id !== id);
  await setItem('customIngredients', JSON.stringify(customIngredients));
};

export const addCustomToFridge = async (
  ingredientId: number,
  notes?: string,
  customQuantity?: number
) => {
  const fridge = await getUserFridge();
  if (fridge.some((item) => item.ingredientId === ingredientId && item.isCustom)) return;
  fridge.push({
    ingredientId,
    addedDate: new Date().toISOString(),
    notes,
    customQuantity,
    isCustom: true,
  });
  await setItem('userFridge', JSON.stringify(fridge));
};

export const removeCustomFromFridge = async (ingredientId: number) => {
  const fridge = (await getUserFridge()).filter(
    (item) => !(item.ingredientId === ingredientId && item.isCustom)
  );
  await setItem('userFridge', JSON.stringify(fridge));
};

export const findOrCreateCustomIngredient = async (
  name: string,
  unit: string = ''
): Promise<CustomIngredient> => {
  const customIngredients = await getCustomIngredients();
  const existing = customIngredients.find(
    (ing) => ing.name.toLowerCase() === name.toLowerCase().trim()
  );
  if (existing) return existing;
  return await addCustomIngredient(name.trim(), 'custom', unit);
};

export const getUserCollection = async (): Promise<UserCollectionItem[]> => {
  try {
    const data = await getItem('userCollection');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get user collection:', e);
    return [];
  }
};

export const addToCollection = async (recipeId: number, notes?: string) => {
  const collection = await getUserCollection();
  if (collection.some((item) => item.recipeId === recipeId)) return;
  collection.push({
    recipeId,
    addedDate: new Date().toISOString(),
    notes,
    timesCooked: 0,
    includeInShoppingList: true,
  });
  await setItem('userCollection', JSON.stringify(collection));
};

export const removeFromCollection = async (recipeId: number) => {
  const collection = (await getUserCollection()).filter((item) => item.recipeId !== recipeId);
  await setItem('userCollection', JSON.stringify(collection));
};

export const updateCollectionItem = async (
  recipeId: number,
  updates: Partial<Omit<UserCollectionItem, 'recipeId' | 'addedDate'>>
) => {
  const collection = (await getUserCollection()).map((item) =>
    item.recipeId === recipeId ? { ...item, ...updates } : item
  );
  await setItem('userCollection', JSON.stringify(collection));
};

export const getCollectionWithDetails = async () => {
  try {
    const collection = await getUserCollection();
    const recipes = JSON.parse((await getItem('recipes')) || '[]');
    return collection.map((item) => ({
      ...item,
      recipe: recipes.find((rec: any) => rec.id === item.recipeId),
    }));
  } catch (e) {
    console.error('Failed to get collection with details:', e);
    return [];
  }
};

export const getRecipes = async () => {
  try {
    const data = await getItem('recipes');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get recipes:', e);
    return [];
  }
};

export const getIngredients = async () => {
  try {
    const data = await getItem('ingredients');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get ingredients:', e);
    return [];
  }
};

export const getUserRecipes = async (): Promise<UserRecipe[]> => {
  try {
    const data = await getItem('userRecipes');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get user recipes:', e);
    return [];
  }
};

export const addUserRecipe = async (recipe: Omit<UserRecipe, 'id' | 'addedDate'>) => {
  const recipes = await getUserRecipes();
  const newId = recipes.length > 0 ? Math.max(...recipes.map((r) => r.id)) + 1 : 1;
  const newRecipe: UserRecipe = {
    ...recipe,
    id: newId,
    addedDate: new Date().toISOString(),
    includeInShoppingList: true,
  };
  recipes.push(newRecipe);
  await setItem('userRecipes', JSON.stringify(recipes));
  return newRecipe;
};

export const updateUserRecipe = async (
  id: number,
  updates: Partial<Omit<UserRecipe, 'id' | 'addedDate'>>
) => {
  const recipes = await getUserRecipes();
  const updated = recipes.map((r) => (r.id === id ? { ...r, ...updates } : r));
  await setItem('userRecipes', JSON.stringify(updated));
};

export const deleteUserRecipe = async (id: number) => {
  const recipes = (await getUserRecipes()).filter((r) => r.id !== id);
  await setItem('userRecipes', JSON.stringify(recipes));
};
