import { getAllCategories } from '../models/categories.js';
import { getRandomCluesByCategory } from '../models/clues.js';

export function generateCuratedBoard(selectedCategoryIds = null) {
  const allCategories = getAllCategories();

  // If specific categories requested, use those; otherwise pick 6 random
  let selectedCategories = selectedCategoryIds && selectedCategoryIds.length > 0
    ? allCategories.filter(c => selectedCategoryIds.includes(c.id))
    : allCategories.sort(() => Math.random() - 0.5).slice(0, 6);

  // Ensure we have 6 categories
  if (selectedCategories.length < 6) {
    selectedCategories = selectedCategories.concat(
      allCategories.filter(c => !selectedCategories.find(sc => sc.id === c.id))
    ).slice(0, 6);
  }

  // For each category, get 5 random clues
  const board = selectedCategories.map(category => {
    const clues = getRandomCluesByCategory(category.id, 5);

    // If not enough clues, pad with available ones
    if (clues.length < 5) {
      // This can happen if category has fewer than 5 clues
      console.warn(`Category "${category.name}" has fewer than 5 clues (${clues.length})`);
    }

    return {
      category_id: category.id,
      category_name: category.name,
      clues: clues.map((clue, index) => ({
        id: clue.id,
        value: (index + 1) * 200, // $200, $400, $600, $800, $1000
        clue_text: clue.clue_text,
        response_text: clue.response_text,
        difficulty_level: clue.difficulty_level
      }))
    };
  });

  return board;
}

export function generateBoardByCategories(categoryIds) {
  // User selected specific categories
  return generateCuratedBoard(categoryIds);
}
