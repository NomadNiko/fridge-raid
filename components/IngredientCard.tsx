import React from 'react';
import { View, Text, TouchableOpacity, Image, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '../types/ingredient';
import { getIngredientImage } from '../lib/ingredientImages';

type IngredientCardProps = {
  ingredient: Ingredient;
  isInFridge: boolean;
  onPress: () => void;
};

const IngredientCard = React.memo(({ ingredient, isInFridge, onPress }: IngredientCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const imageSource = ingredient.images && ingredient.images.length > 0 ? getIngredientImage(ingredient.images[0]) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isInFridge}
      style={{
        backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: isInFridge ? 0.5 : 1,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {imageSource && (
          <Image
            source={imageSource}
            style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }}
            resizeMode="cover"
          />
        )}
        <View>
          <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
            {ingredient.name}
          </Text>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
            {ingredient.category}
          </Text>
        </View>
      </View>
      {isInFridge ? (
        <Ionicons name="checkmark-circle" size={24} color="#34c759" />
      ) : (
        <Ionicons name="add-circle-outline" size={24} color="#007aff" />
      )}
    </TouchableOpacity>
  );
});

IngredientCard.displayName = 'IngredientCard';

export default IngredientCard;
