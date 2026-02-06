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
}: RecipeDetailModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fridgeIngredients, setFridgeIngredients] = useState<Ingredient[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);

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
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 16, marginBottom: 16 }}>
            {recipe.description}
          </Text>

          <View style={{ gap: 8, marginBottom: 20 }}>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🍽️ {recipe.servings} servings
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🥣 Prep: {recipe.prepTime} min
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 15 }}>
              🍳 Cook: {recipe.cookTime} min
            </Text>
          </View>

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
              return (
                <View
                  key={idx}
                  style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'center' }}>
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
                    {ing.amount ? `${ing.amount} ` : ''}
                    {ing.unit ? `${ing.unit} ` : ''}
                    {ing.name}
                    {ing.preparation && `, ${ing.preparation}`}
                    {ing.optional && ' (optional)'}
                  </Text>
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
