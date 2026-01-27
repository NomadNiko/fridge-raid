const recipeImages: { [key: string]: any } = {
  'classic-grilled-cheese.jpg': require('../assets/recipe-image/classic-grilled-cheese.jpg'),
  'scrambled-eggs.jpg': require('../assets/recipe-image/scrambled-eggs.jpg'),
  'spaghetti-garlic-oil.jpg': require('../assets/recipe-image/spaghetti-garlic-oil.jpg'),
  'honey-garlic-chicken.jpg': require('../assets/recipe-image/honey-garlic-chicken.jpg'),
  'roasted-vegetables.jpg': require('../assets/recipe-image/roasted-vegetables.jpg'),
  'mushroom-omelette.jpg': require('../assets/recipe-image/mushroom-omelette.jpg'),
  'baked-potato.jpg': require('../assets/recipe-image/baked-potato.jpg'),
  'adana-kebab.jpg': require('../assets/recipe-image/adana-kebab.jpg'),
  'air-fryer-egg-rolls.jpg': require('../assets/recipe-image/air-fryer-egg-rolls.jpg'),
  'air-fryer-patatas-bravas.jpg': require('../assets/recipe-image/air-fryer-patatas-bravas.jpg'),
  'ajo-blanco.jpg': require('../assets/recipe-image/ajo-blanco.jpg'),
};

export const getRecipeImage = (filename: string) => {
  return recipeImages[filename] || null;
};
