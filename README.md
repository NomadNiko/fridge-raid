# Fridge Raid

A React Native mobile app that helps you discover recipes based on the ingredients you already have at home.

## Hackathon

Built for the [RevenueCat](https://www.revenuecat.com/) Ship-a-ton Hackathon.

---

## Features

- **Fridge Management** — Search, add, and remove ingredients from your virtual fridge
- **Smart Recipe Suggestions** — Recipes ranked by how many matching ingredients you already have
- **Recipe Search & Filtering** — Search by name, cuisine, tags, or ingredients; filter by cuisine with visual chips
- **Cookbook** — Save favorite recipes to a personal collection
- **Shopping List** — Auto-generated list of missing ingredients for saved recipes, with quantities
- **Recipe Import (Premium)** — Scan a photo of a recipe (OCR) or paste a URL to import it automatically using LLM-powered parsing
- **Unit Conversion** — Switch between original, metric, and imperial measurement systems across all recipes
- **Ingredient Alternatives** — Choose between "or" ingredients (e.g., _butter or margarine_)
- **Recipe Export** — Share recipes externally
- **Onboarding** — Guided walkthrough for first-time users
- **Dark Mode UI** — Full dark theme

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.81 + Expo SDK 54 |
| **Language** | TypeScript 5.9 |
| **Navigation** | Expo Router (file-based routing with tabs) |
| **Local Storage** | AsyncStorage |
| **Monetization** | RevenueCat (`react-native-purchases` + `react-native-purchases-ui`) |
| **AI / LLM** | Amazon Bedrock — Nova Pro v1 (recipe OCR & URL parsing) |
| **OCR** | AWS Textract (image text extraction) |
| **Camera** | expo-camera + expo-image-picker |
| **Animations** | react-native-reanimated |

---

## Architecture

### Project Structure

```
fridge-raid-scraper/
├── app/                          # Expo Router screens (tab-based)
│   ├── _layout.tsx               # Root layout, RevenueCat provider, onboarding
│   ├── index.tsx                 # Home — recipe search & discovery
│   ├── fridge.tsx                # Fridge ingredient management
│   ├── collection.tsx            # Suggested recipes based on fridge contents
│   ├── cookbook.tsx               # Saved recipes, OCR/URL import
│   └── settings.tsx              # Preferences, unit system, subscriptions
├── components/                   # Reusable UI components
│   ├── RecipeCard.tsx            # Compact recipe preview card
│   ├── RecipeDetailModal.tsx     # Full recipe view with ingredient status
│   ├── RecipeScannerModal.tsx    # Camera/gallery OCR import modal
│   ├── UrlImportModal.tsx        # URL-based recipe import modal
│   ├── IngredientCard.tsx        # Ingredient display component
│   ├── IngredientAlternativePicker.tsx  # "or" ingredient chooser
│   ├── OnboardingModal.tsx       # First-launch walkthrough slider
│   └── ImageViewer.tsx           # Image display component
├── lib/
│   ├── storage.ts                # AsyncStorage CRUD layer & data types
│   ├── ingredientMatcher.ts      # Case-insensitive ingredient matching with alternative names
│   ├── unitConversion.ts         # Metric/imperial/original unit conversion engine
│   ├── revenueCat.tsx            # RevenueCat context provider & paywall hooks
│   ├── images.ts                 # Recipe image mapping
│   ├── ingredientImages.ts       # Ingredient image mapping
│   ├── ocr/
│   │   ├── recipeFormatter.ts    # LLM prompts for recipe parsing (OCR + URL)
│   │   ├── recipeParser.ts       # Structured recipe data extraction
│   │   ├── ocrService.ts         # AWS Textract integration
│   │   ├── urlFetcher.ts         # Web page fetching for URL import
│   │   └── ingredientPatterns.ts # Ingredient parsing patterns & regex
│   └── data/                     # Static application data
│       ├── recipes.ts            # 500 hand-refined recipes
│       ├── ingredients.ts        # Ingredient catalog with alternative names
│       ├── cookware.ts           # Cookware types
│       └── unitConversions.ts    # Measurement conversion tables
├── types/
│   └── recipe.ts                 # Core type definitions (Recipe, Ingredient, etc.)
└── assets/                       # Icons, images, splash screens
```

### Data Architecture

**Application-Level Data** (read-only, bundled):
- **Recipes** — 500 hand-refined recipes spanning 20 cuisines, 5 categories, and 14 meal types
- **Ingredients** — Catalog with `name`, `category`, and `alternativeNames[]` for fuzzy matching
- **Cookware** — Available cookware/equipment types
- **Unit Conversions** — Measurement conversion tables (metric, imperial, original)

**User-Level Data** (persisted in AsyncStorage):
- **User Fridge** — Ingredient IDs + metadata (notes, quantities, dates)
- **User Cookbook** — Saved recipe IDs + metadata (notes, ratings, cook history, multiplier)
- **Custom Recipes** — User-imported recipes via OCR or URL
- **Custom Ingredients** — Ingredients added during recipe import
- **Settings** — Unit system preference, onboarding state

### Key Design Decisions

1. **Hybrid Reference Model** — User data stores IDs referencing master data, plus user-specific metadata. Single source of truth with personalization.
2. **Automatic Data Refresh** — Master data reloads on every app start to ensure latest content, while preserving user data.
3. **Reactive State Management** — Direct state updates without full page reloads preserve scroll position and provide instant feedback.
4. **Smart Suggestions** — Recipes sorted by missing ingredient count, excluding already-saved recipes, updating dynamically as fridge changes.
5. **LLM-Powered Import Pipeline** — OCR images go through AWS Textract for text extraction, then Amazon Bedrock Nova Pro for structured recipe parsing. URL imports fetch page content and pass it through the same LLM formatting step.

---

## RevenueCat Implementation

RevenueCat powers the premium subscription tier in Fridge Raid, gating the AI-powered recipe import features.

### Integration Overview

- **SDK**: `react-native-purchases` v9 + `react-native-purchases-ui` v9
- **Provider**: `RevenueCatProvider` wraps the entire app in `_layout.tsx`, initializing the SDK on mount and listening for customer info updates
- **Context Hook**: `useRevenueCat()` exposes `isPremium`, `presentPaywall()`, `presentPaywallIfNeeded()`, `presentCustomerCenter()`, and `restorePurchases()` to any screen
- **Entitlement Check**: Premium status is determined by checking `customerInfo.entitlements.active[ENTITLEMENT_ID]`

### Gated Features

| Feature | Free | Premium |
|---|---|---|
| Browse & search 500 recipes | Yes | Yes |
| Fridge management & suggestions | Yes | Yes |
| Cookbook & shopping list | Yes | Yes |
| Unit conversion | Yes | Yes |
| **Scan recipe from photo (OCR)** | No | Yes |
| **Import recipe from URL** | No | Yes |

### Paywall Flow

1. User taps "Scan Recipe" or "Import from URL" in the Cookbook tab
2. `presentPaywallIfNeeded()` checks entitlement — if already premium, proceeds directly
3. If not premium, RevenueCat's native paywall UI is presented automatically
4. On successful purchase, `customerInfoUpdateListener` fires and `isPremium` updates reactively
5. All gated UI updates instantly without requiring a restart

### Additional RevenueCat Features

- **Restore Purchases** — Available in Settings for users reinstalling or switching devices
- **Customer Center** — `presentCustomerCenter()` accessible from Settings for subscription management
- **Debug Logging** — `LOG_LEVEL.DEBUG` enabled in development builds

---

## Running the App

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on device
npm run android
npm run ios
```

---

## What's Next

- Dietary restriction filtering (vegetarian, vegan, gluten-free)
- Meal planning with consolidated shopping lists
- Community recipe sharing
- Smarter suggestions based on cooking history
- User-uploaded recipe images
- Step-by-step cooking images
- Selectable color schemes
- Rotating sponsored chef recommendations
