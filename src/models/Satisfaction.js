const mongoose = require('mongoose');

const satisfactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            required: true,
            index: true,
        },
        rating: {
            type: String,
            required: true,
            trim: true,
        },
        note: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Satisfaction', satisfactionSchema);
