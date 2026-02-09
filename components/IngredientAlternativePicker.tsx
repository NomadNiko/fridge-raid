import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface IngredientChoice {
  index: number;
  name: string;
  amount: string;
  unit: string;
  preparation?: string;
  alternatives: string[];
}

interface Props {
  ingredients: IngredientChoice[];
  onComplete: (choices: { index: number; chosenName: string }[]) => void;
  isDark: boolean;
}

export default function IngredientAlternativePicker({ ingredients, onComplete, isDark }: Props) {
  const [selections, setSelections] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    ingredients.forEach((ing) => {
      initial[ing.index] = ing.name;
    });
    return initial;
  });

  const handleSelect = (ingredientIndex: number, chosenName: string) => {
    setSelections((prev) => ({ ...prev, [ingredientIndex]: chosenName }));
  };

  const handleContinue = () => {
    onComplete(
      ingredients.map((ing) => ({
        index: ing.index,
        chosenName: selections[ing.index],
      }))
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text
          style={{
            color: isDark ? '#8e8e93' : '#636366',
            fontSize: 14,
            marginBottom: 16,
            textAlign: 'center',
          }}>
          Some ingredients have alternatives. Tap to choose your preference.
        </Text>

        {ingredients.map((ing) => {
          const options = [ing.name, ...ing.alternatives];
          const contextParts: string[] = [];
          if (ing.amount) contextParts.push(ing.amount);
          if (ing.unit && ing.unit !== 'whole') contextParts.push(ing.unit);
          const context = contextParts.length > 0 ? contextParts.join(' ') + ' ' : '';
          const prepSuffix = ing.preparation ? `, ${ing.preparation}` : '';

          return (
            <View
              key={ing.index}
              style={[
                styles.card,
                { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' },
              ]}>
              <Text
                style={{
                  color: isDark ? '#8e8e93' : '#636366',
                  fontSize: 13,
                  marginBottom: 10,
                }}>
                {context}__________{prepSuffix}
              </Text>
              <View style={styles.optionsRow}>
                {options.map((option) => {
                  const isSelected = selections[ing.index] === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => handleSelect(ing.index, option)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: isSelected
                            ? '#007aff'
                            : isDark
                              ? '#2c2c2e'
                              : '#e5e5ea',
                        },
                      ]}>
                      <Text
                        style={{
                          color: isSelected ? '#ffffff' : isDark ? '#ffffff' : '#000000',
                          fontSize: 14,
                          fontWeight: '600',
                        }}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleContinue}
          style={[styles.continueButton, { backgroundColor: '#007aff' }]}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  continueButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
