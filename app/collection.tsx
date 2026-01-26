import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getRecipes,
  getCollectionWithDetails,
  getFridgeWithDetails,
  addToCollection,
  removeFromCollection,
  getUserCollection,
} from '../lib/storage';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { Recipe } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function Collection() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<any[]>([]);
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionExpanded, setCollectionExpanded] = useState(true);
  const [suggestedExpanded, setSuggestedExpanded] = useState(true);
  const toggleInProgress = useRef<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [collection, allRecipes, fridge] = await Promise.all([
      getCollectionWithDetails(),
      getRecipes(),
      getFridgeWithDetails(),
    ]);
    setUserCollection(collection);

    const fridgeIngredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
    setFridgeIngredients(fridgeIngredientNames);

    const collectionRecipeIds = collection.map((item) => item.recipeId);
    const recipesNotInCollection = allRecipes.filter(
      (recipe: Recipe) => !collectionRecipeIds.includes(recipe.id)
    );

    const recipesWithMissing = recipesNotInCollection.map((recipe: Recipe) => {
      const missingCount = recipe.ingredients.filter(
        (ing: { name: string }) => !fridgeIngredientNames.includes(ing.name.toLowerCase())
      ).length;
      return { recipe, missingCount };
    });

    const sorted = recipesWithMissing
      .sort((a: any, b: any) => a.missingCount - b.missingCount)
      .slice(0, 5);

    setSuggestedRecipes(sorted);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

      const fridgeIngredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
      setFridgeIngredients(fridgeIngredientNames);

      const collectionRecipeIds = collection.map((item) => item.recipeId);
      const recipesNotInCollection = allRecipes.filter(
        (recipe: Recipe) => !collectionRecipeIds.includes(recipe.id)
      );

      const recipesWithMissing = recipesNotInCollection.map((recipe: Recipe) => {
        const missingCount = recipe.ingredients.filter(
          (ing: { name: string }) => !fridgeIngredientNames.includes(ing.name.toLowerCase())
        ).length;
        return { recipe, missingCount };
      });

      const sorted = recipesWithMissing
        .sort((a: any, b: any) => a.missingCount - b.missingCount)
        .slice(0, 5);

      setSuggestedRecipes(sorted);
    } finally {
      toggleInProgress.current.delete(recipeId);
    }
  }, []);

  const renderRecipeCard = useCallback(
    (recipe: Recipe, missingCount?: number) => (
      <View
        key={recipe.id}
        style={{
          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}>
        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 18,
              fontWeight: '600',
              marginBottom: 4,
            }}>
            {recipe.name}
          </Text>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14, marginBottom: 8 }}>
            {recipe.cuisine} • {recipe.difficulty} • {recipe.totalTime} min
          </Text>
          {missingCount !== undefined && (
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14, marginBottom: 8 }}>
              {missingCount === 0
                ? '✓ You have all ingredients!'
                : `Missing ${missingCount} ingredient${missingCount > 1 ? 's' : ''}`}
            </Text>
          )}
        </View>

        {missingCount !== undefined && (
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
            {recipe.ingredients.map(
              (ing: { name: string; amount: number; unit: string }, idx: number) => {
                const hasIngredient = fridgeIngredients.includes(ing.name.toLowerCase());
                return (
                  <View
                    key={idx}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    {!hasIngredient && (
                      <Ionicons name="close" size={14} color="#ff3b30" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={{
                        color: hasIngredient ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                        fontSize: 13,
                        fontStyle: hasIngredient ? 'normal' : 'italic',
                      }}>
                      {ing.amount} {ing.unit} {ing.name}
                    </Text>
                  </View>
                );
              }
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setSelectedRecipe(recipe)}
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
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>View Recipe</Text>
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
                  ? '#34c759'
                  : isDark
                    ? '#2c2c2e'
                    : '#e5e5ea',
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: isInCollection(recipe.id) ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                  fontWeight: '600',
                }}>
                {isInCollection(recipe.id) ? '✓ Added' : '+ Add'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [isDark, fridgeIngredients, isInCollection, toggleCollection]
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
      <ScrollView contentContainerStyle={{ padding: 16 }}>
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
            My Collection ({userCollection.length})
          </Text>
          <Ionicons
            name={collectionExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={isDark ? '#ffffff' : '#000000'}
          />
        </TouchableOpacity>
        {collectionExpanded &&
          (userCollection.length === 0 ? (
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
            userCollection.map((item) => {
              if (!item.recipe) return null;
              const missingCount = item.recipe.ingredients.filter(
                (ing: { name: string }) => !fridgeIngredients.includes(ing.name.toLowerCase())
              ).length;
              return renderRecipeCard(item.recipe, missingCount);
            })
          ))}

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
            Suggested Recipes
          </Text>
          <Ionicons
            name={suggestedExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={isDark ? '#ffffff' : '#000000'}
          />
        </TouchableOpacity>
        {suggestedExpanded &&
          suggestedRecipes.map((item) => renderRecipeCard(item.recipe, item.missingCount))}
      </ScrollView>

      <RecipeDetailModal
        visible={!!selectedRecipe}
        recipe={selectedRecipe}
        isInCollection={selectedRecipe ? isInCollection(selectedRecipe.id) : false}
        onClose={() => setSelectedRecipe(null)}
        onToggleCollection={() => {
          if (selectedRecipe) toggleCollection(selectedRecipe.id);
        }}
      />
    </View>
  );
}
