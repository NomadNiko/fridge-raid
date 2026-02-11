import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Image,
} from 'react-native';
import { Recipe } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getFridgeWithDetails } from '../lib/storage';
import ImageViewer from './ImageViewer';
import { getRecipeImage } from '../lib/images';
import { Ingredient } from '../types/ingredient';
import { hasIngredient } from '../lib/ingredientMatcher';
import { UnitSystem, convertUnit } from '../lib/unitConversion';

const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3];

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toString();
};

type RecipeDetailModalProps = {
  visible: boolean;
  recipe: Recipe | null;
  isInCollection: boolean;
  onClose: () => void;
  onToggleCollection: () => void;
  hideCollectionButton?: boolean;
  // Navigation props (optional)
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  // Multiplier props (optional)
  multiplier?: number;
  onMultiplierChange?: (m: number) => void;
  // Unit system prop (optional)
  unitSystem?: UnitSystem;
};

export default function RecipeDetailModal({
  visible,
  recipe,
  isInCollection,
  onClose,
  onToggleCollection,
  hideCollectionButton = false,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  multiplier = 1,
  onMultiplierChange,
  unitSystem = 'original',
}: RecipeDetailModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fridgeIngredients, setFridgeIngredients] = useState<Ingredient[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [expandedIngredients, setExpandedIngredients] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (visible) {
      getFridgeWithDetails().then((fridge) => {
        const ingredients = fridge.map((item) => item.ingredient).filter(Boolean);
        setFridgeIngredients(ingredients);
      });
    }
  }, [visible]);

  if (!recipe) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#1c1c1e' : '#e5e5ea',
          }}>
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Close recipe details"
            accessibilityRole="button">
            <Text style={{ color: '#007aff', fontSize: 17 }}>Close</Text>
          </TouchableOpacity>
          {!hideCollectionButton && (
            <TouchableOpacity
              onPress={onToggleCollection}
              accessible={true}
              accessibilityLabel={
                isInCollection
                  ? `Remove ${recipe.name} from collection`
                  : `Add ${recipe.name} to collection`
              }
              accessibilityRole="button"
              style={{
                backgroundColor: isInCollection ? '#34c759' : '#007aff',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}>
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                {isInCollection ? '✓ In Collection' : '+ Add to Collection'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {recipe.images && recipe.images.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -16 }}>
                {recipe.images.map((img, idx) => {
                  const imageSource = getRecipeImage(img);
                  if (!imageSource) return null;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setSelectedImage(imageSource);
                        setImageViewerVisible(true);
                      }}
                      style={{
                        marginLeft: idx === 0 ? 16 : 8,
                        marginRight: idx === recipe.images.length - 1 ? 16 : 0,
                      }}>
                      <Image
                        source={imageSource}
                        style={{ width: 300, height: 200, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 28,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
            {recipe.name}
          </Text>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 16, marginBottom: 12 }}>
            {recipe.description}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
              <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 13 }}>
                {recipe.cuisine}
              </Text>
            </View>
            {recipe.mealType && (
              <View
                style={{
                  backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}>
                <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 13 }}>
                  {recipe.mealType}
                </Text>
              </View>
            )}
          </View>

          <View style={{ gap: 8, marginBottom: 20 }}>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🍽️ {formatAmount(recipe.servings * multiplier)} servings{multiplier !== 1 ? ` (${multiplier}x)` : ''}
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🥣 Prep: {recipe.prepTime} min
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🍳 Cook: {recipe.cookTime} min
            </Text>
          </View>

          {onMultiplierChange && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                Servings Multiplier
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {MULTIPLIER_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => onMultiplierChange(m)}
                    style={{
                      backgroundColor: multiplier === m ? '#007aff' : isDark ? '#2c2c2e' : '#e5e5ea',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                    }}>
                    <Text style={{
                      color: multiplier === m ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      {m}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 22,
              fontWeight: '600',
              marginBottom: 12,
            }}>
            Ingredients
          </Text>
          {recipe.ingredients.map(
            (
              ing: {
                name: string;
                amount: number;
                unit: string;
                preparation: string | null;
                optional: boolean;
              },
              idx: number
            ) => {
              const hasIng = hasIngredient(ing.name, fridgeIngredients);
              const displayAmount = ing.amount ? ing.amount * multiplier : 0;
              const converted = convertUnit(displayAmount, ing.unit, unitSystem);
              const matchedIngredient = fridgeIngredients.find((fi) => 
                fi.name.toLowerCase() === ing.name.toLowerCase() ||
                fi.alternativeNames?.some((alt: string) => alt.toLowerCase() === ing.name.toLowerCase())
              );
              const hasAltNames = matchedIngredient?.alternativeNames && matchedIngredient.alternativeNames.length > 0;
              const isExpanded = expandedIngredients.has(idx);
              return (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!hasIng && (
                      <Ionicons name="close" size={16} color="#ff3b30" style={{ marginRight: 4 }} />
                    )}
                    {hasIng && (
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', marginRight: 8 }}>•</Text>
                    )}
                    <Text
                      style={{
                        color: hasIng ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                        flex: 1,
                        fontStyle: hasIng ? 'normal' : 'italic',
                      }}>
                      {converted.amount ? `${formatAmount(converted.amount)} ` : ''}
                      {converted.unit && converted.unit !== 'whole' ? `${converted.unit} ` : ''}
                      {ing.name}
                      {ing.preparation && `, ${ing.preparation}`}
                      {ing.optional && ' (optional)'}
                    </Text>
                    {hasAltNames && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedIngredients((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) {
                              next.delete(idx);
                            } else {
                              next.add(idx);
                            }
                            return next;
                          });
                        }}
                        style={{ marginLeft: 8 }}>
                        <Ionicons name="information-circle-outline" size={20} color="#8e8e93" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {isExpanded && hasAltNames && (
                    <View
                      style={{
                        backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
                        padding: 8,
                        borderRadius: 6,
                        marginTop: 4,
                        marginLeft: 20,
                      }}>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 11, marginBottom: 4 }}>
                        Also known as:
                      </Text>
                      {matchedIngredient.alternativeNames?.map((alt: string, altIdx: number) => (
                        <Text key={altIdx} style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 13, marginBottom: 1 }}>
                          • {alt}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            }
          )}

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 22,
              fontWeight: '600',
              marginTop: 24,
              marginBottom: 12,
            }}>
            Instructions
          </Text>
          {recipe.instructions.map((inst: { step: number; text: string }) => (
            <View key={inst.step} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: isDark ? '#007aff' : '#007aff',
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                Step {inst.step}
              </Text>
              <Text style={{ color: isDark ? '#ffffff' : '#000000', lineHeight: 22 }}>
                {inst.text}
              </Text>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Navigation bar */}
        {(onPrevious || onNext) && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: isDark ? '#1c1c1e' : '#e5e5ea',
            }}>
            <TouchableOpacity
              onPress={onPrevious}
              disabled={!hasPrevious}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                opacity: hasPrevious ? 1 : 0.3,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
              accessible={true}
              accessibilityLabel="Previous recipe"
              accessibilityRole="button">
              <Ionicons name="chevron-back" size={24} color="#007aff" />
              <Text style={{ color: '#007aff', fontSize: 16, marginLeft: 4 }}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNext}
              disabled={!hasNext}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                opacity: hasNext ? 1 : 0.3,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
              accessible={true}
              accessibilityLabel="Next recipe"
              accessibilityRole="button">
              <Text style={{ color: '#007aff', fontSize: 16, marginRight: 4 }}>Next</Text>
              <Ionicons name="chevron-forward" size={24} color="#007aff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ImageViewer
        visible={imageViewerVisible}
        imageUri={selectedImage}
        onClose={() => setImageViewerVisible(false)}
      />
    </Modal>
  );
}
