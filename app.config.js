export default {
  expo: {
    name: 'Fridge Raid',
    slug: 'fridge-raid',
    version: '1.0.0',
    web: {
      favicon: './assets/favicon.png',
    },
    experiments: {
      tsconfigPaths: true,
    },
    plugins: [
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Fridge Raid to access your photos to scan recipes.',
          cameraPermission: 'Allow Fridge Raid to use the camera to scan recipes.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Fridge Raid to use the camera to scan recipes.',
        },
      ],
    ],
    newArchEnabled: true,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'fridge-raid',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      newArchEnabled: true,
      bundleIdentifier: 'com.devnomad.fridgeraid',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Allow Fridge Raid to use the camera to scan recipes from cookbooks and recipe cards.',
        NSPhotoLibraryUsageDescription:
          'Allow Fridge Raid to access photos to scan saved recipe images.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.devnomad.fridgeraid',
      newArchEnabled: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '797d50f6-2a9a-4efe-994d-c2c03b5f9c78',
      },
      // AWS credentials for Textract OCR
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
    },
  },
};
