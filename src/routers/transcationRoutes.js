const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  partialUpdateTransaction,
  deleteTransaction,
} = require('../controller/transcationController');

const router = express.Router();

router.use(authMiddleware);

router
  .route('/')
  .post(createTransaction)
  .get(getTransactions);

router
  .route('/:id')
  .get(getTransactionById)
  .put(updateTransaction)
  .patch(partialUpdateTransaction)
  .delete(deleteTransaction);

module.exports = router;