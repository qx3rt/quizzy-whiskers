import express from 'express';
import { getAllCategories } from '../models/categories.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const categories = getAllCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

export default router;
