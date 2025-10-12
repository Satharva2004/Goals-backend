const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  partialUpdateGoal,
  deleteGoal,
  addContribution,
} = require('../controller/goalController');

const router = express.Router();

router.use(authMiddleware);

router
  .route('/')
  .post(createGoal)
  .get(getGoals);

router
  .route('/:id')
  .get(getGoalById)
  .put(updateGoal)
  .patch(partialUpdateGoal)
  .delete(deleteGoal);

router.post('/:id/contributions', addContribution);

module.exports = router;
