import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ViewToken,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  icon?: React.ReactNode;
  image?: any;
  title: string;
  description: string;
  bgColor?: string;
  borderColor?: string;
};

const slides: Slide[] = [
  {
    id: 'welcome',
    image: require('../assets/icon.png'),
    title: 'Welcome to Fridge Raid',
    description: 'Find recipes with what you have. \nCooking doesnt have to be so hard!',
  },
  {
    id: 'fridge',
    icon: <MaterialCommunityIcons name="fridge-variant-outline" size={80} color="#34c759" />,
    title: 'Stock Your Fridge',
    description: "Add ingredients you have at home.\nWe'll match them to hundreds of recipes.",
    bgColor: '#4a4a4c',
    borderColor: '#3a3a3c',
  },
  {
    id: 'discover',
    icon: <Ionicons name="book-outline" size={80} color="#0051a8" />,
    title: 'Discover & Cook',
    description: "Save recipes to your Cookbook.\nGet a Shopping List of what's missing.",
    bgColor: '#585858',
    borderColor: '#484848',
  },
  {
    id: 'start',
    icon: <Ionicons name="arrow-forward-circle-outline" size={80} color="#ff9500" />,
    title: 'Get Started',
    description: "Head to the Fridge tab and add ingredients. \n We'll handle the rest!",
    bgColor: '#666666',
    borderColor: '#565656',
  },
];

type Props = {
  visible: boolean;
  onComplete: () => void;
};

export default function OnboardingModal({ visible, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View
      style={{
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
      }}>
      {item.image ? (
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            backgroundColor: '#3c3c3e',
            borderWidth: 3,
            borderColor: '#2c2c2e',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}>
          <Image
            source={item.image}
            style={{ width: 100, height: 100, borderRadius: 22 }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            backgroundColor: item.bgColor || '#3c3c3e',
            borderWidth: 3,
            borderColor: item.borderColor || '#2c2c2e',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}>
          {item.icon}
        </View>
      )}
      <Text
        style={{
          color: '#ffffff',
          fontSize: 26,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 12,
        }}>
        {item.title}
      </Text>
      <Text
        style={{
          color: '#8e8e93',
          fontSize: 16,
          textAlign: 'center',
          lineHeight: 24,
        }}>
        {item.description}
      </Text>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {!isLastSlide && (
          <TouchableOpacity
            onPress={onComplete}
            style={{
              position: 'absolute',
              top: 60,
              right: 20,
              zIndex: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}>
            <Text style={{ color: '#8e8e93', fontSize: 16 }}>Skip</Text>
          </TouchableOpacity>
        )}

        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        <View style={{ paddingBottom: 60, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', marginBottom: 24 }}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentIndex ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === currentIndex ? '#007aff' : '#3a3a3c',
                  marginHorizontal: 4,
                }}
              />
            ))}
          </View>

          {isLastSlide ? (
            <TouchableOpacity
              onPress={onComplete}
              style={{
                backgroundColor: '#007aff',
                paddingHorizontal: 48,
                paddingVertical: 14,
                borderRadius: 12,
              }}>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
                {"Let's Go"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={goToNext}
              style={{
                backgroundColor: '#1c1c1e',
                paddingHorizontal: 48,
                paddingVertical: 14,
                borderRadius: 12,
              }}>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
