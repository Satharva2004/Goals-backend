const Satisfaction = require('../models/Satisfaction');
const Transaction = require('../models/Transaction');

exports.addSatisfaction = async (req, res) => {
    try {
        const { transactionId, rating, note } = req.body;

        if (!transactionId || !rating) {
            return res.status(400).json({ message: 'Transaction ID and rating are required' });
        }



        const transaction = await Transaction.findOne({ _id: transactionId, user: req.user._id });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Check if satisfaction already exists for this transaction
        let satisfaction = await Satisfaction.findOne({ transaction: transactionId, user: req.user._id });

        if (satisfaction) {
            // Update existing satisfaction
            satisfaction.rating = rating;
            satisfaction.note = note ? note.trim() : satisfaction.note;
            await satisfaction.save();
            return res.json({ message: 'Satisfaction updated successfully', satisfaction });
        }

        satisfaction = await Satisfaction.create({
            user: req.user._id,
            transaction: transactionId,
            rating,
            note: note ? note.trim() : undefined,
        });

        res.status(201).json({ message: 'Satisfaction recorded successfully', satisfaction });
    } catch (error) {
        console.error('Add satisfaction error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getSatisfactionByTransactionId = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const satisfaction = await Satisfaction.findOne({ transaction: transactionId, user: req.user._id });

        if (!satisfaction) {
            return res.status(404).json({ message: 'Satisfaction not found for this transaction' });
        }

        res.json({ satisfaction });
    } catch (error) {
        console.error('Get satisfaction error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
