const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { addSatisfaction, getSatisfactionByTransactionId } = require('../controller/satisfactionController');

router.post('/', protect, addSatisfaction);
router.get('/:transactionId', protect, getSatisfactionByTransactionId);

module.exports = router;
