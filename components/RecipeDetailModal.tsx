import { Modal, View, Text, ScrollView, TouchableOpacity, useColorScheme, Image } from 'react-native';
import { Recipe } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getFridgeWithDetails } from '../lib/storage';
import ImageViewer from './ImageViewer';

type RecipeDetailModalProps = {
  visible: boolean;
  recipe: Recipe | null;
  isInCollection: boolean;
  onClose: () => void;
  onToggleCollection: () => void;
};

export default function RecipeDetailModal({
  visible,
  recipe,
  isInCollection,
  onClose,
  onToggleCollection,
}: RecipeDetailModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      getFridgeWithDetails().then((fridge) => {
        const ingredientNames = fridge.map((item) => item.ingredient?.name.toLowerCase());
        setFridgeIngredients(ingredientNames);
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
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {recipe.images && recipe.images.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
                {recipe.images.map((img, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedImage(img.type === 'local' ? img.uri : { uri: img.uri });
                      setImageViewerVisible(true);
                    }}
                    style={{ marginLeft: idx === 0 ? 16 : 8, marginRight: idx === recipe.images.length - 1 ? 16 : 0 }}>
                    <Image
                      source={img.type === 'local' ? img.uri : { uri: img.uri }}
                      style={{ width: 300, height: 200, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
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

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <View
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}>
              <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                🍽️ {recipe.servings} servings
              </Text>
            </View>
            <View
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}>
              <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                ⏱️ {recipe.totalTime} min
              </Text>
            </View>
            <View
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}>
              <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>📊 {recipe.difficulty}</Text>
            </View>
            <View
              style={{
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}>
              <Text style={{ color: isDark ? '#ffffff' : '#000000' }}>
                ⭐ {recipe.rating.toFixed(1)}
              </Text>
            </View>
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
              const hasIngredient = fridgeIngredients.includes(ing.name.toLowerCase());
              return (
                <View
                  key={idx}
                  style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'center' }}>
                  {!hasIngredient && (
                    <Ionicons name="close" size={16} color="#ff3b30" style={{ marginRight: 4 }} />
                  )}
                  {hasIngredient && (
                    <Text style={{ color: isDark ? '#8e8e93' : '#636366', marginRight: 8 }}>•</Text>
                  )}
                  <Text
                    style={{
                      color: hasIngredient ? (isDark ? '#ffffff' : '#000000') : '#ff3b30',
                      flex: 1,
                      fontStyle: hasIngredient ? 'normal' : 'italic',
                    }}>
                    {ing.amount} {ing.unit} {ing.name}
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

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 22,
              fontWeight: '600',
              marginTop: 24,
              marginBottom: 12,
            }}>
            Equipment Needed
          </Text>
          {recipe.equipment.map((eq: { id: string; name: string; alternatives: string[] }) => (
            <View key={eq.id} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: isDark ? '#8e8e93' : '#636366', marginRight: 8 }}>•</Text>
              <Text style={{ color: isDark ? '#ffffff' : '#000000', flex: 1 }}>
                {eq.name}
                {eq.alternatives.length > 0 && ` (or ${eq.alternatives.join(', ')})`}
              </Text>
            </View>
          ))}

          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 22,
              fontWeight: '600',
              marginTop: 24,
              marginBottom: 12,
            }}>
            Nutrition (per serving)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366' }}>
              Calories: {recipe.nutrition.calories}
            </Text>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366' }}>
              Protein: {recipe.nutrition.protein}g
            </Text>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366' }}>
              Carbs: {recipe.nutrition.carbs}g
            </Text>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366' }}>
              Fat: {recipe.nutrition.fat}g
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <ImageViewer
        visible={imageViewerVisible}
        imageUri={selectedImage}
        onClose={() => setImageViewerVisible(false)}
      />
    </Modal>
  );
}
