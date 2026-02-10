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
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getUserRecipes,
  addUserRecipe,
  deleteUserRecipe,
  updateUserRecipe,
  UserRecipe,
  getFridgeWithDetails,
} from '../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import RecipeDetailModal from '../components/RecipeDetailModal';
import RecipeScannerModal from '../components/RecipeScannerModal';
import UrlImportModal from '../components/UrlImportModal';
import { Recipe } from '../types';
import { Ingredient } from '../types/ingredient';
import { hasIngredient } from '../lib/ingredientMatcher';

const ITEMS_PER_PAGE = 10;

// Parse fraction strings (like "½", "1/2", "1 ½") to decimal numbers
const parseFractionAmount = (amount: string): number => {
  if (!amount || !amount.trim()) return 0;

  const str = amount.trim();

  // Unicode fraction map
  const unicodeFractions: Record<string, number> = {
    '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅙': 1/6, '⅚': 5/6, '⅐': 1/7, '⅛': 0.125, '⅜': 0.375,
    '⅝': 0.625, '⅞': 0.875, '⅑': 1/9, '⅒': 0.1,
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
    if (denom !== 0) return whole + (num / denom);
  }

  // Fall back to parseFloat for regular numbers
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3];

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toString();
};

export default function Cookbook() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [recipes, setRecipes] = useState<UserRecipe[]>([]);
  const [fridgeIngredients, setFridgeIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeMultiplier, setSelectedRecipeMultiplier] = useState(1);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);
  const recipesHeaderRef = useRef<View>(null);

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
  const [mealType, setMealType] = useState('');

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    const [userRecipes, fridge] = await Promise.all([getUserRecipes(), getFridgeWithDetails()]);
    setRecipes(userRecipes);
    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setFridgeIngredients(fridgeIngs);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes])
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
    loadRecipes();
  };

  const handleDelete = (id: number, recipeName: string) => {
    Alert.alert('Delete Recipe', `Are you sure you want to delete "${recipeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUserRecipe(id);
          loadRecipes();
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

  const handleToggleShoppingList = async (id: number) => {
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      await updateUserRecipe(id, { includeInShoppingList: !recipe.includeInShoppingList });
      loadRecipes();
    }
  };

  const handleMultiplierChange = async (id: number, multiplier: number) => {
    await updateUserRecipe(id, { multiplier });
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, multiplier } : r)));
  };

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
    // Populate form with scanned data
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
    // Show the form with pre-filled data
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

    if (!scannedRecipe.name.trim() || validIngredients.length === 0 || validInstructions.length === 0) {
      Alert.alert('Error', 'Recipe must have a name, at least one ingredient, and at least one instruction');
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

    loadRecipes();
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16 }}>
        <View ref={recipesHeaderRef} style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 22,
              fontWeight: '600',
              marginBottom: 12,
            }}>
            My Cookbook ({recipes.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowUrlImport(true)}
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
              <Text style={{ color: isDark ? '#ffffff' : '#000000', fontWeight: '600' }}>URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowScanner(true)}
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
              <Text style={{ color: isDark ? '#ffffff' : '#000000', fontWeight: '600' }}>Scan</Text>
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
        </View>

        {recipes.length === 0 ? (
          <View style={{ alignItems: 'center', marginVertical: 60 }}>
            <Ionicons name="book-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
            <Text
              style={{
                color: isDark ? '#8e8e93' : '#636366',
                textAlign: 'center',
                marginTop: 16,
                fontSize: 16,
              }}>
              No recipes yet
            </Text>
            <Text
              style={{
                color: isDark ? '#8e8e93' : '#636366',
                textAlign: 'center',
                marginTop: 4,
                fontSize: 14,
              }}>
              Add your first recipe to get started!
            </Text>
          </View>
        ) : (
          <>
            {recipes
              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
              .map((recipe) => {
              const recipeObj = convertToRecipe(recipe);
              const missingCount = recipeObj.ingredients.filter(
                (ing: { name: string }) => !hasIngredient(ing.name, fridgeIngredients)
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
                        onPress={() => handleToggleShoppingList(recipe.id)}
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
                          name={recipe.includeInShoppingList === false ? 'cart-outline' : 'cart'}
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
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                      {MULTIPLIER_OPTIONS.map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => handleMultiplierChange(recipe.id, m)}
                          style={{
                            backgroundColor: (recipe.multiplier ?? 1) === m ? '#007aff' : isDark ? '#2c2c2e' : '#e5e5ea',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                          }}>
                          <Text style={{
                            color: (recipe.multiplier ?? 1) === m ? '#ffffff' : isDark ? '#ffffff' : '#000000',
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
                        ing: { name: string; amount: number; unit: string; preparation?: string | null },
                        idx: number
                      ) => {
                        const hasIng = hasIngredient(ing.name, fridgeIngredients);
                        const displayAmount = ing.amount ? ing.amount * mult : 0;
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
                              {displayAmount ? `${formatAmount(displayAmount)} ` : ''}{ing.unit && ing.unit !== 'whole' ? `${ing.unit} ` : ''}{ing.name}
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
                        setSelectedRecipeId(recipe.id);
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
                      onPress={() => handleDelete(recipe.id, recipe.name)}
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
            {recipes.length > ITEMS_PER_PAGE && (
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
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setTimeout(() => {
                      recipesHeaderRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y) => {
                          scrollViewRef.current?.scrollTo({ y, animated: true });
                        },
                        () => {}
                      );
                    }, 100);
                  }}
                  disabled={currentPage === 1}
                  style={{
                    backgroundColor:
                      currentPage === 1 ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}>
                  <Text
                    style={{
                      color: currentPage === 1 ? (isDark ? '#8e8e93' : '#636366') : '#ffffff',
                      fontWeight: '600',
                    }}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {currentPage} / {Math.ceil(recipes.length / ITEMS_PER_PAGE)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setCurrentPage((p) => Math.min(Math.ceil(recipes.length / ITEMS_PER_PAGE), p + 1));
                    setTimeout(() => {
                      recipesHeaderRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y) => {
                          scrollViewRef.current?.scrollTo({ y, animated: true });
                        },
                        () => {}
                      );
                    }, 100);
                  }}
                  disabled={currentPage === Math.ceil(recipes.length / ITEMS_PER_PAGE)}
                  style={{
                    backgroundColor:
                      currentPage === Math.ceil(recipes.length / ITEMS_PER_PAGE)
                        ? isDark
                          ? '#1c1c1e'
                          : '#f2f2f7'
                        : '#007aff',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    opacity: currentPage === Math.ceil(recipes.length / ITEMS_PER_PAGE) ? 0.5 : 1,
                  }}>
                  <Text
                    style={{
                      color:
                        currentPage === Math.ceil(recipes.length / ITEMS_PER_PAGE)
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
      </ScrollView>

      <RecipeDetailModal
        visible={!!selectedRecipe}
        recipe={selectedRecipe}
        isInCollection={false}
        onClose={() => {
          setSelectedRecipe(null);
          setSelectedRecipeId(null);
        }}
        onToggleCollection={() => {
          if (selectedRecipe) handleDelete(selectedRecipe.id, selectedRecipe.name);
        }}
        hideCollectionButton={true}
        multiplier={selectedRecipeMultiplier}
        onMultiplierChange={(m) => {
          setSelectedRecipeMultiplier(m);
          if (selectedRecipeId) {
            handleMultiplierChange(selectedRecipeId, m);
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
