import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getIngredients,
  addToFridge,
  getFridgeWithDetails,
  getCollectionWithDetails,
  getUserRecipes,
  getCustomIngredients,
  addCustomToFridge,
  findOrCreateCustomIngredient,
  CustomIngredient,
  UserRecipe,
} from '../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '../types/ingredient';
import { matchIngredient, findBuiltInIngredient, findCustomIngredient } from '../lib/ingredientMatcher';
import { UnitSystem, getUnitSystem, convertUnit } from '../lib/unitConversion';

type ShoppingListEntry = {
  recipeName: string;
  amount: number;
  unit: string;
  multiplier: number;
};

type ShoppingListItem = {
  name: string;
  entries: ShoppingListEntry[];
  totalsByUnit: { unit: string; total: number }[];
};

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toString();
};

function buildShoppingList(
  fridgeIngredients: (Ingredient | CustomIngredient)[],
  collection: any[],
  userRecipes: UserRecipe[]
): ShoppingListItem[] {
  const missingIngredients = new Map<string, ShoppingListItem>();

  const processRecipeIngredients = (
    ingredients: { name: string; amount: number; unit: string }[],
    recipeName: string,
    multiplier: number
  ) => {
    ingredients.forEach((ing) => {
      const matched = matchIngredient(ing.name, fridgeIngredients);
      if (!matched) {
        const key = ing.name.toLowerCase();
        if (!missingIngredients.has(key)) {
          missingIngredients.set(key, { name: ing.name, entries: [], totalsByUnit: [] });
        }
        missingIngredients.get(key)!.entries.push({
          recipeName,
          amount: ing.amount,
          unit: ing.unit,
          multiplier,
        });
      }
    });
  };

  collection.forEach((item) => {
    if (item.recipe && item.includeInShoppingList !== false) {
      processRecipeIngredients(
        item.recipe.ingredients,
        item.recipe.name,
        item.multiplier ?? 1
      );
    }
  });

  userRecipes.forEach((recipe) => {
    if (recipe.includeInShoppingList !== false) {
      processRecipeIngredients(recipe.ingredients, recipe.name, recipe.multiplier ?? 1);
    }
  });

  for (const item of missingIngredients.values()) {
    const unitTotals = new Map<string, number>();
    item.entries.forEach((e) => {
      const u = e.unit || '';
      unitTotals.set(u, (unitTotals.get(u) || 0) + e.amount * e.multiplier);
    });
    item.totalsByUnit = Array.from(unitTotals.entries()).map(([unit, total]) => ({ unit, total }));
  }

  return Array.from(missingIngredients.values());
}

