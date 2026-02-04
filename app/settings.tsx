import { View, Text, ScrollView, Pressable, Linking, useColorScheme, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG } from '../config/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getUserFridge, getUserCollection, getUserRecipes, getCustomIngredients } from '../lib/storage';

export default function Settings() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fridgeCount, setFridgeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [customRecipesCount, setCustomRecipesCount] = useState(0);
  const [customIngredientsCount, setCustomIngredientsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const loadCounts = async () => {
        const [fridge, collection, userRecipes, customIngredients] = await Promise.all([
          getUserFridge(),
          getUserCollection(),
          getUserRecipes(),
          getCustomIngredients(),
        ]);
        setFridgeCount(fridge.length);
        setCollectionCount(collection.length);
        setCustomRecipesCount(userRecipes.length);
        setCustomIngredientsCount(customIngredients.length);
      };
      loadCounts();
    }, [])
  );

  const handlePrivacyPress = () => {
    Linking.openURL(APP_CONFIG.privacyPolicyUrl);
  };

  const handleTermsPress = () => {
    Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  };

  const handleSupportPress = () => {
    Linking.openURL(APP_CONFIG.supportUrl);
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'This will clear your fridge, collection, and custom recipes. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('userFridge', JSON.stringify([]));
              await AsyncStorage.setItem('userCollection', JSON.stringify([]));
              await AsyncStorage.setItem('userRecipes', JSON.stringify([]));
              await AsyncStorage.setItem('customIngredients', JSON.stringify([]));
              setFridgeCount(0);
              setCollectionCount(0);
              setCustomRecipesCount(0);
              setCustomIngredientsCount(0);
              Alert.alert('Success', 'All data has been reset');
            } catch {
              Alert.alert('Error', 'Failed to reset data');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* User Data Section */}
        <View
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
          <Text
            style={{
              color: isDark ? '#ffffff' : '#000000',
              fontSize: 18,
              fontWeight: '600',
              marginBottom: 12,
            }}>
            Your Data
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
              Fridge Items:
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {fridgeCount}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
              Saved Recipes:
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {collectionCount}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
              Custom Recipes:
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {customRecipesCount}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>
              Custom Ingredients:
            </Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {customIngredientsCount}
            </Text>
          </View>
        </View>

        {/* App Info Section */}
        <View
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>App Name:</Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {APP_CONFIG.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>Version:</Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>
              {APP_CONFIG.version}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 14 }}>Developer:</Text>
            <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 14 }}>Nomadsoft</Text>
          </View>
        </View>

        {/* Actions Section */}
        <View style={{ marginBottom: 16 }}>
          <Pressable
            onPress={handleSupportPress}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="help-circle-outline"
                size={24}
                color="#007aff"
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                Support & Help
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#8e8e93' : '#636366'} />
          </Pressable>

          <Pressable
            onPress={handlePrivacyPress}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color="#007aff"
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                Privacy Policy
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={isDark ? '#8e8e93' : '#636366'} />
          </Pressable>

          <Pressable
            onPress={handleTermsPress}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color="#007aff"
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 16 }}>
                Terms of Use
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={isDark ? '#8e8e93' : '#636366'} />
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: isDark ? '#8e8e93' : '#636366',
              fontSize: 13,
              fontWeight: '600',
              marginBottom: 8,
              marginLeft: 4,
            }}>
            DANGER ZONE
          </Text>
          <Pressable
            onPress={handleResetData}
            style={{
              backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="trash-outline"
                size={24}
                color="#ff3b30"
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: '#ff3b30', fontSize: 16 }}>Reset All Data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#8e8e93' : '#636366'} />
          </Pressable>
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text
            style={{
              color: isDark ? '#8e8e93' : '#636366',
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 4,
            }}>
            {APP_CONFIG.copyright}
          </Text>
          <Text
            style={{
              color: isDark ? '#8e8e93' : '#636366',
              fontSize: 12,
              textAlign: 'center',
            }}>
            Built for RevenueCat Hackathon
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
