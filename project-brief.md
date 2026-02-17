# Fridge Raid

[Website](https://nomadsoft.us/fridge-raid) | [Proposal](https://nomadsoft.us/fridge-raid#proposal) | [Technical Documentation](https://nomadsoft.us/fridge-raid#technical) | [Developer](https://nomadsoft.us/fridge-raid#developer)

---

## Inspiration

People often have ingredients sitting in their fridge but don't know what to make with them. They also usually have cookbooks gathering dust on the shelf, but it takes a long time to cross reference this with what ingredients you already have.

We wanted to build an app that **flips the traditional recipe search on its head**: instead of finding a recipe and then buying ingredients, you start with what you already have and discover what you can cook.

## What it does

**Fridge Raid** lets users add ingredients they have at home and instantly matches them to **500 recipes** (and counting). It suggests recipes ranked by how many matching ingredients you already have, lets you save favorites to a personal **Cookbook**, and generates a **Shopping List** for any missing ingredients. Users can also import recipes by **scanning a photo** (OCR) or **pasting a URL**, and switch between original, metric, and imperial unit systems.

## How we built it

We built it with **React Native** and **Expo**, using a tab-based navigation structure. The recipe database was sourced from various free APIs and refined extensively by hand — normalizing ingredients, adding alternative names, assigning categories, difficulty levels, and meal types. For recipe scanning and URL imports, we integrated **Amazon Bedrock's Nova Pro** model to parse and format recipes using LLM-powered OCR. We used **RevenueCat** for subscription management and **AsyncStorage** for local data persistence.

## Challenges we ran into

- **Ingredient matching was tricky** — the same ingredient can be called many different things (e.g., _"coriander"_ vs _"cilantro"_), so we had to build a matching system with alternative names and case-insensitive lookups.
- **Parsing fractional ingredient quantities** (like _"1 1/2 cups"_) required careful handling.
- **Recipes with "or" ingredients** (e.g., _"butter or margarine"_) needed special logic to let users choose.
- **Normalizing 500 recipes** from raw API data into a consistent format with proper units, preparation notes, and categories was a massive data-cleaning effort across many iterations.

## Accomplishments that we're proud of

- A database of **500 hand-refined recipes** spanning **20 cuisines** and **14 meal types**.
- **LLM-powered recipe import** — users can snap a photo of a recipe card or paste a URL and it gets automatically parsed into the app's format.
- A **unit conversion system** that can switch entire recipes between original, metric, and imperial measurements.
- **Smart recipe suggestions** that rank results by ingredient match percentage so users always see the most cookable recipes first.

## What we learned

- **Data quality matters more than data quantity** — we spent more time refining ingredient names, alternative names, and recipe metadata than writing app code.
- **LLMs are powerful for unstructured data parsing** (OCR, URLs) but need carefully crafted prompts to return consistent, structured output.
- **Building a good ingredient matching system** requires thinking about how real people describe food, not just exact string matches.

## What's next for Fridge Raid

- Expanding the recipe database with more cuisines and **dietary options** (vegetarian, vegan, gluten-free filters).
- Adding **meal planning** features so users can plan their week and generate a consolidated shopping list.
- **Community recipe sharing** so users can publish their own imported recipes.
- **Smarter suggestions** using past cooking history and user preferences.
- **User uploaded images** stored for recipes.
- **Recipe step images** showing how to do the cooking, matched to common steps even in custom recipes.
- **Selectable color scheme**
- **Rotating sponsored chefs**, suggesting their own recipes the user would like.
