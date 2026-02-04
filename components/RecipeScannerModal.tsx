import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { performOCRWithRetry, OCRResult } from '../lib/ocr/ocrService';
import { formatRecipeWithRetry, FormattedRecipe } from '../lib/ocr/recipeFormatter';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRecipeScanned: (recipe: {
    name: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string }[];
    instructions: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    cuisine: string;
    category: string;
  }) => void;
}

type ScanStatus = 'camera' | 'processing' | 'parsing' | 'preview' | 'error';

export default function RecipeScannerModal({ visible, onClose, onRecipeScanned }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [status, setStatus] = useState<ScanStatus>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<FormattedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setStatus('camera');
    setImageUri(null);
    setParsedRecipe(null);
    setError(null);
    setIsCapturing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo?.uri) {
        setImageUri(photo.uri);
        await processImage(photo.uri);
      }
    } catch (err) {
      setError(`Failed to capture photo: ${err}`);
      setStatus('error');
    } finally {
      setIsCapturing(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (libraryStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable photo library access in Settings.', [
        { text: 'OK' },
      ]);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setImageUri(uri);
      await processImage(uri);
    } catch (err) {
      setError(`Failed to pick image: ${err}`);
      setStatus('error');
    }
  };

  const processImage = async (uri: string) => {
    setStatus('processing');
    setError(null);

    try {
      // Step 1: OCR - extract text from image
      const ocrResult: OCRResult = await performOCRWithRetry(uri);

      if (!ocrResult.success) {
        setError(ocrResult.error || 'OCR failed');
        setStatus('error');
        return;
      }

      if (!ocrResult.rawText || ocrResult.rawText.trim().length === 0) {
        setError('No text detected. Please try again with a clearer photo of the recipe.');
        setStatus('error');
        return;
      }

      // Step 2: Format with Bedrock AI
      setStatus('parsing');
      const formatResult = await formatRecipeWithRetry(ocrResult.rawText);

      if (!formatResult.success || !formatResult.recipe) {
        setError(formatResult.error || 'Failed to parse recipe');
        setStatus('error');
        return;
      }

      if (
        formatResult.recipe.ingredients.length === 0 &&
        formatResult.recipe.instructions.length === 0
      ) {
        setError('Could not identify recipe content. Please try a clearer photo.');
        setStatus('error');
        return;
      }

      setParsedRecipe(formatResult.recipe);
      setStatus('preview');
    } catch (err) {
      setError(`Processing failed: ${err}`);
      setStatus('error');
    }
  };

  const handleRetry = () => {
    resetState();
  };

  const handleUseRecipe = () => {
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
      });
      handleClose();
    }
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}>
        <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
          <ActivityIndicator size="large" color="#007aff" />
        </View>
      </Modal>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}>
        <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
              Scan Recipe
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          <View style={styles.centeredContent}>
            <Ionicons name="camera-outline" size={64} color={isDark ? '#8e8e93' : '#636366'} />
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
              Camera Access Required
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#8e8e93' : '#636366' }]}>
              To scan recipes, please allow camera access.
            </Text>
            <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromLibrary}
              style={[styles.secondaryButton, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#fff' : '#000' }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const renderContent = () => {
    switch (status) {
      case 'camera':
        return (
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" autofocus="off" />
            {/* Viewfinder overlay - positioned absolutely on top of camera */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.instructionText}>Position the recipe within the frame</Text>
              </View>
            </View>

            {/* Camera controls */}
            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={pickFromLibrary} style={styles.libraryButton}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={capturePhoto}
                disabled={isCapturing}
                style={styles.captureButton}>
                <View
                  style={[styles.captureButtonInner, isCapturing && styles.captureButtonDisabled]}
                />
              </TouchableOpacity>

              <View style={styles.placeholder} />
            </View>
          </View>
        );

      case 'processing':
      case 'parsing':
        return (
          <View style={styles.centeredContent}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            )}
            <ActivityIndicator size="large" color="#007aff" />
            <Text style={[styles.statusText, { color: isDark ? '#fff' : '#000' }]}>
              {status === 'processing' ? 'Scanning text...' : 'Extracting recipe...'}
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.centeredContent}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={[styles.previewImage, { opacity: 0.5 }]}
                resizeMode="cover"
              />
            )}
            <Ionicons name="alert-circle" size={60} color="#ff3b30" />
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Scan Failed</Text>
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

      case 'preview':
        if (!parsedRecipe) return null;
        return (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={true}>
              <Text style={[styles.recipeName, { color: isDark ? '#fff' : '#000' }]}>
                {parsedRecipe.name || 'Untitled Recipe'}
              </Text>

              {(parsedRecipe.prepTime || parsedRecipe.cookTime || parsedRecipe.servings) && (
                <View style={styles.metadataRow}>
                  {parsedRecipe.prepTime && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' },
                      ]}>
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
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
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
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
                      <Text style={{ color: isDark ? '#8e8e93' : '#636366', fontSize: 12 }}>
                        Servings: {parsedRecipe.servings}
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
                  (ing: { name: string; amount: string; unit: string }, idx: number) => (
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
                        {ing.unit ? `${ing.unit} ` : ''}
                        {ing.name}
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
                    <Text style={[styles.instructionText2, { color: isDark ? '#fff' : '#000' }]}>
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
            </ScrollView>

            <View style={[styles.actionBar, { borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
              <TouchableOpacity
                onPress={handleRetry}
                style={[styles.actionButton, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
                <Text style={[styles.actionButtonText, { color: isDark ? '#fff' : '#000' }]}>
                  Scan Again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUseRecipe}
                style={[styles.actionButton, { backgroundColor: '#007aff' }]}>
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Use Recipe</Text>
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
      presentationStyle="fullScreen"
      onRequestClose={handleClose}>
      <View
        style={[
          styles.container,
          { backgroundColor: status === 'camera' ? '#000' : isDark ? '#000' : '#fff' },
        ]}>
        {/* Header */}
        <View style={[styles.header, status === 'camera' && styles.headerTransparent]}>
          <Text
            style={[
              styles.headerTitle,
              { color: status === 'camera' ? '#fff' : isDark ? '#fff' : '#000' },
            ]}>
            {status === 'preview' ? 'Review Recipe' : 'Scan Recipe'}
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons
              name="close"
              size={28}
              color={status === 'camera' ? '#fff' : isDark ? '#fff' : '#000'}
            />
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
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTransparent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 0.1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewfinder: {
    flex: 0.8,
    aspectRatio: 0.75,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  libraryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
  },
  statusText: {
    fontSize: 17,
    marginTop: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  primaryButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
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
    marginTop: 12,
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
  warningBanner: {
    backgroundColor: '#ff9500',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  recipeName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metadataChip: {
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
    paddingVertical: 6,
  },
  instructionItem: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  stepNumber: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: '600',
    width: 28,
  },
  instructionText2: {
    fontSize: 15,
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
  actionButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
