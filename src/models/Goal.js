const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    savedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    targetDate: {
      type: Date,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    tags: [{ type: String, trim: true }],
    contributions: {
      type: [
        {
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
          note: {
            type: String,
            trim: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

goalSchema.virtual('remainingAmount').get(function () {
  const remaining = (this.amount || 0) - (this.savedAmount || 0);
  return remaining > 0 ? remaining : 0;
});

goalSchema.set('toJSON', { virtuals: true });
goalSchema.set('toObject', { virtuals: true });

goalSchema.pre('save', function (next) {
  const totalSaved = this.contributions.reduce((sum, entry) => sum + entry.amount, 0);
  this.savedAmount = totalSaved;

  if (this.amount > 0) {
    const percentage = (totalSaved / this.amount) * 100;
    this.progress = Math.min(100, Math.max(0, Number(percentage.toFixed(2))));
  } else {
    this.progress = 100;
  }

  if (!this.isModified('isCompleted')) {
    this.isCompleted = this.amount > 0 ? totalSaved >= this.amount : true;
  } else if (!this.isCompleted && totalSaved >= this.amount) {
    this.isCompleted = true;
  }

  next();
});

module.exports = mongoose.model('Goal', goalSchema);
