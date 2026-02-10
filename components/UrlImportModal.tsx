import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchUrlWithRetry } from '../lib/ocr/urlFetcher';
import { formatRecipeFromUrlWithRetry, FormattedRecipe } from '../lib/ocr/recipeFormatter';
import IngredientAlternativePicker from './IngredientAlternativePicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRecipeScanned: (recipe: {
    name: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string; preparation?: string }[];
    instructions: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    cuisine: string;
    category: string;
    mealType: string;
  }) => void;
  onRecipeAdded?: (recipe: {
    name: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string; preparation?: string }[];
    instructions: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    cuisine: string;
    category: string;
    mealType: string;
  }) => void;
}

type ImportStatus = 'url-input' | 'fetching' | 'parsing' | 'choosing-alternatives' | 'preview' | 'error';

export default function UrlImportModal({
  visible,
  onClose,
  onRecipeScanned,
  onRecipeAdded,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [status, setStatus] = useState<ImportStatus>('url-input');
  const [url, setUrl] = useState('');
  const [parsedRecipe, setParsedRecipe] = useState<FormattedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setStatus('url-input');
    setUrl('');
    setParsedRecipe(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const hasAlternatives = (recipe: FormattedRecipe): boolean => {
    return recipe.ingredients.some(
      (ing) => ing.alternatives && ing.alternatives.length > 0
    );
  };

  const getIngredientsWithAlternatives = (recipe: FormattedRecipe) => {
    return recipe.ingredients
      .map((ing, index) => ({ ...ing, index }))
      .filter((ing) => ing.alternatives && ing.alternatives.length > 0) as {
        index: number;
        name: string;
        amount: string;
        unit: string;
        preparation?: string;
        alternatives: string[];
      }[];
  };

  const handleAlternativesChosen = (choices: { index: number; chosenName: string }[]) => {
    if (!parsedRecipe) return;

    const updatedIngredients = parsedRecipe.ingredients.map((ing, idx) => {
      const choice = choices.find((c) => c.index === idx);
      const { alternatives, ...rest } = ing;
      if (choice) {
        return { ...rest, name: choice.chosenName };
      }
      return rest;
    });

    setParsedRecipe({
      ...parsedRecipe,
      ingredients: updatedIngredients,
    });
    setStatus('preview');
  };

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    Keyboard.dismiss();
    setStatus('fetching');
    setError(null);

    try {
      // Step 1: Fetch URL content
      const fetchResult = await fetchUrlWithRetry(url);

      if (!fetchResult.success) {
        setError(fetchResult.error || 'Failed to fetch URL');
        setStatus('error');
        return;
      }

      if (!fetchResult.text || fetchResult.text.trim().length === 0) {
        setError('No content found on this page.');
        setStatus('error');
        return;
      }

      // Step 2: Extract recipe with Bedrock
      setStatus('parsing');
      const formatResult = await formatRecipeFromUrlWithRetry(fetchResult.text);

      if (!formatResult.success || !formatResult.recipe) {
        setError(formatResult.error || 'Failed to extract recipe');
        setStatus('error');
        return;
      }

      if (
        formatResult.recipe.ingredients.length === 0 &&
        formatResult.recipe.instructions.length === 0
      ) {
        setError('Could not identify recipe content on this page. Please try a different URL.');
        setStatus('error');
        return;
      }

      setParsedRecipe(formatResult.recipe);
      if (hasAlternatives(formatResult.recipe)) {
        setStatus('choosing-alternatives');
      } else {
        setStatus('preview');
      }
    } catch (err) {
      setError(`Import failed: ${err}`);
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('url-input');
    setError(null);
    setParsedRecipe(null);
  };

  const handleEditRecipe = () => {
    if (parsedRecipe) {
      onRecipeScanned({
        name: parsedRecipe.name,
        description: parsedRecipe.description,
        ingredients:
          parsedRecipe.ingredients.length > 0
            ? parsedRecipe.ingredients
            : [{ name: '', amount: '', unit: '' }],
        instructions: parsedRecipe.instructions.length > 0 ? parsedRecipe.instructions : [''],
        prepTime: parsedRecipe.prepTime,
        cookTime: parsedRecipe.cookTime,
        servings: parsedRecipe.servings,
        cuisine: parsedRecipe.cuisine,
        category: parsedRecipe.category,
        mealType: parsedRecipe.mealType,
      });
      handleClose();
    }
  };

  const handleAddRecipe = () => {
    if (parsedRecipe && onRecipeAdded) {
      onRecipeAdded({
        name: parsedRecipe.name,
        description: parsedRecipe.description,
        ingredients:
          parsedRecipe.ingredients.length > 0
            ? parsedRecipe.ingredients
            : [{ name: '', amount: '', unit: '' }],
        instructions: parsedRecipe.instructions.length > 0 ? parsedRecipe.instructions : [''],
        prepTime: parsedRecipe.prepTime,
        cookTime: parsedRecipe.cookTime,
        servings: parsedRecipe.servings,
        cuisine: parsedRecipe.cuisine,
        category: parsedRecipe.category,
        mealType: parsedRecipe.mealType,
      });
      handleClose();
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'url-input':
        return (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}>
            <View style={styles.centeredContent}>
              <View
                style={[styles.iconContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
                <Ionicons name="link" size={48} color="#007aff" />
              </View>
              <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
                Import from URL
              </Text>
              <Text style={[styles.subtitle, { color: isDark ? '#8e8e93' : '#636366' }]}>
                {"Paste a link to a recipe page and we'll extract the recipe for you"}
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://example.com/recipe"
                  placeholderTextColor={isDark ? '#636366' : '#8e8e93'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleImport}
                  style={[
                    styles.urlInput,
                    {
                      backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
                      color: isDark ? '#fff' : '#000',
                      borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                    },
                  ]}
                />
              </View>

              {error && status === 'url-input' && <Text style={styles.inlineError}>{error}</Text>}

              <TouchableOpacity
                onPress={handleImport}
                disabled={!url.trim()}
                style={[styles.primaryButton, !url.trim() && styles.primaryButtonDisabled]}>
                <Ionicons
                  name="download-outline"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>Import Recipe</Text>
              </TouchableOpacity>

              <View style={styles.tipsContainer}>
                <Text style={[styles.tipsTitle, { color: isDark ? '#8e8e93' : '#636366' }]}>
                  Tips for best results:
                </Text>
                <Text style={[styles.tipText, { color: isDark ? '#636366' : '#8e8e93' }]}>
                  • Use direct links to recipe pages
                </Text>
                <Text style={[styles.tipText, { color: isDark ? '#636366' : '#8e8e93' }]}>
                  • Works best with popular recipe sites
                </Text>
                <Text style={[styles.tipText, { color: isDark ? '#636366' : '#8e8e93' }]}>
                  • Avoid links that require login
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        );

      case 'fetching':
      case 'parsing':
        return (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color="#007aff" />
            <Text style={[styles.statusText, { color: isDark ? '#fff' : '#000' }]}>
              {status === 'fetching' ? 'Loading page...' : 'Extracting recipe...'}
            </Text>
            <Text
              style={[styles.urlPreview, { color: isDark ? '#8e8e93' : '#636366' }]}
              numberOfLines={1}>
              {url}
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.centeredContent}>
            <Ionicons name="alert-circle" size={60} color="#ff3b30" />
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Import Failed</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#8e8e93' : '#636366' }]}>
              {error}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={handleRetry} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClose}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' },
                ]}>
                <Text style={[styles.secondaryButtonText, { color: isDark ? '#fff' : '#000' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'choosing-alternatives':
        if (!parsedRecipe) return null;
        return (
          <IngredientAlternativePicker
            ingredients={getIngredientsWithAlternatives(parsedRecipe)}
            onComplete={handleAlternativesChosen}
            isDark={isDark}
          />
        );

      case 'preview':
        if (!parsedRecipe) return null;
        return (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={true}>
              <Text style={[styles.recipeName, { color: isDark ? '#fff' : '#000' }]}>
                {parsedRecipe.name || 'Untitled Recipe'}
              </Text>

              {parsedRecipe.description && (
                <Text style={[styles.recipeDescription, { color: isDark ? '#8e8e93' : '#636366' }]}>
                  {parsedRecipe.description}
                </Text>
              )}

              {(parsedRecipe.prepTime || parsedRecipe.cookTime || parsedRecipe.servings) && (
                <View style={styles.metadataRow}>
                  {parsedRecipe.prepTime && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={isDark ? '#8e8e93' : '#636366'}
                      />
                      <Text
                        style={{
                          color: isDark ? '#8e8e93' : '#636366',
                          fontSize: 12,
                          marginLeft: 4,
                        }}>
                        Prep: {parsedRecipe.prepTime} min
                      </Text>
                    </View>
                  )}
                  {parsedRecipe.cookTime && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Ionicons
                        name="flame-outline"
                        size={14}
                        color={isDark ? '#8e8e93' : '#636366'}
                      />
                      <Text
                        style={{
                          color: isDark ? '#8e8e93' : '#636366',
                          fontSize: 12,
                          marginLeft: 4,
                        }}>
                        Cook: {parsedRecipe.cookTime} min
                      </Text>
                    </View>
                  )}
                  {parsedRecipe.servings && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={isDark ? '#8e8e93' : '#636366'}
                      />
                      <Text
                        style={{
                          color: isDark ? '#8e8e93' : '#636366',
                          fontSize: 12,
                          marginLeft: 4,
                        }}>
                        Serves: {parsedRecipe.servings}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {(parsedRecipe.cuisine || parsedRecipe.category || parsedRecipe.mealType) && (
                <View style={styles.metadataRow}>
                  {parsedRecipe.cuisine && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
                        {parsedRecipe.cuisine}
                      </Text>
                    </View>
                  )}
                  {parsedRecipe.mealType && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
                        {parsedRecipe.mealType}
                      </Text>
                    </View>
                  )}
                  {parsedRecipe.category && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
                        {parsedRecipe.category}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
                Ingredients ({parsedRecipe.ingredients.length})
              </Text>
              <View
                style={[styles.listContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' }]}>
                {parsedRecipe.ingredients.map(
                  (
                    ing: { name: string; amount: string; unit: string; preparation?: string },
                    idx: number
                  ) => (
                    <View
                      key={idx}
                      style={[
                        styles.listItem,
                        idx < parsedRecipe.ingredients.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: isDark ? '#2c2c2e' : '#e5e5ea',
                        },
                      ]}>
                      <Text style={{ color: isDark ? '#fff' : '#000', fontSize: 15 }}>
                        {ing.amount ? `${ing.amount} ` : ''}
                        {ing.unit && ing.unit !== 'whole' ? `${ing.unit} ` : ''}
                        {ing.name}
                        {ing.preparation ? `, ${ing.preparation}` : ''}
                      </Text>
                    </View>
                  )
                )}
                {parsedRecipe.ingredients.length === 0 && (
                  <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontStyle: 'italic' }}>
                    No ingredients detected
                  </Text>
                )}
              </View>

              <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
                Instructions ({parsedRecipe.instructions.length})
              </Text>
              <View
                style={[
                  styles.listContainer,
                  { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7', marginBottom: 24 },
                ]}>
                {parsedRecipe.instructions.map((inst: string, idx: number) => (
                  <View
                    key={idx}
                    style={[
                      styles.instructionItem,
                      idx < parsedRecipe.instructions.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? '#2c2c2e' : '#e5e5ea',
                      },
                    ]}>
                    <Text style={styles.stepNumber}>{idx + 1}.</Text>
                    <Text style={[styles.instructionText, { color: isDark ? '#fff' : '#000' }]}>
                      {inst}
                    </Text>
                  </View>
                ))}
                {parsedRecipe.instructions.length === 0 && (
                  <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontStyle: 'italic' }}>
                    No instructions detected
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.sourceContainer,
                  { backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7' },
                ]}>
                <Ionicons name="link-outline" size={14} color={isDark ? '#8e8e93' : '#636366'} />
                <Text
                  style={[styles.sourceText, { color: isDark ? '#8e8e93' : '#636366' }]}
                  numberOfLines={1}>
                  {url}
                </Text>
              </View>
            </ScrollView>

            <View style={[styles.actionBar, { borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
              <TouchableOpacity
                onPress={handleRetry}
                style={[
                  styles.actionButtonSmall,
                  { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' },
                ]}>
                <Text style={[styles.actionButtonText, { color: isDark ? '#fff' : '#000' }]}>
                  Try Different URL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddRecipe}
                style={[styles.actionButton, { backgroundColor: '#34c759' }]}>
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Add Recipe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditRecipe}
                style={[styles.actionButton, { backgroundColor: '#007aff' }]}>
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Edit Recipe</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
            {status === 'preview'
              ? 'Review Recipe'
              : status === 'choosing-alternatives'
                ? 'Choose Ingredients'
                : 'Import from URL'}
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>

        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  urlInput: {
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineError: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  tipsContainer: {
    marginTop: 40,
    paddingHorizontal: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 17,
    marginTop: 16,
  },
  urlPreview: {
    fontSize: 14,
    marginTop: 8,
    maxWidth: '80%',
  },
  recipeName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metadataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  listContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  listItem: {
    paddingVertical: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  stepNumber: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: '600',
    width: 28,
  },
  instructionText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sourceText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonSmall: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
