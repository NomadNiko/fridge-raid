import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ingredient } from '../types/ingredient';

type IngredientCardProps = {
  ingredient: Ingredient;
  isInFridge: boolean;
  onPress: () => void;
};

const IngredientCard = React.memo(({ ingredient, isInFridge, onPress }: IngredientCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showAltNames, setShowAltNames] = useState(false);
  const hasAltNames = ingredient.alternativeNames && ingredient.alternativeNames.length > 0;

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isInFridge}
        style={{
          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
          padding: 12,
          borderRadius: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: isInFridge ? 0.5 : 1,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
              {ingredient.name}
            </Text>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
              {ingredient.category}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasAltNames && (
            <TouchableOpacity onPress={() => setShowAltNames(!showAltNames)}>
              <Ionicons name="information-circle-outline" size={24} color="#8e8e93" />
            </TouchableOpacity>
          )}
          {isInFridge ? (
            <Ionicons name="checkmark-circle" size={24} color="#34c759" />
          ) : (
            <Ionicons name="add-circle-outline" size={24} color="#007aff" />
          )}
        </View>
      </TouchableOpacity>
      {showAltNames && hasAltNames && (
        <View
          style={{
            backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea',
            padding: 12,
            borderRadius: 8,
            marginTop: 4,
          }}>
          <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12, marginBottom: 6 }}>
            Also known as:
          </Text>
          {ingredient.alternativeNames?.map((alt, idx) => (
            <Text key={idx} style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14, marginBottom: 2 }}>
              • {alt}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
});

IngredientCard.displayName = 'IngredientCard';

export default IngredientCard;
