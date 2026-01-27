import { Modal, View, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ImageViewerProps = {
  visible: boolean;
  imageUri: any;
  onClose: () => void;
};

export default function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.9)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
          <Ionicons name="close" size={32} color="#ffffff" />
        </TouchableOpacity>
        <Image source={imageUri} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
    </Modal>
  );
}
