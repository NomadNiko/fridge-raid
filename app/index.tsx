import {
  View,
  Text,
  TextInput,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getRecipes,
  addToCollection,
  removeFromCollection,
  getUserCollection,
} from '../lib/storage';
import RecipeCard from '../components/RecipeCard';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { Recipe } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { UnitSystem, getUnitSystem } from '../lib/unitConversion';

const ITEMS_PER_PAGE = 10;

export default function Search() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('original');
  const toggleInProgress = useRef<Set<number>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const [recipesData, collectionData, savedUnitSystem] = await Promise.all([getRecipes(), getUserCollection(), getUnitSystem()]);
    setRecipes(recipesData);
    setUserCollection(collectionData);
    setUnitSystemState(savedUnitSystem);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredRecipes = useMemo(() => {
    if (search.trim()) {
      const query = search.toLowerCase();
      return recipes.filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(query) ||
          recipe.cuisine.toLowerCase().includes(query) ||
          (recipe.mealType && recipe.mealType.toLowerCase().includes(query)) ||
          recipe.tags.some((tag: string) => tag.toLowerCase().includes(query)) ||
          recipe.ingredients.some((ing: { name: string }) =>
            ing.name.toLowerCase().includes(query)
          )
      );
    }
    let result = recipes;
    if (selectedCuisine) {
      result = result.filter((recipe) => recipe.cuisine === selectedCuisine);
    }
    if (selectedMealType) {
      result = result.filter((recipe) => recipe.mealType === selectedMealType);
    }
    return result;
  }, [search, recipes, selectedCuisine, selectedMealType]);

  const cuisines = useMemo(
    () => Array.from(new Set(recipes.map((r) => r.cuisine))).sort(),
    [recipes]
  );

  const mealTypes = useMemo(
    () => Array.from(new Set(recipes.map((r) => r.mealType).filter(Boolean))).sort() as string[],
    [recipes]
  );

  const totalPages = Math.ceil(filteredRecipes.length / ITEMS_PER_PAGE);
  const paginatedRecipes = useMemo(
    () => filteredRecipes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredRecipes, currentPage]
  );

  const isInCollection = (recipeId: number) =>
    userCollection.some((item) => item.recipeId === recipeId);

  const toggleCollection = async (recipeId: number) => {
    if (toggleInProgress.current.has(recipeId)) return;
    toggleInProgress.current.add(recipeId);
    try {
      if (isInCollection(recipeId)) {
        await removeFromCollection(recipeId);
      } else {
        await addToCollection(recipeId);
      }
      const collectionData = await getUserCollection();
      setUserCollection(collectionData);
    } finally {
      toggleInProgress.current.delete(recipeId);
    }
  };

  // Recipe navigation
  const selectedRecipeIndex = useMemo(() => {
    if (!selectedRecipe) return -1;
    return filteredRecipes.findIndex((r) => r.id === selectedRecipe.id);
  }, [selectedRecipe, filteredRecipes]);

  const navigateToPreviousRecipe = () => {
    if (selectedRecipeIndex > 0) {
      setSelectedRecipe(filteredRecipes[selectedRecipeIndex - 1]);
    }
  };

  const navigateToNextRecipe = () => {
    if (selectedRecipeIndex < filteredRecipes.length - 1) {
      setSelectedRecipe(filteredRecipes[selectedRecipeIndex + 1]);
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <FlatList
        ref={flatListRef}
        data={paginatedRecipes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            <View style={{ position: 'relative', marginBottom: 12 }}>
              <TextInput
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  setCurrentPage(1);
                }}
                placeholder="Search recipes..."
                placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
                accessible={true}
                accessibilityLabel="Search recipes by name, cuisine, tags, or ingredients"
                accessibilityRole="search"
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  color: isDark ? '#ffffff' : '#000000',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  paddingRight: search ? 40 : 16,
                  borderRadius: 10,
                  fontSize: 16,
                }}
              />
              {search ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setCurrentPage(1);
                  }}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                  }}>
                  <Ionicons name="close-circle" size={20} color={isDark ? '#8e8e93' : '#636366'} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setFiltersVisible(!filtersVisible)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                marginBottom: 8,
              }}>
              <Text
                style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16, fontWeight: '600' }}>
                Filters
              </Text>
              <Ionicons
                name={filtersVisible ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDark ? '#ffffff' : '#000000'}
              />
            </TouchableOpacity>
            {filtersVisible && (
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
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCuisine(null);
                      setCurrentPage(1);
                    }}
                    style={{
                      backgroundColor: !selectedCuisine
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
                        color: !selectedCuisine ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                        fontSize: 14,
                      }}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {cuisines.map((cuisine) => (
                    <TouchableOpacity
                      key={cuisine}
                      onPress={() => {
                        setSelectedCuisine(cuisine);
                        setCurrentPage(1);
                      }}
                      style={{
                        backgroundColor:
                          selectedCuisine === cuisine
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
                            selectedCuisine === cuisine
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
                      setSelectedMealType(null);
                      setCurrentPage(1);
                    }}
                    style={{
                      backgroundColor: !selectedMealType
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
                        color: !selectedMealType ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                        fontSize: 14,
                      }}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {mealTypes.map((mealType) => (
                    <TouchableOpacity
                      key={mealType}
                      onPress={() => {
                        setSelectedMealType(mealType);
                        setCurrentPage(1);
                      }}
                      style={{
                        backgroundColor:
                          selectedMealType === mealType
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
                            selectedMealType === mealType
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
            {!search.trim() && recipes.length > 0 && (
              <Text
                style={{
                  color: isDark ? '#8e8e93' : '#636366',
                  fontSize: 16,
                  marginBottom: 12,
                  fontWeight: '600',
                }}>
                {selectedCuisine && selectedMealType
                  ? `${selectedCuisine} ${selectedMealType} Recipes`
                  : selectedCuisine
                    ? `${selectedCuisine} Recipes`
                    : selectedMealType
                      ? `${selectedMealType} Recipes`
                      : 'All Recipes'}{' '}
                ({filteredRecipes.length})
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isInCollection={isInCollection(item.id)}
            onView={() => setSelectedRecipe(item)}
            onToggleCollection={() => toggleCollection(item.id)}
          />
        )}
        ListFooterComponent={
          totalPages > 1 ? (
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
                  setTimeout(
                    () => flatListRef.current?.scrollToIndex({ index: 0, animated: true }),
                    100
                  );
                }}
                disabled={currentPage === 1}
                style={{
                  backgroundColor: currentPage === 1 ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
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
                {currentPage} / {totalPages}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  setTimeout(
                    () => flatListRef.current?.scrollToIndex({ index: 0, animated: true }),
                    100
                  );
                }}
                disabled={currentPage === totalPages}
                style={{
                  backgroundColor:
                    currentPage === totalPages ? (isDark ? '#1c1c1e' : '#f2f2f7') : '#007aff',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                }}>
                <Text
                  style={{
                    color:
                      currentPage === totalPages ? (isDark ? '#8e8e93' : '#636366') : '#ffffff',
                    fontWeight: '600',
                  }}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="search-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
            <Text
              style={{
                color: isDark ? '#8e8e93' : '#8e8e93',
                textAlign: 'center',
                marginTop: 16,
                fontSize: 16,
              }}>
              No recipes found
            </Text>
          </View>
        }
      />

      <RecipeDetailModal
        visible={!!selectedRecipe}
        recipe={selectedRecipe}
        isInCollection={selectedRecipe ? isInCollection(selectedRecipe.id) : false}
        onClose={() => setSelectedRecipe(null)}
        onToggleCollection={() => {
          if (selectedRecipe) toggleCollection(selectedRecipe.id);
        }}
        onPrevious={navigateToPreviousRecipe}
        onNext={navigateToNextRecipe}
        hasPrevious={selectedRecipeIndex > 0}
        hasNext={selectedRecipeIndex < filteredRecipes.length - 1}
        unitSystem={unitSystem}
      />
    </View>
  );
}
