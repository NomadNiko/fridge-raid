const ingredientImages: { [key: string]: any } = {
  'almond.jpg': require('../assets/ingredient-image/almond.jpg'),
  'apple-cider-vinegar.jpg': require('../assets/ingredient-image/apple-cider-vinegar.jpg'),
  'apple.jpg': require('../assets/ingredient-image/apple.jpg'),
  'asparagus.jpg': require('../assets/ingredient-image/asparagus.jpg'),
  'avacado.jpg': require('../assets/ingredient-image/avacado.jpg'),
  'baking-powder.jpg': require('../assets/ingredient-image/baking-powder.jpg'),
  'black-pepper.jpg': require('../assets/ingredient-image/black-pepper.jpg'),
  'bread.jpg': require('../assets/ingredient-image/bread.jpg'),
  'butter.jpg': require('../assets/ingredient-image/butter.jpg'),
  'cinnamon.jpg': require('../assets/ingredient-image/cinnamon.jpg'),
  'crunchy-peanut-butter.jpg': require('../assets/ingredient-image/crunchy-peanut-butter.jpg'),
  'eggs.jpg': require('../assets/ingredient-image/eggs.jpg'),
  'flour.jpg': require('../assets/ingredient-image/flour.jpg'),
  'heavy-cream.jpg': require('../assets/ingredient-image/heavy-cream.jpg'),
  'maple-syrup.jpg': require('../assets/ingredient-image/maple-syrup.jpg'),
  'milk.jpg': require('../assets/ingredient-image/milk.jpg'),
  'peanut-butter.jpg': require('../assets/ingredient-image/peanut-butter.jpg'),
  'peanuts.jpg': require('../assets/ingredient-image/peanuts.jpg'),
  'powdered-sugar.jpg': require('../assets/ingredient-image/powdered-sugar.jpg'),
  'salt.jpg': require('../assets/ingredient-image/salt.jpg'),
  'salted-butter.jpg': require('../assets/ingredient-image/salted-butter.jpg'),
  'sugar.jpg': require('../assets/ingredient-image/sugar.jpg'),
  'vanilla-extract.jpg': require('../assets/ingredient-image/vanilla-extract.jpg'),
  'water.jpg': require('../assets/ingredient-image/water.jpg'),
  'white-rice.jpg': require('../assets/ingredient-image/white-rice.jpg'),
  'yeast.jpg': require('../assets/ingredient-image/yeast.jpg'),
};

export const getIngredientImage = (filename: string) => {
  return ingredientImages[filename] || null;
};
