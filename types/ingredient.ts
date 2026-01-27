export type Ingredient = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  images?: string[];
  alternativeNames?: string[];
};
