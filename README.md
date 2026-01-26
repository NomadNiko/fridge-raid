# Fridge Raid

A React Native mobile app for managing fridge ingredients and discovering recipes based on what you have available.

## Hackathon

Built for the RevenueCat Hackathon.

## Current State

### Implemented Features
- **Recipe Search & Discovery**: Search recipes by name, cuisine, tags, or ingredients with clear button
- **Recipe Filtering**: Filter recipes by cuisine type with visual chips
- **Recipe Pagination**: Browse recipes in pages of 10 with navigation controls
- **Recipe Details**: View full recipe information including ingredients, instructions, equipment, and nutrition
- **Ingredient Status**: Visual indicators showing which ingredients you have/need (red X for missing)
- **User Collections**: Save favorite recipes to personal collection with instant updates
- **Suggested Recipes**: Smart recommendations based on fridge contents, sorted by missing ingredients
- **Fridge Management**: Search and add ingredients to your fridge, remove items
- **Shopping List**: Automatically generated list of missing ingredients needed for collection recipes
- **Collapsible Sections**: Expandable/collapsible sections in Fridge and Collection screens
- **Settings**: View user data stats, reset all data with confirmation
- **Dark Mode**: Full dark/light theme support with automatic system detection
- **Reactive Updates**: All data updates instantly without page reloads or scroll position loss

## Architecture

### Tech Stack
- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing with tabs)
- **Styling**: Inline styles with dynamic theming
- **Storage**: AsyncStorage with automatic data refresh on app start
- **Language**: TypeScript

### Data Structure

**Application-Level Data** (read-only):
- `recipes` - Master recipe database
- `ingredients` - Master ingredient catalog
- `cookware` - Available cookware types
- `unitConversions` - Measurement conversion tables

**User-Level Data** (modifiable):
- `userFridge` - User's personal fridge inventory with notes
  - Stores ingredient IDs + user metadata (notes, custom quantities, dates)
- `userCollection` - User's saved recipes with customizations
  - Stores recipe IDs + user metadata (notes, substitutions, ratings, cook history)

### Key Design Decisions

1. **Hybrid Reference Model**: User data stores IDs referencing master data, plus user-specific metadata. This maintains a single source of truth while allowing personalization.

2. **Automatic Data Refresh**: Master data (recipes, ingredients, cookware) reloads on every app start to ensure latest content, while preserving user data (fridge, collection).

3. **Reactive State Management**: Direct state updates without full page reloads preserve scroll position and provide instant feedback.

4. **Smart Recipe Suggestions**: Recipes sorted by missing ingredient count, excluding already-collected recipes, updating dynamically as fridge changes.

5. **Component Architecture**:
   - `RecipeCard` - Compact recipe preview with quick actions
   - `RecipeDetailModal` - Full recipe view with ingredient availability status
   - Collapsible sections for better content organization
   - Tab-based navigation with automatic theme detection

## Project Structure

```
fridge-raid/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with tabs
│   ├── index.tsx          # Home/search screen
│   ├── fridge.tsx         # Fridge management (placeholder)
│   ├── collection.tsx     # Recipe collection (placeholder)
│   └── settings.tsx       # App settings (placeholder)
├── components/            # Reusable components
│   ├── RecipeCard.tsx
│   └── RecipeDetailModal.tsx
├── lib/
│   ├── storage.ts         # Storage layer & CRUD operations
│   └── data/              # Seed data
│       ├── recipes.ts
│       ├── ingredients.ts
│       ├── cookware.ts
│       └── unitConversions.ts
└── assets/                # Images and static files
```

## Running the App

```bash
# Install dependencies
npm install

# Start Expo Go (development)
npm start

# Build for device (requires EAS or local build)
npm run android
npm run ios
```

## Next Steps

1. Add recipe images and ingredient photos
2. Implement dietary restriction filtering
3. Add user notes and customizations to recipes
4. Integrate RevenueCat for premium features
5. Add recipe rating and review system
6. Implement recipe sharing functionality
7. Add cooking timer and step-by-step mode
