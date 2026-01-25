import { View, Text, useColorScheme } from 'react-native';

export default function Fridge() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#000000' : '#ffffff',
      }}>
      <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 20 }}>Fridge</Text>
    </View>
  );
}
