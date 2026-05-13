import express from 'express';
import { generateCuratedBoard, generateBoardByCategories } from '../utils/boardGenerator.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    // Optional query parameter: ?categories=1,2,3 (comma-separated category IDs)
    const categoriesParam = req.query.categories;
    let categoryIds = null;

    if (categoriesParam) {
      categoryIds = categoriesParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    }

    const board = categoryIds && categoryIds.length > 0
      ? generateBoardByCategories(categoryIds)
      : generateCuratedBoard();

    res.json({
      success: true,
      data: board
    });
  } catch (error) {
    console.error('Error generating board:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate board'
    });
  }
});

export default router;
