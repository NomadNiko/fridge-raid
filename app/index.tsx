import { View, Text, TextInput, FlatList, useColorScheme, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { getRecipes, addToCollection, removeFromCollection, getUserCollection } from '../lib/storage';
import RecipeCard from '../components/RecipeCard';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { Recipe } from '../types';

export default function Home() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const [recipesData, collectionData] = await Promise.all([
      getRecipes(),
      getUserCollection(),
    ]);
    // console.log('Loaded recipes:', recipesData);
    setRecipes(recipesData);
    setUserCollection(collectionData);
    setLoading(false);
  };

  const filteredRecipes = search.trim()
    ? recipes.filter((recipe) => {
        const query = search.toLowerCase();
        const match =
          recipe.name.toLowerCase().includes(query) ||
          recipe.cuisine.toLowerCase().includes(query) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(query));
        // console.log(`Recipe "${recipe.name}" matches "${query}":`, match);
        return match;
      })
    : recipes.slice(0, 3);

  const isInCollection = (recipeId: number) =>
    userCollection.some((item) => item.recipeId === recipeId);

  const toggleCollection = async (recipeId: number) => {
    if (isInCollection(recipeId)) {
      await removeFromCollection(recipeId);
    } else {
      await addToCollection(recipeId);
    }
    const collectionData = await getUserCollection();
    setUserCollection(collectionData);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <View style={{ padding: 16 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes..."
          placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            color: isDark ? '#ffffff' : '#000000',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 10,
            fontSize: 16,
          }}
        />
      </View>

      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isInCollection={isInCollection(item.id)}
            onView={() => setSelectedRecipe(item)}
            onToggleCollection={() => toggleCollection(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text
            style={{ color: isDark ? '#8e8e93' : '#8e8e93', textAlign: 'center', marginTop: 40 }}>
            No recipes found
          </Text>
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
      />
    </View>
  );
}
