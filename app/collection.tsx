import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getRecipes,
  getCollectionWithDetails,
  getFridgeWithDetails,
  addToCollection,
  removeFromCollection,
  getUserCollection,
  updateCollectionItem,
  getUserRecipes,
  updateUserRecipe,
  UserRecipe,
} from '../lib/storage';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { Recipe } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '../types/ingredient';
import { hasIngredient } from '../lib/ingredientMatcher';
import { getRecipeImage } from '../lib/images';
import { UnitSystem, getUnitSystem, convertUnit } from '../lib/unitConversion';

const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3];

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toString();
};

export default function Collection() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeMultiplier, setSelectedRecipeMultiplier] = useState(1);
  const [selectedRecipeSource, setSelectedRecipeSource] = useState<{ type: 'collection' | 'userRecipe'; id: number } | null>(null);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<any[]>([]);
  const [fridgeIngredients, setFridgeIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('original');
  const [collectionExpanded, setCollectionExpanded] = useState(true);
  const [suggestedExpanded, setSuggestedExpanded] = useState(true);
  const [collectionPage, setCollectionPage] = useState(1);
  const [suggestedPage, setSuggestedPage] = useState(1);
  const toggleInProgress = useRef<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const collectionHeaderRef = useRef<View>(null);
  const suggestedHeaderRef = useRef<View>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCollectionPage(1);
    setSuggestedPage(1);
    const [collection, allRecipes, fridge, recipes, savedUnitSystem] = await Promise.all([
      getCollectionWithDetails(),
      getRecipes(),
      getFridgeWithDetails(),
      getUserRecipes(),
      getUnitSystem(),
    ]);
    setUserCollection(collection);
    setUserRecipes(recipes);
    setUnitSystemState(savedUnitSystem);

    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setFridgeIngredients(fridgeIngs);

    const collectionRecipeIds = collection.map((item) => item.recipeId);
    const recipesNotInCollection = allRecipes.filter(
      (recipe: Recipe) => !collectionRecipeIds.includes(recipe.id)
    );

    const recipesWithMissing = recipesNotInCollection.map((recipe: Recipe) => {
      const haveCount = recipe.ingredients.filter((ing: { name: string }) =>
        hasIngredient(ing.name, fridgeIngs)
      ).length;
      const missingCount = recipe.ingredients.filter(
        (ing: { name: string }) => !hasIngredient(ing.name, fridgeIngs)
      ).length;
      return { recipe, haveCount, missingCount };
    });

    const sorted = recipesWithMissing
      .filter((item: any) => item.haveCount > 0)
      .sort((a: any, b: any) => a.missingCount - b.missingCount)
      .slice(0, 50);

    setSuggestedRecipes(sorted);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const handleToggleUserRecipeShoppingList = async (id: number) => {
    const recipe = userRecipes.find((r) => r.id === id);
    if (recipe) {
      await updateUserRecipe(id, { includeInShoppingList: !recipe.includeInShoppingList });
      setUserRecipes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, includeInShoppingList: !r.includeInShoppingList } : r
        )
      );
    }
  };

  const handleCollectionMultiplierChange = async (recipeId: number, multiplier: number) => {
    await updateCollectionItem(recipeId, { multiplier });
    setUserCollection((prev) =>
      prev.map((item) =>
        item.recipeId === recipeId ? { ...item, multiplier } : item
      )
    );
  };

  const handleUserRecipeMultiplierChange = async (id: number, multiplier: number) => {
    await updateUserRecipe(id, { multiplier });
    setUserRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, multiplier } : r))
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

      const recipesWithMissing = recipesNotInCollection.map((recipe: Recipe) => {
        const haveCount = recipe.ingredients.filter((ing: { name: string }) =>
          hasIngredient(ing.name, fridgeIngs)
        ).length;
        const missingCount = recipe.ingredients.filter(
          (ing: { name: string }) => !hasIngredient(ing.name, fridgeIngs)
        ).length;
        return { recipe, haveCount, missingCount };
      });

      const sorted = recipesWithMissing
        .filter((item: any) => item.haveCount > 0)
        .sort((a: any, b: any) => a.missingCount - b.missingCount)
        .slice(0, 50);

      setSuggestedRecipes(sorted);
    } finally {
      toggleInProgress.current.delete(recipeId);
    }
  }, []);

  const renderRecipeCard = useCallback(
    (recipe: Recipe, missingCount?: number, collectionItem?: any) => (
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
            {recipe.cuisine}{recipe.mealType ? ` • ${recipe.mealType}` : ''} • {recipe.difficulty} • {recipe.totalTime} min
          </Text>
          {missingCount !== undefined && (
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14, marginBottom: 8 }}>
              {missingCount === 0
                ? '✓ You have all ingredients!'
                : `Missing ${missingCount} ingredient${missingCount > 1 ? 's' : ''}`}
            </Text>
          )}
          {collectionItem && (
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {MULTIPLIER_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => handleCollectionMultiplierChange(recipe.id, m)}
                  style={{
                    backgroundColor: (collectionItem.multiplier ?? 1) === m ? '#007aff' : isDark ? '#2c2c2e' : '#e5e5ea',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                  <Text style={{
                    color: (collectionItem.multiplier ?? 1) === m ? '#ffffff' : isDark ? '#ffffff' : '#000000',
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

        {missingCount !== undefined && (() => {
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
                        <Ionicons name="close" size={14} color="#ff3b30" style={{ marginRight: 4 }} />
                      )}
                      <Text
                        style={{
                          color: hasIng ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                          fontSize: 13,
                          fontStyle: hasIng ? 'normal' : 'italic',
                        }}>
                        {converted.amount ? `${formatAmount(converted.amount)} ` : ''}{converted.unit && converted.unit !== 'whole' ? `${converted.unit} ` : ''}{ing.name}
                      </Text>
                    </View>
                  );
                }
              )}
            </View>
            {recipe.images && recipe.images.length > 0 && (() => {
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
              setSelectedRecipeSource(collectionItem ? { type: 'collection', id: recipe.id } : null);
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
          {missingCount !== undefined && (
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
                backgroundColor: isInCollection(recipe.id)
                  ? isDark
                    ? '#2c2c2e'
                    : '#e5e5ea'
                  : isDark
                    ? '#2c2c2e'
                    : '#e5e5ea',
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
          )}
        </View>
      </View>
    ),
    [isDark, fridgeIngredients, isInCollection, toggleCollection, loadData, unitSystem]
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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16 }}>
        <View ref={collectionHeaderRef}>
          <TouchableOpacity
            onPress={() => setCollectionExpanded(!collectionExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 22,
                fontWeight: '600',
              }}>
              My Collection ({userCollection.length + userRecipes.length})
            </Text>
            <Ionicons
              name={collectionExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>
        {collectionExpanded &&
          (userCollection.length === 0 && userRecipes.length === 0 ? (
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
              {[...userRecipes, ...userCollection.filter(item => item.recipe)]
                .slice((collectionPage - 1) * 10, collectionPage * 10)
                .map((item) => {
                const isUserRecipe = 'instructions' in item;
                const userRecipe = isUserRecipe ? item : null;
                const collectionItem = !isUserRecipe ? item : null;
                const recipe = isUserRecipe ? convertToRecipe(item as UserRecipe) : (item as any).recipe;
                if (!recipe) return null;
                const missingCount = recipe.ingredients.filter(
                  (ing: { name: string }) => !hasIngredient(ing.name, fridgeIngredients)
                ).length;

                if (userRecipe) {
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
                            {recipe.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleToggleUserRecipeShoppingList(userRecipe.id)}
                            accessible={true}
                            accessibilityLabel={`${userRecipe.includeInShoppingList === false ? 'Include' : 'Exclude'} ${recipe.name} in shopping list`}
                            accessibilityRole="button"
                            style={{
                              backgroundColor:
                                userRecipe.includeInShoppingList === false
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
                                userRecipe.includeInShoppingList === false ? 'cart-outline' : 'cart'
                              }
                              size={18}
                              color={
                                userRecipe.includeInShoppingList === false
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
                          {recipe.cuisine}{recipe.mealType ? ` • ${recipe.mealType}` : ''} • {recipe.difficulty} • {recipe.totalTime} min
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
                              onPress={() => handleUserRecipeMultiplierChange(userRecipe.id, m)}
                              style={{
                                backgroundColor: ((userRecipe as UserRecipe).multiplier ?? 1) === m ? '#007aff' : isDark ? '#2c2c2e' : '#e5e5ea',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 12,
                              }}>
                              <Text style={{
                                color: ((userRecipe as UserRecipe).multiplier ?? 1) === m ? '#ffffff' : isDark ? '#ffffff' : '#000000',
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
                        const mult = (userRecipe as UserRecipe).multiplier ?? 1;
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
                                      color: hasIng ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                                      fontSize: 13,
                                      fontStyle: hasIng ? 'normal' : 'italic',
                                    }}>
                                    {converted.amount ? `${formatAmount(converted.amount)} ` : ''}{converted.unit && converted.unit !== 'whole' ? `${converted.unit} ` : ''}{ing.name}
                                  </Text>
                                </View>
                              );
                            }
                          )}
                        </View>
                        {recipe.images && recipe.images.length > 0 && (() => {
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
                            setSelectedRecipeMultiplier((userRecipe as UserRecipe).multiplier ?? 1);
                            setSelectedRecipeSource({ type: 'userRecipe', id: userRecipe.id });
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
                          onPress={() => router.push('/cookbook')}
                          accessible={true}
                          accessibilityLabel={`Manage ${recipe.name} in cookbook`}
                          accessibilityRole="button"
                          style={{
                            flex: 1,
                            backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
                            paddingVertical: 10,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}>
                          <Text style={{ color: isDark ? '#ffffff' : '#000000', fontWeight: '600' }}>
                            Manage
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                } else {
                  return renderRecipeCard(recipe, missingCount, collectionItem);
                }
              })}
              {(userCollection.length + userRecipes.length) > 10 && (
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
                      setTimeout(() => {
                        collectionHeaderRef.current?.measureLayout(
                          scrollViewRef.current as any,
                          (x, y) => {
                            scrollViewRef.current?.scrollTo({ y, animated: true });
                          },
                          () => {}
                        );
                      }, 100);
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
                    {collectionPage} / {Math.ceil((userCollection.length + userRecipes.length) / 10)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCollectionPage((p) => Math.min(Math.ceil((userCollection.length + userRecipes.length) / 10), p + 1));
                      setTimeout(() => {
                        collectionHeaderRef.current?.measureLayout(
                          scrollViewRef.current as any,
                          (x, y) => {
                            scrollViewRef.current?.scrollTo({ y, animated: true });
                          },
                          () => {}
                        );
                      }, 100);
                    }}
                    disabled={collectionPage === Math.ceil((userCollection.length + userRecipes.length) / 10)}
                    style={{
                      backgroundColor:
                        collectionPage === Math.ceil((userCollection.length + userRecipes.length) / 10)
                          ? isDark
                            ? '#1c1c1e'
                            : '#f2f2f7'
                          : '#007aff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: collectionPage === Math.ceil((userCollection.length + userRecipes.length) / 10) ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        color:
                          collectionPage === Math.ceil((userCollection.length + userRecipes.length) / 10)
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
              Suggested Recipes ({suggestedRecipes.length})
            </Text>
            <Ionicons
              name={suggestedExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>
        {suggestedExpanded && (
          <>
            {suggestedRecipes
              .slice((suggestedPage - 1) * 10, suggestedPage * 10)
              .map((item) => renderRecipeCard(item.recipe, item.missingCount))}
            {suggestedRecipes.length > 10 && (
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
                    setTimeout(() => {
                      suggestedHeaderRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y) => {
                          scrollViewRef.current?.scrollTo({ y, animated: true });
                        },
                        () => {}
                      );
                    }, 100);
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
                  {suggestedPage} / {Math.ceil(suggestedRecipes.length / 10)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSuggestedPage((p) => Math.min(Math.ceil(suggestedRecipes.length / 10), p + 1));
                    setTimeout(() => {
                      suggestedHeaderRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y) => {
                          scrollViewRef.current?.scrollTo({ y, animated: true });
                        },
                        () => {}
                      );
                    }, 100);
                  }}
                  disabled={suggestedPage === Math.ceil(suggestedRecipes.length / 10)}
                  style={{
                    backgroundColor:
                      suggestedPage === Math.ceil(suggestedRecipes.length / 10)
                        ? isDark
                          ? '#1c1c1e'
                          : '#f2f2f7'
                        : '#007aff',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    opacity: suggestedPage === Math.ceil(suggestedRecipes.length / 10) ? 0.5 : 1,
                  }}>
                  <Text
                    style={{
                      color:
                        suggestedPage === Math.ceil(suggestedRecipes.length / 10)
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
        isInCollection={selectedRecipe ? isInCollection(selectedRecipe.id) : false}
        onClose={() => {
          setSelectedRecipe(null);
          setSelectedRecipeSource(null);
        }}
        onToggleCollection={() => {
          if (selectedRecipe) toggleCollection(selectedRecipe.id);
        }}
        multiplier={selectedRecipeMultiplier}
        unitSystem={unitSystem}
        onMultiplierChange={(m) => {
          setSelectedRecipeMultiplier(m);
          if (selectedRecipeSource) {
            if (selectedRecipeSource.type === 'collection') {
              handleCollectionMultiplierChange(selectedRecipeSource.id, m);
            } else {
              handleUserRecipeMultiplierChange(selectedRecipeSource.id, m);
            }
          }
        }}
      />
    </View>
  );
}
