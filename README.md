# Fridge Raid

A React Native mobile app for managing fridge ingredients and discovering recipes based on what you have available.

## Hackathon

Built for the RevenueCat Hackathon.

## Current State

### Implemented Features
- **Recipe Search & Discovery**: Search recipes by name, cuisine, tags, or ingredients
- **Recipe Details**: View full recipe information including ingredients, instructions, equipment, and nutrition
- **User Collections**: Save favorite recipes to personal collection
- **Dark Mode**: Full dark/light theme support

### In Progress
- Fridge management screen
- Collection management screen
- Settings screen

## Architecture

### Tech Stack
- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Storage**: AsyncStorage (temporary, will migrate to MMKV for production)
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

2. **AsyncStorage for Development**: Using AsyncStorage for Expo Go compatibility during development. Migration path to MMKV is straightforward (all storage functions are already async).

3. **Component Architecture**:
   - `RecipeCard` - Compact recipe preview with quick actions
   - `RecipeDetailModal` - Full recipe view with scrollable content
   - Screens use tab-based navigation

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

1. Implement fridge management UI
2. Implement collection management UI with user notes/customizations
3. Add recipe recommendation algorithm based on fridge contents
4. Integrate RevenueCat for premium features
5. Migrate to MMKV for production performance
6. Add image support for recipes and ingredients
7. Implement recipe filtering by dietary restrictions
