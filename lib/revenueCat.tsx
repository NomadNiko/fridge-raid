import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Constants from 'expo-constants';

const ENTITLEMENT_ID = 'Fridge Raid Premium';

interface RevenueCatContextType {
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  isReady: boolean;
  presentPaywall: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType>({
  isPremium: false,
  customerInfo: null,
  currentOffering: null,
  isReady: false,
  presentPaywall: async () => false,
  presentPaywallIfNeeded: async () => false,
  presentCustomerCenter: async () => {},
  restorePurchases: async () => false,
  refreshCustomerInfo: async () => {},
});

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [isReady, setIsReady] = useState(false);

  const isPremium =
    customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  useEffect(() => {
    const init = async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }

        const apiKey = Constants.expoConfig?.extra?.revenueCatApiKey;
        if (!apiKey || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
          console.warn('RevenueCat: No API key or unsupported platform');
          return;
        }

        Purchases.configure({ apiKey });

        // Fetch initial customer info
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);

        // Fetch offerings
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
          setCurrentOffering(offerings.current);
        }

        setIsReady(true);
      } catch (e) {
        console.error('RevenueCat init error:', e);
        setIsReady(true); // still mark ready so the app isn't blocked
      }
    };

    init();

    // Listen for customer info changes (purchases, renewals, etc.)
    Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
  }, []);

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    try {
      const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (e) {
      console.error('Paywall error:', e);
      return false;
    }
  }, []);

  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    try {
      const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (e) {
      console.error('Paywall error:', e);
      return false;
    }
  }, []);

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (e) {
      console.error('Customer Center error:', e);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    }
  }, []);

  const refreshCustomerInfo = useCallback(async (): Promise<void> => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
      console.error('Refresh customer info error:', e);
    }
  }, []);

  return (
    <RevenueCatContext.Provider
      value={{
        isPremium,
        customerInfo,
        currentOffering,
        isReady,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        restorePurchases,
        refreshCustomerInfo,
      }}>
      {children}
    </RevenueCatContext.Provider>
  );
}
