import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getRecipes,
  getUserRecipes,
  addUserRecipe,
  deleteUserRecipe,
  updateUserRecipe,
  UserRecipe,
  getFridgeWithDetails,
  getCollectionWithDetails,
  addToCollection,
  removeFromCollection,
  getUserCollection,
  updateCollectionItem,
} from '../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import RecipeDetailModal from '../components/RecipeDetailModal';
import RecipeScannerModal from '../components/RecipeScannerModal';
import UrlImportModal from '../components/UrlImportModal';
import { Recipe } from '../types';
import { Ingredient } from '../types/ingredient';
import { hasIngredient, isSpiceOrHerb, isKeyIngredient } from '../lib/ingredientMatcher';
import { ingredientsData } from '../lib/data/ingredients';
import { getRecipeImage } from '../lib/images';
import { UnitSystem, getUnitSystem, convertUnit } from '../lib/unitConversion';
import { useRevenueCat } from '../lib/revenueCat';

const ITEMS_PER_PAGE = 10;
const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3];

const computeRecipeSuggestions = (
  recipesNotInCollection: Recipe[],
  fridgeIngs: Parameters<typeof hasIngredient>[1]
) => {
  const recipesWithMissing = recipesNotInCollection.map((recipe: Recipe) => {
    const haveCount = recipe.ingredients.filter((ing: { name: string }) =>
      hasIngredient(ing.name, fridgeIngs)
    ).length;
    const missingCount = recipe.ingredients.filter(
      (ing: { name: string }) =>
        !hasIngredient(ing.name, fridgeIngs) &&
        !isSpiceOrHerb(ing.name, ingredientsData)
    ).length;
    // Count matched key ingredients (meat, seafood, produce) for priority sorting
    const keyMatchCount = recipe.ingredients.filter(
      (ing: { name: string }) =>
        hasIngredient(ing.name, fridgeIngs) &&
        isKeyIngredient(ing.name, ingredientsData)
    ).length;
    return { recipe, haveCount, missingCount, keyMatchCount };
  });

  return recipesWithMissing
    .filter((item: any) => item.haveCount > 0)
    .sort((a: any, b: any) => {
      // Prioritize recipes matching key ingredients (meat, seafood, produce)
      if (b.keyMatchCount !== a.keyMatchCount) return b.keyMatchCount - a.keyMatchCount;
      return a.missingCount - b.missingCount;
    })
    .slice(0, 50);
};

// Parse fraction strings (like "½", "1/2", "1 ½") to decimal numbers
const parseFractionAmount = (amount: string): number => {
  if (!amount || !amount.trim()) return 0;

  const str = amount.trim();

  // Unicode fraction map
  const unicodeFractions: Record<string, number> = {
    '½': 0.5,
    '⅓': 1 / 3,
    '⅔': 2 / 3,
    '¼': 0.25,
    '¾': 0.75,
    '⅕': 0.2,
    '⅖': 0.4,
    '⅗': 0.6,
    '⅘': 0.8,
    '⅙': 1 / 6,
    '⅚': 5 / 6,
    '⅐': 1 / 7,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
    '⅑': 1 / 9,
    '⅒': 0.1,
  };

  // Check for standalone unicode fraction
  if (unicodeFractions[str] !== undefined) {
    return unicodeFractions[str];
  }

  // Check for mixed number with unicode fraction (e.g., "1 ½" or "1½")
  for (const [frac, val] of Object.entries(unicodeFractions)) {
    if (str.includes(frac)) {
      const wholePart = str.replace(frac, '').trim();
      const wholeNum = wholePart ? parseFloat(wholePart) : 0;
      if (!isNaN(wholeNum)) {
        return wholeNum + val;
      }
    }
  }

  // Check for slash fraction (e.g., "1/2", "3/4")
  const slashMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    const num = parseFloat(slashMatch[1]);
    const denom = parseFloat(slashMatch[2]);
    if (denom !== 0) return num / denom;
  }

  // Check for mixed number with slash fraction (e.g., "1 1/2")
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    if (denom !== 0) return whole + num / denom;
  }

  // Fall back to parseFloat for regular numbers
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toString();
};

