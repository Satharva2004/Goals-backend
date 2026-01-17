const Goal = require('../models/Goal');
const Transaction = require('../models/Transaction');
const Satisfaction = require('../models/Satisfaction');

exports.getAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month, year } = req.query;

        // Default to current month/year if not provided
        const now = new Date();
        const currentMonth = month ? parseInt(month) - 1 : now.getMonth(); // 0-indexed
        const currentYear = year ? parseInt(year) : now.getFullYear();

        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

        // 1. Fetch all Goals (Budgets)
        const goals = await Goal.find({ user: userId });

        // 2. Fetch all Transactions for the period
        const transactions = await Transaction.find({
            user: userId,
            transaction_date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // 2a. Fetch Satisfactions for these transactions
        const transactionIds = transactions.map(t => t._id);
        const satisfactions = await Satisfaction.find({
            user: userId,
            transaction: { $in: transactionIds }
        });

        // Create lookup for satisfaction
        const satisfactionMap = new Map();
        let totalRegretAmount = 0;
        let totalValueAmount = 0;

        satisfactions.forEach(s => {
            satisfactionMap.set(s.transaction.toString(), s.rating);
        });

        // 3. Aggregate Transactions by Category AND Regret
        const spendingByCategory = transactions.reduce((acc, txn) => {
            const cat = txn.category || 'Uncategorized';
            if (!acc[cat]) acc[cat] = 0;
            acc[cat] += txn.amount;

            // Regret Analysis
            const rating = satisfactionMap.get(txn._id.toString());
            // Assuming Rating '1' or '2' is Regret, '4' or '5' is Value
            if (rating === '1' || rating === '2' || rating === 'Regret') {
                totalRegretAmount += txn.amount;
            } else if (rating === '4' || rating === '5' || rating === 'Happy') {
                totalValueAmount += txn.amount;
            }

            return acc;
        }, {});

        // 4. Combine Goals with Spending
        const daysInMonth = endOfMonth.getDate();
        const currentDay = now.getDate();
        const daysRemaining = Math.max(1, daysInMonth - currentDay);

        const analytics = goals.map(goal => {
            // Determine if this is a SAVINGS goal or an EXPENSE goal
            // Expense Goal: defined by category match or lack of savedAmount
            // Savings Goal: has explicit `savedAmount` or Contributions

            const isSavings = (goal.savedAmount > 0) || (goal.contributions && goal.contributions.length > 0);

            let current = 0;
            let target = goal.amount;
            let status = 'Good';
            let dailyLimit = 0;
            let projection = 0;
            let type = 'expense';

            if (isSavings) {
                type = 'savings';
                current = goal.savedAmount || 0;

                // For savings: Calculate Daily Requirement to hit target by deadline
                // If no deadline, assume end of month (short term) or just track progress

                let timeRemainingDays = daysRemaining;
                if (goal.targetDate) {
                    const deadline = new Date(goal.targetDate);
                    const diffTime = Math.max(0, deadline - now);
                    timeRemainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                // How much more needed?
                const amountNeeded = Math.max(0, target - current);

                // Daily Save Requirement
                dailyLimit = timeRemainingDays > 0 ? parseFloat((amountNeeded / timeRemainingDays).toFixed(0)) : amountNeeded;

                // Status Check
                const idealProgress = target * ((daysInMonth - timeRemainingDays) / daysInMonth); // Rough linear projection

                if (current >= target) status = 'Completed';
                else if (current < idealProgress * 0.8) status = 'Lagging'; // 20% behind schedule
                else status = 'On Track';

                projection = parseFloat((current + (dailyLimit * timeRemainingDays)).toFixed(0));

            } else {
                type = 'expense';
                current = spendingByCategory[goal.category] || 0;

                // Calculations for EXPENSE
                const percentage = (current / target) * 100;
                const remaining = Math.max(0, target - current);

                // Daily Safe Spend (to end of month)
                dailyLimit = parseFloat((remaining / daysRemaining).toFixed(0));

                // Projection (Linear Extrapolation)
                // If day 15 and spent 500, projection = (500/15) * 30 = 1000
                const dailyRate = current / Math.max(1, currentDay);
                projection = parseFloat((dailyRate * daysInMonth).toFixed(0));

                if (current >= target) status = 'Exceeded';
                else if (projection > target) status = 'At Risk'; // Projected to exceed
                else if (percentage >= 90) status = 'Critical';
                else status = 'Good';
            }

            const percentage = Math.min(100, (current / target) * 100);

            return {
                goalId: goal._id,
                name: goal.name,
                category: goal.category,
                type: type, // 'savings' or 'expense'
                budget: target,
                current: current, // Generic name (could be 'spent' or 'saved')
                remaining: Math.max(0, target - current),
                percentage: parseFloat(percentage.toFixed(1)),
                status: status,
                dailyLimit: dailyLimit, // Now relevant for both
                projectedTotal: projection
            };
        });

        // 5. Also find spending that DOESN'T match any goal (Unbudgeted spending)
        const goalCategories = new Set(goals.map(g => g.category));
        const unbudgeted = [];

        Object.keys(spendingByCategory).forEach(cat => {
            // Only show unbudgeted if it's a significant amount? No, show all.
            if (!goalCategories.has(cat)) {
                unbudgeted.push({
                    category: cat,
                    spent: spendingByCategory[cat],
                    status: 'Unbudgeted'
                });
            }
        });

        res.json({
            period: { month: currentMonth + 1, year: currentYear },
            goals: analytics,
            unbudgeted: unbudgeted,
            satisfaction: {
                regretAmount: totalRegretAmount,
                valueAmount: totalValueAmount,
                regretPercentage: totalRegretAmount > 0 ? ((totalRegretAmount / (totalRegretAmount + totalValueAmount)) * 100).toFixed(1) : 0
            },
            totalSpent: transactions.reduce((sum, t) => sum + t.amount, 0)
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
