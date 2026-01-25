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
};

const getItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  try {
    // console.log(`Setting ${key}, length: ${value.length}`);
    await AsyncStorage.setItem(key, value);
    // const verify = await AsyncStorage.getItem(key);
    // console.log(`Verified ${key}, got back: ${verify ? verify.length : 'null'}`);
  } catch (e) {
    // console.error(`Error setting ${key}:`, e);
  }
};

export const initializeDatabase = async () => {
  // console.log('Initializing database...');
  const keys = await AsyncStorage.getAllKeys();
  // console.log('Existing keys:', keys);
  if (!keys.includes('recipes')) {
    // console.log('Setting recipes data');
    await setItem('recipes', JSON.stringify(recipesData));
  }
  if (!keys.includes('ingredients')) {
    await setItem('ingredients', JSON.stringify(ingredientsData));
  }
  if (!keys.includes('cookware')) {
    await setItem('cookware', JSON.stringify(cookwareData));
  }
  if (!keys.includes('unitConversions')) {
    await setItem('unitConversions', JSON.stringify(unitConversionsData));
  }
  if (!keys.includes('userFridge')) {
    await setItem('userFridge', JSON.stringify([]));
  }
  if (!keys.includes('userCollection')) {
    await setItem('userCollection', JSON.stringify([]));
  }
  // console.log('Database initialized');
};

export const getUserFridge = async (): Promise<UserFridgeItem[]> => {
  const data = await getItem('userFridge');
  return data ? JSON.parse(data) : [];
};

export const addToFridge = async (ingredientId: number, notes?: string, customQuantity?: number) => {
  const fridge = await getUserFridge();
  if (fridge.some((item) => item.ingredientId === ingredientId)) return;
  fridge.push({ ingredientId, addedDate: new Date().toISOString(), notes, customQuantity });
  await setItem('userFridge', JSON.stringify(fridge));
};

export const removeFromFridge = async (ingredientId: number) => {
  const fridge = (await getUserFridge()).filter((item) => item.ingredientId !== ingredientId);
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
  const fridge = await getUserFridge();
  const ingredients = JSON.parse((await getItem('ingredients')) || '[]');
  return fridge.map((item) => ({
    ...item,
    ingredient: ingredients.find((ing: any) => ing.id === item.ingredientId),
  }));
};

export const getUserCollection = async (): Promise<UserCollectionItem[]> => {
  const data = await getItem('userCollection');
  return data ? JSON.parse(data) : [];
};

export const addToCollection = async (recipeId: number, notes?: string) => {
  const collection = await getUserCollection();
  if (collection.some((item) => item.recipeId === recipeId)) return;
  collection.push({ recipeId, addedDate: new Date().toISOString(), notes, timesCooked: 0 });
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
  const collection = await getUserCollection();
  const recipes = JSON.parse((await getItem('recipes')) || '[]');
  return collection.map((item) => ({
    ...item,
    recipe: recipes.find((rec: any) => rec.id === item.recipeId),
  }));
};

export const getRecipes = async () => {
  const data = await getItem('recipes');
  // console.log('getRecipes raw data:', data ? data.substring(0, 100) : 'null');
  const parsed = data ? JSON.parse(data) : [];
  // console.log('getRecipes parsed:', parsed.length, 'recipes');
  return parsed;
};