export default function Cookbook() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [recipes, setRecipes] = useState<UserRecipe[]>([]);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<any[]>([]);
  const [fridgeIngredients, setFridgeIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('original');
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeMultiplier, setSelectedRecipeMultiplier] = useState(1);
  const [selectedRecipeSource, setSelectedRecipeSource] = useState<{
    type: 'cookbook' | 'collection';
    id: number;
  } | null>(null);
  const [cookbookExpanded, setCookbookExpanded] = useState(true);
  const [collectionExpanded, setCollectionExpanded] = useState(true);
  const [suggestedExpanded, setSuggestedExpanded] = useState(true);
  const [suggestedFiltersVisible, setSuggestedFiltersVisible] = useState(false);
  const [suggestedCuisine, setSuggestedCuisine] = useState<string | null>(null);
  const [suggestedMealType, setSuggestedMealType] = useState<string | null>(null);
  const [cookbookPage, setCookbookPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [suggestedPage, setSuggestedPage] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);
  const cookbookHeaderRef = useRef<View>(null);
  const collectionHeaderRef = useRef<View>(null);
  const suggestedHeaderRef = useRef<View>(null);
  const toggleInProgress = useRef<Set<number>>(new Set());
  const { isPremium, presentPaywallIfNeeded } = useRevenueCat();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<
    { name: string; amount: string; unit: string; preparation?: string }[]
  >([{ name: '', amount: '', unit: '' }]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [category, setCategory] = useState('');
  const [, setMealType] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setCookbookPage(1);
    setCollectionPage(1);
    setSuggestedPage(1);
    const [userRecipes, fridge, collection, allRecipes, savedUnitSystem] = await Promise.all([
      getUserRecipes(),
      getFridgeWithDetails(),
      getCollectionWithDetails(),
      getRecipes(),
      getUnitSystem(),
    ]);
    setRecipes(userRecipes);
    setUserCollection(collection);
    setUnitSystemState(savedUnitSystem);

    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setFridgeIngredients(fridgeIngs);

    // Build suggested recipes (not in collection)
    const collectionRecipeIds = collection.map((item) => item.recipeId);
    const recipesNotInCollection = allRecipes.filter(
      (recipe: Recipe) => !collectionRecipeIds.includes(recipe.id)
    );

    setSuggestedRecipes(computeRecipeSuggestions(recipesNotInCollection, fridgeIngs));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setName('');
    setDescription('');
    setIngredients([{ name: '', amount: '', unit: '' }]);
    setInstructions(['']);
    setPrepTime('');
    setCookTime('');
    setServings('');
    setCuisine('');
    setCategory('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Recipe name is required');
      return;
    }

    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validInstructions = instructions.filter((i) => i.trim());

    if (validIngredients.length === 0) {
      Alert.alert('Error', 'At least one ingredient is required');
      return;
    }

    if (validInstructions.length === 0) {
      Alert.alert('Error', 'At least one instruction is required');
      return;
    }

    await addUserRecipe({
      name: name.trim(),
      description: description.trim() || undefined,
      ingredients: validIngredients.map((i) => ({
        name: i.name.trim(),
        amount: parseFractionAmount(i.amount),
        unit: i.unit.trim(),
      })),
      instructions: validInstructions.map((text, idx) => ({
        step: idx + 1,
        text: text.trim(),
      })),
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      servings: servings ? parseInt(servings) : undefined,
      cuisine: cuisine.trim() || undefined,
      category: category.trim() || undefined,
    });

    resetForm();
    setShowForm(false);
    loadData();
  };

  const handleDeleteCookbookRecipe = (id: number, recipeName: string) => {
    Alert.alert('Delete Recipe', `Are you sure you want to delete "${recipeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUserRecipe(id);
          loadData();
        },
      },
    ]);
  };

  const convertToRecipe = (userRecipe: UserRecipe): Recipe => ({
    id: userRecipe.id,
    name: userRecipe.name,
    description: userRecipe.description || '',
    cuisine: userRecipe.cuisine || 'Custom',
    category: userRecipe.category || 'other',
    difficulty: 'easy',
    servings: userRecipe.servings || 1,
    prepTime: userRecipe.prepTime || 0,
    cookTime: userRecipe.cookTime || 0,
    totalTime: (userRecipe.prepTime || 0) + (userRecipe.cookTime || 0),
    images: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ingredients: userRecipe.ingredients.map((ing) => ({
      ...ing,
      preparation: null,
      optional: false,
      images: [],
    })),
    instructions: userRecipe.instructions.map((inst) => ({
      ...inst,
      time: 0,
      equipment: [],
      images: [],
    })),
    equipment: [],
    tags: [],
    dietaryInfo: { vegetarian: false, vegan: false, glutenFree: false, dairyFree: false },
    rating: 5,
  });

  const handleToggleCookbookShoppingList = async (id: number) => {
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      await updateUserRecipe(id, { includeInShoppingList: !recipe.includeInShoppingList });
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, includeInShoppingList: !r.includeInShoppingList } : r
        )
      );
    }
  };

  const handleCookbookMultiplierChange = async (id: number, multiplier: number) => {
    await updateUserRecipe(id, { multiplier });
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, multiplier } : r)));
  };

  const handleCollectionMultiplierChange = async (recipeId: number, multiplier: number) => {
    await updateCollectionItem(recipeId, { multiplier });
    setUserCollection((prev) =>
      prev.map((item) => (item.recipeId === recipeId ? { ...item, multiplier } : item))
    );
  };

  const isInCollection = useCallback(
    (recipeId: number) => userCollection.some((item) => item.recipeId === recipeId),
    [userCollection]
  );

  const toggleCollection = useCallback(async (recipeId: number) => {
    if (toggleInProgress.current.has(recipeId)) return;
    toggleInProgress.current.add(recipeId);
    try {
      const currentCollection = await getUserCollection();
      if (currentCollection.some((item: any) => item.recipeId === recipeId)) {
        await removeFromCollection(recipeId);
      } else {
        await addToCollection(recipeId);
      }

      const [collection, allRecipes, fridge] = await Promise.all([
        getCollectionWithDetails(),
        getRecipes(),
        getFridgeWithDetails(),
      ]);
      setUserCollection(collection);

      const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
      setFridgeIngredients(fridgeIngs);

      const collectionRecipeIds = collection.map((item) => item.recipeId);
      const recipesNotInCollection = allRecipes.filter(
        (recipe: Recipe) => !collectionRecipeIds.includes(recipe.id)
      );

      setSuggestedRecipes(computeRecipeSuggestions(recipesNotInCollection, fridgeIngs));
    } finally {
      toggleInProgress.current.delete(recipeId);
    }
  }, []);

  const handleRecipeScanned = (scannedRecipe: {
    name: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string; preparation?: string }[];
    instructions: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    cuisine: string;
    category: string;
    mealType: string;
  }) => {
    setName(scannedRecipe.name);
    setDescription(scannedRecipe.description);
    setIngredients(
      scannedRecipe.ingredients.length > 0
        ? scannedRecipe.ingredients
        : [{ name: '', amount: '', unit: '' }]
    );
    setInstructions(scannedRecipe.instructions.length > 0 ? scannedRecipe.instructions : ['']);
    setPrepTime(scannedRecipe.prepTime);
    setCookTime(scannedRecipe.cookTime);
    setServings(scannedRecipe.servings);
    setCuisine(scannedRecipe.cuisine);
    setCategory(scannedRecipe.category);
    setMealType(scannedRecipe.mealType);
    setShowForm(true);
  };

  const handleRecipeAdded = async (scannedRecipe: {
    name: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string; preparation?: string }[];
    instructions: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    cuisine: string;
    category: string;
    mealType: string;
  }) => {
    const validIngredients = scannedRecipe.ingredients.filter((i) => i.name.trim());
    const validInstructions = scannedRecipe.instructions.filter((i) => i.trim());

    if (
      !scannedRecipe.name.trim() ||
      validIngredients.length === 0 ||
      validInstructions.length === 0
    ) {
      Alert.alert(
        'Error',
        'Recipe must have a name, at least one ingredient, and at least one instruction'
      );
      return;
    }

    await addUserRecipe({
      name: scannedRecipe.name.trim(),
      description: scannedRecipe.description.trim() || undefined,
      ingredients: validIngredients.map((i) => ({
        name: i.name.trim(),
        amount: parseFractionAmount(i.amount),
        unit: i.unit.trim(),
      })),
      instructions: validInstructions.map((text, idx) => ({
        step: idx + 1,
        text: text.trim(),
      })),
      prepTime: scannedRecipe.prepTime ? parseInt(scannedRecipe.prepTime) : undefined,
      cookTime: scannedRecipe.cookTime ? parseInt(scannedRecipe.cookTime) : undefined,
      servings: scannedRecipe.servings ? parseInt(scannedRecipe.servings) : undefined,
      cuisine: scannedRecipe.cuisine.trim() || undefined,
      category: scannedRecipe.category.trim() || undefined,
    });

    loadData();
  };

  const scrollToRef = (ref: React.RefObject<View | null>) => {
    setTimeout(() => {
      ref.current?.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({ y, animated: true });
        },
        () => {}
      );
    }, 100);
  };

  const renderCollectionCard = useCallback(
    (recipe: Recipe, missingCount: number, collectionItem: any) => (
      <View
        key={recipe.id}
        style={{
          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}>
        <View style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 4,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 18,
                fontWeight: '600',
                flex: 1,
              }}>
              {recipe.name}
            </Text>
            {collectionItem && (
              <TouchableOpacity
                onPress={async () => {
                  const newValue = collectionItem.includeInShoppingList === false;
                  await updateCollectionItem(recipe.id, {
                    includeInShoppingList: newValue,
                  });
                  setUserCollection((prev) =>
                    prev.map((item) =>
                      item.recipeId === recipe.id
                        ? { ...item, includeInShoppingList: newValue }
                        : item
                    )
                  );
                }}
                accessible={true}
                accessibilityLabel={`${collectionItem.includeInShoppingList === false ? 'Include' : 'Exclude'} ${recipe.name} in shopping list`}
                accessibilityRole="button"
                style={{
                  backgroundColor:
                    collectionItem.includeInShoppingList === false
                      ? isDark
                        ? '#2c2c2e'
                        : '#e5e5ea'
                      : '#34c759',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  marginLeft: 8,
                }}>
                <Ionicons
                  name={collectionItem.includeInShoppingList === false ? 'cart-outline' : 'cart'}
                  size={18}
                  color={
                    collectionItem.includeInShoppingList === false
                      ? isDark
                        ? '#8e8e93'
                        : '#636366'
                      : '#ffffff'
                  }
                />
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14, marginBottom: 8 }}>
            {recipe.cuisine}
            {recipe.mealType ? ` • ${recipe.mealType}` : ''} • {recipe.difficulty} •{' '}
            {recipe.totalTime} min
          </Text>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14, marginBottom: 8 }}>
            {missingCount === 0
              ? '✓ You have all ingredients!'
              : `Missing ${missingCount} ingredient${missingCount > 1 ? 's' : ''}`}
          </Text>
          {collectionItem && (
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {MULTIPLIER_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => handleCollectionMultiplierChange(recipe.id, m)}
                  style={{
                    backgroundColor:
                      (collectionItem.multiplier ?? 1) === m
                        ? '#007aff'
                        : isDark
                          ? '#2c2c2e'
                          : '#e5e5ea',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                  <Text
                    style={{
                      color:
                        (collectionItem.multiplier ?? 1) === m
                          ? '#ffffff'
                          : isDark
                            ? '#ffffff'
                            : '#000000',
                      fontSize: 13,
                      fontWeight: '600',
                    }}>
                    {m}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {(() => {
          const mult = collectionItem?.multiplier ?? 1;
          return (
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: isDark ? '#ffffff' : '#000000',
                    fontSize: 14,
                    fontWeight: '600',
                    marginBottom: 4,
                  }}>
                  Ingredients:
                </Text>
                {recipe.ingredients.map(
                  (ing: { name: string; amount: number; unit: string }, idx: number) => {
                    const hasIng = hasIngredient(ing.name, fridgeIngredients);
                    const displayAmount = ing.amount ? ing.amount * mult : 0;
                    const converted = convertUnit(displayAmount, ing.unit, unitSystem);
                    return (
                      <View
                        key={idx}
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        {!hasIng && (
                          <Ionicons
                            name="close"
                            size={14}
                            color="#ff3b30"
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text
                          style={{
                            color: hasIng ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                            fontSize: 13,
                            fontStyle: hasIng ? 'normal' : 'italic',
                          }}>
                          {converted.amount ? `${formatAmount(converted.amount)} ` : ''}
                          {converted.unit && converted.unit !== 'whole' ? `${converted.unit} ` : ''}
                          {ing.name}
                        </Text>
                      </View>
                    );
                  }
                )}
              </View>
              {recipe.images &&
                recipe.images.length > 0 &&
                (() => {
                  const imageSource = getRecipeImage(recipe.images[0]);
                  return imageSource ? (
                    <Image
                      source={imageSource}
                      style={{ width: 100, height: 100, borderRadius: 8, marginLeft: 12 }}
                      resizeMode="cover"
                    />
                  ) : null;
                })()}
            </View>
          );
        })()}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setSelectedRecipe(recipe);
              setSelectedRecipeMultiplier(collectionItem?.multiplier ?? 1);
              setSelectedRecipeSource(
                collectionItem ? { type: 'collection', id: recipe.id } : null
              );
            }}
            accessible={true}
            accessibilityLabel={`View ${recipe.name} recipe details`}
            accessibilityRole="button"
            style={{
              flex: 1,
              backgroundColor: '#007aff',
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleCollection(recipe.id)}
            accessible={true}
            accessibilityLabel={
              isInCollection(recipe.id)
                ? `Remove ${recipe.name} from collection`
                : `Add ${recipe.name} to collection`
            }
            accessibilityRole="button"
            style={{
              flex: 1,
              backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontWeight: '600',
              }}>
              {isInCollection(recipe.id) ? 'Remove' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [isDark, fridgeIngredients, isInCollection, toggleCollection, unitSystem]
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? '#000000' : '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  if (showForm) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={75}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 400 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text
              style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 22, fontWeight: '600' }}>
              Add Recipe
            </Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(false);
              }}>
              <Ionicons name="close" size={28} color={isDark ? '#ffffff' : '#000000'} />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
            }}>
            Recipe Name *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Grandma's Apple Pie"
            placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              color: isDark ? '#ffffff' : '#000000',
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          />

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
            }}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description..."
            placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              color: isDark ? '#ffffff' : '#000000',
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 4 }}>
                Prep (min)
              </Text>
              <TextInput
                value={prepTime}
                onChangeText={setPrepTime}
                placeholder="15"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                keyboardType="numeric"
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 4 }}>
                Cook (min)
              </Text>
              <TextInput
                value={cookTime}
                onChangeText={setCookTime}
                placeholder="30"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                keyboardType="numeric"
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 4 }}>
                Servings
              </Text>
              <TextInput
                value={servings}
                onChangeText={setServings}
                placeholder="4"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                keyboardType="numeric"
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 4 }}>
                Cuisine
              </Text>
              <TextInput
                value={cuisine}
                onChangeText={setCuisine}
                placeholder="Italian"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 4 }}>
                Category
              </Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Dessert"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                }}
              />
            </View>
          </View>

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
            }}>
            Ingredients *
          </Text>
          {ingredients.map((ing, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput
                value={ing.amount}
                onChangeText={(text) => {
                  const updated = [...ingredients];
                  updated[idx].amount = text;
                  setIngredients(updated);
                }}
                placeholder="1"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                keyboardType="numeric"
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                  width: 60,
                }}
              />
              <TextInput
                value={ing.unit}
                onChangeText={(text) => {
                  const updated = [...ingredients];
                  updated[idx].unit = text;
                  setIngredients(updated);
                }}
                placeholder="cup"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                  width: 80,
                }}
              />
              <TextInput
                value={ing.name}
                onChangeText={(text) => {
                  const updated = [...ingredients];
                  updated[idx].name = text;
                  setIngredients(updated);
                }}
                placeholder="flour"
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                  flex: 1,
                }}
              />
              {ingredients.length > 1 && (
                <TouchableOpacity
                  onPress={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                  style={{ justifyContent: 'center' }}>
                  <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setIngredients([...ingredients, { name: '', amount: '', unit: '' }])}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 16,
            }}>
            <Text style={{ color: '#007aff', fontWeight: '600' }}>+ Add Ingredient</Text>
          </TouchableOpacity>

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
            }}>
            Instructions *
          </Text>
          {instructions.map((inst, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Text style={{ color: isDark ? '#ffffff' : '#000000', paddingTop: 12, width: 30 }}>
                {idx + 1}.
              </Text>
              <TextInput
                value={inst}
                onChangeText={(text) => {
                  const updated = [...instructions];
                  updated[idx] = text;
                  setInstructions(updated);
                }}
                placeholder="Add instruction..."
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                multiline
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  padding: 12,
                  borderRadius: 8,
                  flex: 1,
                  textAlignVertical: 'top',
                }}
              />
              {instructions.length > 1 && (
                <TouchableOpacity
                  onPress={() => setInstructions(instructions.filter((_, i) => i !== idx))}
                  style={{ justifyContent: 'center' }}>
                  <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setInstructions([...instructions, ''])}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              padding: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 24,
            }}>
            <Text style={{ color: '#007aff', fontWeight: '600' }}>+ Add Step</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={{
              backgroundColor: '#007aff',
              padding: 16,
              borderRadius: 8,
              alignItems: 'center',
              marginBottom: 16,
            }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Save Recipe</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const collectionItems = userCollection.filter((item) => item.recipe);
  const cookbookTotalPages = Math.ceil(recipes.length / ITEMS_PER_PAGE);
  const collectionTotalPages = Math.ceil(collectionItems.length / ITEMS_PER_PAGE);

  const filteredSuggestedRecipes = suggestedRecipes.filter((item: any) => {
    if (suggestedCuisine && item.recipe.cuisine !== suggestedCuisine) return false;
    if (suggestedMealType && item.recipe.mealType !== suggestedMealType) return false;
    return true;
  });
  const suggestedCuisines = Array.from(new Set(suggestedRecipes.map((item: any) => item.recipe.cuisine))).sort() as string[];
  const suggestedMealTypes = Array.from(new Set(suggestedRecipes.map((item: any) => item.recipe.mealType).filter(Boolean))).sort() as string[];
  const suggestedTotalPages = Math.ceil(filteredSuggestedRecipes.length / ITEMS_PER_PAGE);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16 }}>
        {/* Add Recipe Buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={async () => {
              if (isPremium) {
                setShowUrlImport(true);
              } else {
                const purchased = await presentPaywallIfNeeded();
                if (purchased) setShowUrlImport(true);
              }
            }}
            accessible={true}
            accessibilityLabel="Import recipe from URL"
            accessibilityRole="button"
            style={{
              flex: 1,
              backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Ionicons name="link" size={18} color={isDark ? '#ffffff' : '#000000'} />
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontWeight: '600' }}>
              URL
            </Text>
            {!isPremium && <Ionicons name="lock-closed" size={14} color="#ff9500" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              if (isPremium) {
                setShowScanner(true);
              } else {
                const purchased = await presentPaywallIfNeeded();
                if (purchased) setShowScanner(true);
              }
            }}
            accessible={true}
            accessibilityLabel="Scan a recipe with camera"
            accessibilityRole="button"
            style={{
              flex: 1,
              backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Ionicons name="camera" size={18} color={isDark ? '#ffffff' : '#000000'} />
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontWeight: '600' }}>
              Scan
            </Text>
            {!isPremium && <Ionicons name="lock-closed" size={14} color="#ff9500" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            accessible={true}
            accessibilityLabel="Add recipe manually"
            accessibilityRole="button"
            style={{
              flex: 1,
              backgroundColor: '#007aff',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* My Cookbook Section */}
        <View ref={cookbookHeaderRef} style={{ marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setCookbookExpanded(!cookbookExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 22,
                fontWeight: '600',
              }}>
              My Cookbook ({recipes.length})
            </Text>
            <Ionicons
              name={cookbookExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>

        {cookbookExpanded && (
          <>
            {recipes.length === 0 ? (
              <View style={{ alignItems: 'center', marginVertical: 40 }}>
                <Ionicons name="book-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
                <Text
                  style={{
                    color: isDark ? '#8e8e93' : '#636366',
                    textAlign: 'center',
                    marginTop: 16,
                    fontSize: 16,
                  }}>
                  No recipes in your cookbook yet
                </Text>
              </View>
            ) : (
              <>
                {recipes
                  .slice((cookbookPage - 1) * ITEMS_PER_PAGE, cookbookPage * ITEMS_PER_PAGE)
                  .map((recipe) => {
                    const recipeObj = convertToRecipe(recipe);
                    const missingCount = recipeObj.ingredients.filter(
                      (ing: { name: string }) =>
                        !hasIngredient(ing.name, fridgeIngredients) &&
                        !isSpiceOrHerb(ing.name, ingredientsData)
                    ).length;
                    return (
                      <View
                        key={recipe.id}
                        style={{
                          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 12,
                        }}>
                        <View style={{ marginBottom: 12 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: 4,
                            }}>
                            <Text
                              style={{
                                color: isDark ? '#ffffff' : '#000000',
                                fontSize: 18,
                                fontWeight: '600',
                                flex: 1,
                              }}>
                              {recipeObj.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleToggleCookbookShoppingList(recipe.id)}
                              accessible={true}
                              accessibilityLabel={`${recipe.includeInShoppingList === false ? 'Include' : 'Exclude'} ${recipeObj.name} in shopping list`}
                              accessibilityRole="button"
                              style={{
                                backgroundColor:
                                  recipe.includeInShoppingList === false
                                    ? isDark
                                      ? '#2c2c2e'
                                      : '#e5e5ea'
                                    : '#34c759',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                marginLeft: 8,
                              }}>
                              <Ionicons
                                name={
                                  recipe.includeInShoppingList === false ? 'cart-outline' : 'cart'
                                }
                                size={18}
                                color={
                                  recipe.includeInShoppingList === false
                                    ? isDark
                                      ? '#8e8e93'
                                      : '#636366'
                                    : '#ffffff'
                                }
                              />
                            </TouchableOpacity>
                          </View>
                          <Text
                            style={{
                              color: isDark ? '#8e8e93' : '#636366',
                              fontSize: 14,
                              marginBottom: 8,
                            }}>
                            {recipeObj.cuisine} • {recipeObj.difficulty} • {recipeObj.totalTime} min
                          </Text>
                          <Text
                            style={{
                              color: isDark ? '#8e8e93' : '#636366',
                              fontSize: 14,
                              marginBottom: 8,
                            }}>
                            {missingCount === 0
                              ? '✓ You have all ingredients!'
                              : `Missing ${missingCount} ingredient${missingCount > 1 ? 's' : ''}`}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              gap: 4,
                              marginBottom: 8,
                              flexWrap: 'wrap',
                            }}>
                            {MULTIPLIER_OPTIONS.map((m) => (
                              <TouchableOpacity
                                key={m}
                                onPress={() => handleCookbookMultiplierChange(recipe.id, m)}
                                style={{
                                  backgroundColor:
                                    (recipe.multiplier ?? 1) === m
                                      ? '#007aff'
                                      : isDark
                                        ? '#2c2c2e'
                                        : '#e5e5ea',
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 12,
                                }}>
                                <Text
                                  style={{
                                    color:
                                      (recipe.multiplier ?? 1) === m
                                        ? '#ffffff'
                                        : isDark
                                          ? '#ffffff'
                                          : '#000000',
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}>
                                  {m}x
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {(() => {
                          const mult = recipe.multiplier ?? 1;
                          return (
                            <View style={{ marginBottom: 12 }}>
                              <Text
                                style={{
                                  color: isDark ? '#ffffff' : '#000000',
                                  fontSize: 14,
                                  fontWeight: '600',
                                  marginBottom: 4,
                                }}>
                                Ingredients:
                              </Text>
                              {recipeObj.ingredients.map(
                                (
                                  ing: {
                                    name: string;
                                    amount: number;
                                    unit: string;
                                    preparation?: string | null;
                                  },
                                  idx: number
                                ) => {
                                  const hasIng = hasIngredient(ing.name, fridgeIngredients);
                                  const displayAmount = ing.amount ? ing.amount * mult : 0;
                                  const converted = convertUnit(
                                    displayAmount,
                                    ing.unit,
                                    unitSystem
                                  );
                                  return (
                                    <View
                                      key={idx}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 2,
                                      }}>
                                      {!hasIng && (
                                        <Ionicons
                                          name="close"
                                          size={14}
                                          color="#ff3b30"
                                          style={{ marginRight: 4 }}
                                        />
                                      )}
                                      <Text
                                        style={{
                                          color: hasIng
                                            ? isDark
                                              ? '#ffffff'
                                              : '#000000'
                                            : '#ff3b30',
                                          fontSize: 13,
                                          fontStyle: hasIng ? 'normal' : 'italic',
                                        }}>
                                        {converted.amount
                                          ? `${formatAmount(converted.amount)} `
                                          : ''}
                                        {converted.unit && converted.unit !== 'whole'
                                          ? `${converted.unit} `
                                          : ''}
                                        {ing.name}
                                        {ing.preparation && `, ${ing.preparation}`}
                                      </Text>
                                    </View>
                                  );
                                }
                              )}
                            </View>
                          );
                        })()}

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedRecipe(recipeObj);
                              setSelectedRecipeMultiplier(recipe.multiplier ?? 1);
                              setSelectedRecipeSource({ type: 'cookbook', id: recipe.id });
                            }}
                            accessible={true}
                            accessibilityLabel={`View ${recipeObj.name} recipe details`}
                            accessibilityRole="button"
                            style={{
                              flex: 1,
                              backgroundColor: '#007aff',
                              paddingVertical: 10,
                              borderRadius: 8,
                              alignItems: 'center',
                            }}>
                            <Text style={{ color: '#ffffff', fontWeight: '600' }}>View</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteCookbookRecipe(recipe.id, recipe.name)}
                            accessible={true}
                            accessibilityLabel={`Delete ${recipeObj.name}`}
                            accessibilityRole="button"
                            style={{
                              flex: 1,
                              backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
                              paddingVertical: 10,
                              borderRadius: 8,
                              alignItems: 'center',
                            }}>
                            <Text style={{ color: '#ff3b30', fontWeight: '600' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                {cookbookTotalPages > 1 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 16,
                    }}>
                    <TouchableOpacity
                      onPress={() => {
                        setCookbookPage((p) => Math.max(1, p - 1));
                        scrollToRef(cookbookHeaderRef);
                      }}
                      disabled={cookbookPage === 1}
                      style={{
                        backgroundColor:
                          cookbookPage === 1 ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        opacity: cookbookPage === 1 ? 0.5 : 1,
                      }}>
                      <Text
                        style={{
                          color: cookbookPage === 1 ? (isDark ? '#8e8e93' : '#636366') : '#ffffff',
                          fontWeight: '600',
                        }}>
                        Previous
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {cookbookPage} / {cookbookTotalPages}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setCookbookPage((p) => Math.min(cookbookTotalPages, p + 1));
                        scrollToRef(cookbookHeaderRef);
                      }}
                      disabled={cookbookPage === cookbookTotalPages}
                      style={{
                        backgroundColor:
                          cookbookPage === cookbookTotalPages
                            ? isDark
                              ? '#1c1c1e'
                              : '#f2f2f7'
                            : '#007aff',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        opacity: cookbookPage === cookbookTotalPages ? 0.5 : 1,
                      }}>
                      <Text
                        style={{
                          color:
                            cookbookPage === cookbookTotalPages
                              ? isDark
                                ? '#8e8e93'
                                : '#636366'
                              : '#ffffff',
                          fontWeight: '600',
                        }}>
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* My Collection Section */}
        <View ref={collectionHeaderRef}>
          <TouchableOpacity
            onPress={() => setCollectionExpanded(!collectionExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 24,
              marginBottom: 12,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 22,
                fontWeight: '600',
              }}>
              My Collection ({collectionItems.length})
            </Text>
            <Ionicons
              name={collectionExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>
        {collectionExpanded &&
          (collectionItems.length === 0 ? (
            <View style={{ alignItems: 'center', marginVertical: 40 }}>
              <Ionicons name="bookmark-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
              <Text
                style={{
                  color: isDark ? '#8e8e93' : '#636366',
                  textAlign: 'center',
                  marginTop: 16,
                  fontSize: 16,
                }}>
                No recipes in your collection yet
              </Text>
            </View>
          ) : (
            <>
              {collectionItems
                .slice((collectionPage - 1) * ITEMS_PER_PAGE, collectionPage * ITEMS_PER_PAGE)
                .map((item) => {
                  const recipe = item.recipe;
                  if (!recipe) return null;
                  const missingCount = recipe.ingredients.filter(
                    (ing: { name: string }) =>
                      !hasIngredient(ing.name, fridgeIngredients) &&
                      !isSpiceOrHerb(ing.name, ingredientsData)
                  ).length;
                  return renderCollectionCard(recipe, missingCount, item);
                })}
              {collectionTotalPages > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 16,
                  }}>
                  <TouchableOpacity
                    onPress={() => {
                      setCollectionPage((p) => Math.max(1, p - 1));
                      scrollToRef(collectionHeaderRef);
                    }}
                    disabled={collectionPage === 1}
                    style={{
                      backgroundColor:
                        collectionPage === 1 ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: collectionPage === 1 ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        color: collectionPage === 1 ? (isDark ? '#8e8e93' : '#636366') : '#ffffff',
                        fontWeight: '600',
                      }}>
                      Previous
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {collectionPage} / {collectionTotalPages}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCollectionPage((p) => Math.min(collectionTotalPages, p + 1));
                      scrollToRef(collectionHeaderRef);
                    }}
                    disabled={collectionPage === collectionTotalPages}
                    style={{
                      backgroundColor:
                        collectionPage === collectionTotalPages
                          ? isDark
                            ? '#1c1c1e'
                            : '#f2f2f7'
                          : '#007aff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: collectionPage === collectionTotalPages ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        color:
                          collectionPage === collectionTotalPages
                            ? isDark
                              ? '#8e8e93'
                              : '#636366'
                            : '#ffffff',
                        fontWeight: '600',
                      }}>
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ))}

        {/* Suggested Recipes Section */}
        <View ref={suggestedHeaderRef}>
          <TouchableOpacity
            onPress={() => setSuggestedExpanded(!suggestedExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 24,
              marginBottom: 12,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 22,
                fontWeight: '600',
              }}>
              Suggested Recipes ({filteredSuggestedRecipes.length})
            </Text>
            <Ionicons
              name={suggestedExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>
        {suggestedExpanded &&
          (suggestedRecipes.length === 0 ? (
            <View style={{ alignItems: 'center', marginVertical: 40 }}>
              <Ionicons name="bulb-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
              <Text
                style={{
                  color: isDark ? '#8e8e93' : '#636366',
                  textAlign: 'center',
                  marginTop: 16,
                  fontSize: 16,
                }}>
                Add ingredients to your Fridge
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setSuggestedFiltersVisible(!suggestedFiltersVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  marginBottom: 8,
                }}>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16, fontWeight: '600' }}>
                  Filters
                </Text>
                <Ionicons
                  name={suggestedFiltersVisible ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={isDark ? '#ffffff' : '#000000'}
                />
              </TouchableOpacity>
              {suggestedFiltersVisible && (
                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: isDark ? '#8e8e93' : '#636366',
                      fontSize: 13,
                      fontWeight: '600',
                      marginBottom: 6,
                    }}>
                    Cuisine
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setSuggestedCuisine(null);
                        setSuggestedPage(1);
                      }}
                      style={{
                        backgroundColor: !suggestedCuisine
                          ? '#007aff'
                          : isDark
                            ? '#1c1c1e'
                            : '#f2f2f7',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                      }}>
                      <Text
                        style={{
                          color: !suggestedCuisine ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                          fontSize: 14,
                        }}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {suggestedCuisines.map((cuisine) => (
                      <TouchableOpacity
                        key={cuisine}
                        onPress={() => {
                          setSuggestedCuisine(cuisine);
                          setSuggestedPage(1);
                        }}
                        style={{
                          backgroundColor:
                            suggestedCuisine === cuisine
                              ? '#007aff'
                              : isDark
                                ? '#1c1c1e'
                                : '#f2f2f7',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}>
                        <Text
                          style={{
                            color:
                              suggestedCuisine === cuisine
                                ? '#ffffff'
                                : isDark
                                  ? '#ffffff'
                                  : '#000000',
                            fontSize: 14,
                          }}>
                          {cuisine}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text
                    style={{
                      color: isDark ? '#8e8e93' : '#636366',
                      fontSize: 13,
                      fontWeight: '600',
                      marginBottom: 6,
                    }}>
                    Meal Type
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setSuggestedMealType(null);
                        setSuggestedPage(1);
                      }}
                      style={{
                        backgroundColor: !suggestedMealType
                          ? '#007aff'
                          : isDark
                            ? '#1c1c1e'
                            : '#f2f2f7',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                      }}>
                      <Text
                        style={{
                          color: !suggestedMealType ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                          fontSize: 14,
                        }}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {suggestedMealTypes.map((mealType) => (
                      <TouchableOpacity
                        key={mealType}
                        onPress={() => {
                          setSuggestedMealType(mealType);
                          setSuggestedPage(1);
                        }}
                        style={{
                          backgroundColor:
                            suggestedMealType === mealType
                              ? '#007aff'
                              : isDark
                                ? '#1c1c1e'
                                : '#f2f2f7',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}>
                        <Text
                          style={{
                            color:
                              suggestedMealType === mealType
                                ? '#ffffff'
                                : isDark
                                  ? '#ffffff'
                                  : '#000000',
                            fontSize: 14,
                          }}>
                          {mealType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {filteredSuggestedRecipes
                .slice((suggestedPage - 1) * ITEMS_PER_PAGE, suggestedPage * ITEMS_PER_PAGE)
                .map((item) => renderCollectionCard(item.recipe, item.missingCount, null))}
              {suggestedTotalPages > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 16,
                  }}>
                  <TouchableOpacity
                    onPress={() => {
                      setSuggestedPage((p) => Math.max(1, p - 1));
                      scrollToRef(suggestedHeaderRef);
                    }}
                    disabled={suggestedPage === 1}
                    style={{
                      backgroundColor:
                        suggestedPage === 1 ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: suggestedPage === 1 ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        color: suggestedPage === 1 ? (isDark ? '#8e8e93' : '#636366') : '#ffffff',
                        fontWeight: '600',
                      }}>
                      Previous
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {suggestedPage} / {suggestedTotalPages}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSuggestedPage((p) => Math.min(suggestedTotalPages, p + 1));
                      scrollToRef(suggestedHeaderRef);
                    }}
                    disabled={suggestedPage === suggestedTotalPages}
                    style={{
                      backgroundColor:
                        suggestedPage === suggestedTotalPages
                          ? isDark
                            ? '#1c1c1e'
                            : '#f2f2f7'
                          : '#007aff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: suggestedPage === suggestedTotalPages ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        color:
                          suggestedPage === suggestedTotalPages
                            ? isDark
                              ? '#8e8e93'
                              : '#636366'
                            : '#ffffff',
                        fontWeight: '600',
                      }}>
                      Next
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ))}
      </ScrollView>

      <RecipeDetailModal
        visible={!!selectedRecipe}
        recipe={selectedRecipe}
        isInCollection={selectedRecipe ? isInCollection(selectedRecipe.id) : false}
        onClose={() => {
          setSelectedRecipe(null);
          setSelectedRecipeSource(null);
        }}
        onToggleCollection={() => {
          if (selectedRecipe) {
            if (selectedRecipeSource?.type === 'cookbook') {
              handleDeleteCookbookRecipe(selectedRecipe.id, selectedRecipe.name);
            } else {
              toggleCollection(selectedRecipe.id);
            }
          }
        }}
        hideCollectionButton={selectedRecipeSource?.type === 'cookbook'}
        multiplier={selectedRecipeMultiplier}
        unitSystem={unitSystem}
        onMultiplierChange={(m) => {
          setSelectedRecipeMultiplier(m);
          if (selectedRecipeSource) {
            if (selectedRecipeSource.type === 'cookbook') {
              handleCookbookMultiplierChange(selectedRecipeSource.id, m);
            } else {
              handleCollectionMultiplierChange(selectedRecipeSource.id, m);
            }
          }
        }}
      />

      <RecipeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onRecipeScanned={handleRecipeScanned}
        onRecipeAdded={handleRecipeAdded}
      />

      <UrlImportModal
        visible={showUrlImport}
        onClose={() => setShowUrlImport(false)}
        onRecipeScanned={handleRecipeScanned}
        onRecipeAdded={handleRecipeAdded}
      />
    </View>
  );
}
