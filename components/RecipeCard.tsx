import { View, Text, TouchableOpacity, useColorScheme, Image } from 'react-native';
import { Recipe } from '../types';
import { useState } from 'react';
import ImageViewer from './ImageViewer';
import { getRecipeImage } from '../lib/images';

type RecipeCardProps = {
  recipe: Recipe;
  isInCollection: boolean;
  onView: () => void;
  onToggleCollection: () => void;
};

export default function RecipeCard({
  recipe,
  isInCollection,
  onView,
  onToggleCollection,
}: RecipeCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const firstImage = recipe.images && recipe.images.length > 0 ? getRecipeImage(recipe.images[0]) : null;

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}>
      {firstImage && (
        <TouchableOpacity onPress={() => setImageViewerVisible(true)} style={{ marginBottom: 12 }}>
          <Image
            source={firstImage}
            style={{ width: '100%', height: 200, borderRadius: 8 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
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
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
            ⭐ {recipe.rating.toFixed(1)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={onView}
          accessible={true}
          accessibilityLabel={`View ${recipe.name} recipe details`}
          accessibilityRole="button"
          style={{
            flex: 1,
            backgroundColor: isDark ? '#007aff' : '#007aff',
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#ffffff', fontWeight: '600' }}>View</Text>
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
            flex: 1,
            backgroundColor: isInCollection
              ? isDark
                ? '#34c759'
                : '#34c759'
              : isDark
                ? '#2c2c2e'
                : '#e5e5ea',
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: isInCollection ? '#ffffff' : isDark ? '#ffffff' : '#000000',
              fontWeight: '600',
            }}>
            {isInCollection ? '✓ In Collection' : '+ Add'}
          </Text>
        </TouchableOpacity>
      </View>

      <ImageViewer
        visible={imageViewerVisible}
        imageUri={firstImage}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}