export default function Shopping() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [customIngredients, setCustomIngredients] = useState<CustomIngredient[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('original');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ingredients, custom, fridge, collection, userRecipes, savedUnitSystem] = await Promise.all([
      getIngredients(),
      getCustomIngredients(),
      getFridgeWithDetails(),
      getCollectionWithDetails(),
      getUserRecipes(),
      getUnitSystem(),
    ]);
    setAllIngredients(ingredients);
    setCustomIngredients(custom);
    setUnitSystemState(savedUnitSystem);

    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setShoppingList(buildShoppingList(fridgeIngs, collection, userRecipes));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddToFridge = async (ingredientId: number) => {
    await addToFridge(ingredientId);
    const [fridge, collection, userRecipes] = await Promise.all([
      getFridgeWithDetails(),
      getCollectionWithDetails(),
      getUserRecipes(),
    ]);
    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setShoppingList(buildShoppingList(fridgeIngs, collection, userRecipes));
  };

  const handleAddCustomToFridge = async (customIngredientId: number) => {
    await addCustomToFridge(customIngredientId);
    const [fridge, collection, userRecipes] = await Promise.all([
      getFridgeWithDetails(),
      getCollectionWithDetails(),
      getUserRecipes(),
    ]);
    const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
    setShoppingList(buildShoppingList(fridgeIngs, collection, userRecipes));
  };

  const handleAddNewCustomIngredient = async (name: string, unit: string) => {
    try {
      const newCustom = await findOrCreateCustomIngredient(name, unit);
      await addCustomToFridge(newCustom.id);
      const [fridge, custom, collection, userRecipes] = await Promise.all([
        getFridgeWithDetails(),
        getCustomIngredients(),
        getCollectionWithDetails(),
        getUserRecipes(),
      ]);
      setCustomIngredients(custom);
      const fridgeIngs = fridge.map((item) => item.ingredient).filter(Boolean);
      setShoppingList(buildShoppingList(fridgeIngs, collection, userRecipes));
    } catch (e) {
      console.error('Failed to add custom ingredient:', e);
    }
  };

  const handleExportShoppingList = async () => {
    if (shoppingList.length === 0) return;

    const today = new Date().toLocaleDateString();

    const recipeNames = Array.from(
      new Set(shoppingList.flatMap((item) => item.entries.map((entry) => entry.recipeName)))
    ).sort();

    const listText = shoppingList
      .map((item) => {
        const totalText =
          item.totalsByUnit.length > 0
            ? ` — ${item.totalsByUnit
                .map((t) => {
                  const c = convertUnit(t.total, t.unit, unitSystem);
                  return `${formatAmount(c.amount)}${c.unit && c.unit !== 'whole' ? ` ${c.unit}` : ''}`;
                })
                .join(', ')}`
            : '';
        return `• ${item.name}${totalText}`;
      })
      .join('\n');

    const shareText = `Shopping List - ${today}\n\nFor recipes:\n${recipeNames.map((name) => `• ${name}`).join('\n')}\n\nIngredients:\n${listText}`;

    try {
      await Share.share({
        message: shareText,
        title: 'Shopping List',
      });
    } catch (error) {
      console.error('Error sharing shopping list:', error);
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
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
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
            Shopping List ({shoppingList.length})
          </Text>
          {shoppingList.length > 0 && (
            <TouchableOpacity
              onPress={handleExportShoppingList}
              accessible={true}
              accessibilityLabel="Export shopping list"
              accessibilityRole="button"
              style={{
                backgroundColor: '#007aff',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
              <Ionicons name="share-outline" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Export</Text>
            </TouchableOpacity>
          )}
        </View>

        {shoppingList.length === 0 ? (
          <View style={{ alignItems: 'center', marginVertical: 60 }}>
            <Ionicons name="cart-outline" size={64} color={isDark ? '#3a3a3c' : '#d1d1d6'} />
            <Text
              style={{
                color: isDark ? '#8e8e93' : '#636366',
                textAlign: 'center',
                marginTop: 16,
                fontSize: 16,
              }}>
              No missing ingredients
            </Text>
            <Text
              style={{
                color: isDark ? '#8e8e93' : '#636366',
                textAlign: 'center',
                marginTop: 4,
                fontSize: 14,
              }}>
              Add recipes to your collection to generate a shopping list
            </Text>
          </View>
        ) : (
          shoppingList.map((item, idx) => {
            const builtInIng = findBuiltInIngredient(item.name, allIngredients);
            const customIng = findCustomIngredient(item.name, customIngredients);
            const firstUnit = item.entries.length > 0 ? item.entries[0].unit : '';
            return (
              <View
                key={idx}
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isDark ? '#ffffff' : '#000000',
                        fontSize: 16,
                        fontWeight: '600',
                        marginBottom: 2,
                      }}>
                      {item.name}
                      {item.totalsByUnit.length > 0 && (
                        <Text style={{ fontWeight: '400' }}>
                          {' — '}
                          {item.totalsByUnit
                            .map((t) => {
                              const c = convertUnit(t.total, t.unit, unitSystem);
                              return `${formatAmount(c.amount)}${c.unit && c.unit !== 'whole' ? ` ${c.unit}` : ''}`;
                            })
                            .join(', ')}
                        </Text>
                      )}
                    </Text>
                    <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12, marginTop: 2 }}>
                      {item.entries
                        .map((e) => {
                          const c = convertUnit(e.amount * e.multiplier, e.unit, unitSystem);
                          return `${formatAmount(c.amount)}${c.unit && c.unit !== 'whole' ? ` ${c.unit}` : ''} from ${e.recipeName}${e.multiplier !== 1 ? ` (${e.multiplier}x)` : ''}`;
                        })
                        .join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (builtInIng) {
                        handleAddToFridge(builtInIng.id);
                      } else if (customIng) {
                        handleAddCustomToFridge(customIng.id);
                      } else {
                        handleAddNewCustomIngredient(item.name, firstUnit);
                      }
                    }}
                    accessible={true}
                    accessibilityLabel={`Mark ${item.name} as got it`}
                    accessibilityRole="button"
                    style={{
                      marginLeft: 8,
                      alignSelf: 'center',
                    }}>
                    <Ionicons name="checkmark-circle-outline" size={28} color="#34c759" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
