import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getIngredients,
  addToFridge,
  removeFromFridge,
  getFridgeWithDetails,
  getCollectionWithDetails,
} from '../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '../types/ingredient';

const ITEMS_PER_PAGE = 10;

export default function Fridge() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [search, setSearch] = useState('');
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [userFridge, setUserFridge] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fridgeExpanded, setFridgeExpanded] = useState(true);
  const [shoppingExpanded, setShoppingExpanded] = useState(true);
  const [allIngredientsExpanded, setAllIngredientsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const toggleInProgress = useRef<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ingredients, fridge, collection] = await Promise.all([
      getIngredients(),
      getFridgeWithDetails(),
      getCollectionWithDetails(),
    ]);
    setAllIngredients(ingredients);
    setUserFridge(fridge);

    const fridgeIngredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
    const missingIngredients = new Map();

    collection.forEach((item) => {
      if (item.recipe) {
        item.recipe.ingredients.forEach((ing: { name: string; amount: number; unit: string }) => {
          const ingName = ing.name.toLowerCase();
          if (!fridgeIngredientNames.includes(ingName)) {
            if (!missingIngredients.has(ingName)) {
              missingIngredients.set(ingName, {
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit,
                recipes: [],
              });
            }
            missingIngredients.get(ingName).recipes.push(item.recipe.name);
          }
        });
      }
    });

    setShoppingList(Array.from(missingIngredients.values()));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredIngredients = useMemo(
    () =>
      search.trim()
        ? allIngredients.filter((ing) => {
            const query = search.toLowerCase();
            return (
              ing.name.toLowerCase().includes(query) || ing.category.toLowerCase().includes(query)
            );
          })
        : [],
    [search, allIngredients]
  );

  const allIngredientsFiltered = useMemo(
    () =>
      selectedCategory
        ? allIngredients.filter((ing) => ing.category === selectedCategory)
        : allIngredients,
    [allIngredients, selectedCategory]
  );

  const categories = useMemo(
    () => Array.from(new Set(allIngredients.map((i) => i.category))).sort(),
    [allIngredients]
  );

  const totalPages = Math.ceil(allIngredientsFiltered.length / ITEMS_PER_PAGE);
  const paginatedIngredients = useMemo(
    () =>
      allIngredientsFiltered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [allIngredientsFiltered, currentPage]
  );

  const isInFridge = useCallback(
    (ingredientId: number) => userFridge.some((item) => item.ingredientId === ingredientId),
    [userFridge]
  );

  const handleAddToFridge = async (ingredientId: number) => {
    if (toggleInProgress.current.has(ingredientId)) return;
    toggleInProgress.current.add(ingredientId);
    try {
      await addToFridge(ingredientId);
      const [fridge, collection] = await Promise.all([
        getFridgeWithDetails(),
        getCollectionWithDetails(),
      ]);
      setUserFridge(fridge);

      const fridgeIngredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
      const missingIngredients = new Map();

      collection.forEach((item) => {
        if (item.recipe) {
          item.recipe.ingredients.forEach((ing: { name: string; amount: number; unit: string }) => {
            const ingName = ing.name.toLowerCase();
            if (!fridgeIngredientNames.includes(ingName)) {
              if (!missingIngredients.has(ingName)) {
                missingIngredients.set(ingName, {
                  name: ing.name,
                  amount: ing.amount,
                  unit: ing.unit,
                  recipes: [],
                });
              }
              missingIngredients.get(ingName).recipes.push(item.recipe.name);
            }
          });
        }
      });

      setShoppingList(Array.from(missingIngredients.values()));
    } finally {
      toggleInProgress.current.delete(ingredientId);
    }
  };

  const handleRemoveFromFridge = async (ingredientId: number) => {
    if (toggleInProgress.current.has(ingredientId)) return;
    toggleInProgress.current.add(ingredientId);
    try {
      await removeFromFridge(ingredientId);
      const [fridge, collection] = await Promise.all([
        getFridgeWithDetails(),
        getCollectionWithDetails(),
      ]);
      setUserFridge(fridge);

      const fridgeIngredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
      const missingIngredients = new Map();

      collection.forEach((item) => {
        if (item.recipe) {
          item.recipe.ingredients.forEach((ing: { name: string; amount: number; unit: string }) => {
            const ingName = ing.name.toLowerCase();
            if (!fridgeIngredientNames.includes(ingName)) {
              if (!missingIngredients.has(ingName)) {
                missingIngredients.set(ingName, {
                  name: ing.name,
                  amount: ing.amount,
                  unit: ing.unit,
                  recipes: [],
                });
              }
              missingIngredients.get(ingName).recipes.push(item.recipe.name);
            }
          });
        }
      });

      setShoppingList(Array.from(missingIngredients.values()));
    } finally {
      toggleInProgress.current.delete(ingredientId);
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
      <ScrollView>
        <View style={{ padding: 16 }}>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ingredients..."
              placeholderTextColor={isDark ? '#8e8e93' : '#8e8e93'}
              accessible={true}
              accessibilityLabel="Search ingredients by name or category"
              accessibilityRole="search"
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                color: isDark ? '#ffffff' : '#000000',
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingRight: search ? 40 : 16,
                borderRadius: 10,
                fontSize: 16,
                marginBottom: 16,
              }}
            />
            {search ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                }}>
                <Ionicons name="close-circle" size={20} color={isDark ? '#8e8e93' : '#636366'} />
              </TouchableOpacity>
            ) : null}
          </View>

          {search.trim() && filteredIngredients.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: isDark ? '#ffffff' : '#000000',
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 8,
                }}>
                Search Results
              </Text>
              {filteredIngredients.slice(0, 5).map((ing) => (
                <TouchableOpacity
                  key={ing.id}
                  onPress={() => handleAddToFridge(ing.id)}
                  disabled={isInFridge(ing.id)}
                  accessible={true}
                  accessibilityLabel={
                    isInFridge(ing.id)
                      ? `${ing.name} already in fridge`
                      : `Add ${ing.name} to fridge`
                  }
                  accessibilityRole="button"
                  style={{
                    backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: isInFridge(ing.id) ? 0.5 : 1,
                  }}>
                  <View>
                    <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                      {ing.name}
                    </Text>
                    <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
                      {ing.category}
                    </Text>
                  </View>
                  {isInFridge(ing.id) ? (
                    <Ionicons name="checkmark-circle" size={24} color="#34c759" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color="#007aff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => setShoppingExpanded(!shoppingExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 18,
                fontWeight: '600',
              }}>
              Shopping List ({shoppingList.length})
            </Text>
            <Ionicons
              name={shoppingExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
          {shoppingExpanded &&
            (shoppingList.length === 0 ? (
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
                  No missing ingredients
                </Text>
              </View>
            ) : (
              shoppingList.map((item, idx) => {
                const ingredient = allIngredients.find(
                  (ing) => ing.name.toLowerCase() === item.name.toLowerCase()
                );
                return (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: isDark ? '#ffffff' : '#000000',
                          fontSize: 16,
                          marginBottom: 4,
                        }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 13 }}>
                        Needed for: {item.recipes.join(', ')}
                      </Text>
                    </View>
                    {ingredient && (
                      <TouchableOpacity
                        onPress={() => handleAddToFridge(ingredient.id)}
                        accessible={true}
                        accessibilityLabel={`Add ${item.name} to fridge`}
                        accessibilityRole="button"
                        style={{
                          backgroundColor: '#007aff',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          marginLeft: 8,
                        }}>
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                          Add
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ))}

          <TouchableOpacity
            onPress={() => setFridgeExpanded(!fridgeExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 8,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 18,
                fontWeight: '600',
              }}>
              My Fridge ({userFridge.length})
            </Text>
            <Ionicons
              name={fridgeExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
          {fridgeExpanded &&
            (userFridge.length === 0 ? (
              <View style={{ alignItems: 'center', marginVertical: 40 }}>
                <Ionicons
                  name="nutrition-outline"
                  size={64}
                  color={isDark ? '#3a3a3c' : '#d1d1d6'}
                />
                <Text
                  style={{
                    color: isDark ? '#8e8e93' : '#8e8e93',
                    textAlign: 'center',
                    marginTop: 16,
                    fontSize: 16,
                  }}>
                  No ingredients in your fridge
                </Text>
                <Text
                  style={{
                    color: isDark ? '#8e8e93' : '#8e8e93',
                    textAlign: 'center',
                    marginTop: 4,
                    fontSize: 14,
                  }}>
                  Search and add some!
                </Text>
              </View>
            ) : (
              userFridge.map((item) => (
                <View
                  key={item.ingredientId}
                  style={{
                    backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                  <View>
                    <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                      {item.ingredient?.name || 'Unknown'}
                    </Text>
                    <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
                      {item.ingredient?.category || ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveFromFridge(item.ingredientId)}
                    accessible={true}
                    accessibilityLabel={`Remove ${item.ingredient?.name || 'ingredient'} from fridge`}
                    accessibilityRole="button">
                    <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))
            ))}

          <TouchableOpacity
            onPress={() => setAllIngredientsExpanded(!allIngredientsExpanded)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 8,
            }}>
            <Text
              style={{
                color: isDark ? '#ffffff' : '#000000',
                fontSize: 18,
                fontWeight: '600',
              }}>
              All Ingredients ({allIngredientsFiltered.length})
            </Text>
            <Ionicons
              name={allIngredientsExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isDark ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
          {allIngredientsExpanded && (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategory(null);
                    setCurrentPage(1);
                  }}
                  style={{
                    backgroundColor: !selectedCategory ? '#007aff' : isDark ? '#1c1c1e' : '#f2f2f7',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                  }}>
                  <Text
                    style={{
                      color: !selectedCategory ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                      fontSize: 14,
                    }}>
                    All
                  </Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => {
                      setSelectedCategory(category);
                      setCurrentPage(1);
                    }}
                    style={{
                      backgroundColor:
                        selectedCategory === category ? '#007aff' : isDark ? '#1c1c1e' : '#f2f2f7',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}>
                    <Text
                      style={{
                        color:
                          selectedCategory === category ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                        fontSize: 14,
                      }}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {paginatedIngredients.map((ing) => (
                <TouchableOpacity
                  key={ing.id}
                  onPress={() => handleAddToFridge(ing.id)}
                  disabled={isInFridge(ing.id)}
                  style={{
                    backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: isInFridge(ing.id) ? 0.5 : 1,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 8,
                        backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
                        marginRight: 12,
                      }}
                    />
                    <View>
                      <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                        {ing.name}
                      </Text>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
                        {ing.category}
                      </Text>
                    </View>
                  </View>
                  {isInFridge(ing.id) ? (
                    <Ionicons name="checkmark-circle" size={24} color="#34c759" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color="#007aff" />
                  )}
                </TouchableOpacity>
              ))}
              {totalPages > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 16,
                  }}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    {currentPage} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
