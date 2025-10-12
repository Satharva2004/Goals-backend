const Goal = require('../models/Goal');

const allowedFields = [
  'name',
  'amount',
  'description',
  'category',
  'targetDate',
  'isCompleted',
  'notes',
];

const sanitizePayload = (payload) =>
  allowedFields.reduce((acc, field) => {
    if (typeof payload[field] !== 'undefined') {
      acc[field] = payload[field];
    }
    return acc;
  }, {});

const normalizeAmount = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
};

const buildGoalResponse = (goal) => ({
  id: goal._id,
  name: goal.name,
  amount: goal.amount,
  savedAmount: goal.savedAmount,
  remainingAmount: goal.remainingAmount,
  description: goal.description,
  category: goal.category,
  targetDate: goal.targetDate,
  isCompleted: goal.isCompleted,
  progress: goal.progress,
  notes: goal.notes,
  tags: goal.tags,
  contributions: goal.contributions,
  createdAt: goal.createdAt,
  updatedAt: goal.updatedAt,
});

const applyGoalUpdates = async (goal, payload) => {
  Object.entries(payload).forEach(([key, value]) => {
    if (typeof value === 'string') {
      goal[key] = value.trim();
    } else if (key === 'amount') {
      goal[key] = normalizeAmount(value);
    } else {
      goal[key] = value;
    }
  });

  await goal.save();
  return goal;
};

exports.createGoal = async (req, res) => {
  try {
    const goalPayload = sanitizePayload(req.body);

    if (!goalPayload.name || typeof goalPayload.amount === 'undefined') {
      return res.status(400).json({ message: 'Name and amount are required' });
    }

    if (goalPayload.name) {
      goalPayload.name = goalPayload.name.trim();
    }

    const normalizedAmount = normalizeAmount(goalPayload.amount);
    if (normalizedAmount === null || normalizedAmount < 0) {
      return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }
    goalPayload.amount = normalizedAmount;

    const goal = await Goal.create({
      user: req.user._id,
      ...goalPayload,
    });

    res.status(201).json({ message: 'Goal created successfully', goal: buildGoalResponse(goal) });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ goals: goals.map(buildGoalResponse) });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ goal: buildGoalResponse(goal) });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goalPayload = sanitizePayload(req.body);

    if (!goalPayload.name || typeof goalPayload.amount === 'undefined') {
      return res.status(400).json({ message: 'Name and amount are required for update' });
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goalPayload.name) {
      goalPayload.name = goalPayload.name.trim();
    }

    const normalizedAmount = normalizeAmount(goalPayload.amount);
    if (normalizedAmount === null || normalizedAmount < 0) {
      return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }
    if (normalizedAmount < goal.savedAmount) {
      return res.status(400).json({
        message: 'Amount cannot be less than the total saved amount',
      });
    }
    goalPayload.amount = normalizedAmount;

    const updatedGoal = await applyGoalUpdates(goal, goalPayload);

    res.json({ message: 'Goal updated successfully', goal: buildGoalResponse(updatedGoal) });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.partialUpdateGoal = async (req, res) => {
  try {
    const goalPayload = sanitizePayload(req.body);

    if (!Object.keys(goalPayload).length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (typeof goalPayload.amount !== 'undefined') {
      const normalizedAmount = normalizeAmount(goalPayload.amount);
      if (normalizedAmount === null || normalizedAmount < 0) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
      }
      if (normalizedAmount < goal.savedAmount) {
        return res.status(400).json({
          message: 'Amount cannot be less than the total saved amount',
        });
      }
      goalPayload.amount = normalizedAmount;
    }

    const updatedGoal = await applyGoalUpdates(goal, goalPayload);

    res.json({ message: 'Goal updated successfully', goal: buildGoalResponse(updatedGoal) });
  } catch (error) {
    console.error('Partial update goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addContribution = async (req, res) => {
  try {
    const { amount, note } = req.body;

    if (typeof amount === 'undefined' || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Contribution amount must be greater than zero' });
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const numericAmount = Number(amount);
    if (goal.amount && numericAmount + goal.savedAmount > goal.amount) {
      goal.isCompleted = true;
    }

    goal.contributions.push({ amount: numericAmount, note: note ? note.trim() : undefined });
    await goal.save();

    res.status(201).json({
      message: 'Contribution recorded successfully',
      goal: buildGoalResponse(goal),
    });
  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
