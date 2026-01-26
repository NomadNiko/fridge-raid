export type Recipe = {
  id: number;
  name: string;
  description: string;
  cuisine: string;
  category: string;
  difficulty: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  rating: number;
  images: string[];
  ingredients: {
    name: string;
    amount: number;
    unit: string;
    preparation: string | null;
    optional: boolean;
  }[];
  instructions: { step: number; text: string; time: number; equipment: string[] }[];
  equipment: { id: string; name: string; required: boolean; alternatives: string[] }[];
  tags: string[];
  dietaryInfo: { vegetarian: boolean; vegan: boolean; glutenFree: boolean; dairyFree: boolean };
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
};
