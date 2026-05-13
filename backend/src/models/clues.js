import { getAllQuery, runQuery } from '../db/database.js';

export function getCluesByCategory(categoryId, limit = null) {
  const clues = getAllQuery(`
    SELECT id, clue_text, response_text, category_id, difficulty_level
    FROM clues
    WHERE category_id = ?
  `, [categoryId]);

  // Shuffle array
  const shuffled = [...clues].sort(() => Math.random() - 0.5);
  return limit ? shuffled.slice(0, limit) : shuffled;
}

export function getRandomCluesByCategory(categoryId, count = 5) {
  const allClues = getAllQuery(`
    SELECT id, clue_text, response_text, category_id, difficulty_level
    FROM clues
    WHERE category_id = ?
  `, [categoryId]);

  // Shuffle and return first 'count' items
  const shuffled = allClues.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getCluesByDifficulty(difficulty, limit = null) {
  const clues = getAllQuery(`
    SELECT id, clue_text, response_text, category_id, difficulty_level
    FROM clues
    WHERE difficulty_level = ?
  `, [difficulty]);

  const shuffled = [...clues].sort(() => Math.random() - 0.5);
  return limit ? shuffled.slice(0, limit) : shuffled;
}

export function createClue(clueText, responseText, categoryId, difficultyLevel = 1, source = null) {
  const result = runQuery(`
    INSERT INTO clues (clue_text, response_text, category_id, difficulty_level, source)
    VALUES (?, ?, ?, ?, ?)
  `, [clueText, responseText, categoryId, difficultyLevel, source]);

  if (result.success) {
    return {
      clue_text: clueText,
      response_text: responseText,
      category_id: categoryId,
      difficulty_level: difficultyLevel,
      source
    };
  }
  return null;
}

export function createMultipleClues(clues) {
  for (const clue of clues) {
    runQuery(`
      INSERT INTO clues (clue_text, response_text, category_id, difficulty_level, source)
      VALUES (?, ?, ?, ?, ?)
    `, [
      clue.clue_text,
      clue.response_text,
      clue.category_id,
      clue.difficulty_level || 1,
      clue.source || null
    ]);
  }
  return { success: true };
}
