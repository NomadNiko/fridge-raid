import AsyncStorage from '@react-native-async-storage/async-storage';
import { unitConversionsData } from './data/unitConversions';

export type UnitSystem = 'original' | 'metric' | 'imperial';

type ConvertedUnit = { amount: number; unit: string };

const STORAGE_KEY = 'unitSystem';

export const getUnitSystem = async (): Promise<UnitSystem> => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    return (val as UnitSystem) || 'original';
  } catch {
    return 'original';
  }
};

export const setUnitSystem = async (system: UnitSystem): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, system);
};

const getUnitCategory = (unit: string): 'weight' | 'volume' | null => {
  const lower = unit.toLowerCase();
  if (lower in unitConversionsData.weight) return 'weight';
  if (lower in unitConversionsData.volume) return 'volume';
  return null;
};

const toBase = (amount: number, unit: string, category: 'weight' | 'volume'): number => {
  const factors = unitConversionsData[category] as Record<string, number>;
  const factor = factors[unit.toLowerCase()];
  return amount * (factor || 1);
};

export const convertUnit = (
  amount: number,
  unit: string,
  system: UnitSystem
): ConvertedUnit => {
  if (system === 'original' || !amount || !unit) {
    return { amount, unit };
  }

  const category = getUnitCategory(unit);
  if (!category) {
    return { amount, unit };
  }

  const baseAmount = toBase(amount, unit, category);

  if (system === 'metric') {
    if (category === 'weight') {
      if (baseAmount >= 1000) return { amount: baseAmount / 1000, unit: 'kg' };
      return { amount: baseAmount, unit: 'g' };
    } else {
      if (baseAmount >= 1000) return { amount: baseAmount / 1000, unit: 'l' };
      return { amount: baseAmount, unit: 'ml' };
    }
  }

  // Imperial
  if (category === 'weight') {
    const oz = baseAmount / 28.35;
    if (oz >= 16) return { amount: oz / 16, unit: 'lb' };
    return { amount: oz, unit: 'oz' };
  } else {
    const flOz = baseAmount / 30;
    if (flOz >= 128) return { amount: flOz / 128, unit: 'gallon' };
    if (flOz >= 8) return { amount: flOz / 8, unit: 'cup' };
    if (flOz >= 1) return { amount: flOz, unit: 'fl-oz' };
    return { amount: baseAmount / 5, unit: 'tsp' };
  }
};
