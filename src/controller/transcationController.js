const Transaction = require('../models/Transaction');

const allowedFields = [
  'name',
  'amount',
  'category',
  'transaction_date',
  'note',
  'payment_method',
  'reference_id',
  'source',
  'sms_body',
  'is_auto',
];

const sanitizePayload = (payload = {}) =>
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

const normalizeTransactionDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const normalizeTransactionPayload = (payload, { requireNameAndAmount = false } = {}) => {
  if (requireNameAndAmount) {
    if (!payload.name || typeof payload.amount === 'undefined') {
      return 'Name and amount are required';
    }
  }

  if (payload.name) {
    payload.name = payload.name.trim();
    if (!payload.name.length) {
      return 'Name cannot be empty';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) {
    const normalizedAmount = normalizeAmount(payload.amount);
    if (normalizedAmount === null || normalizedAmount < 0) {
      return 'Amount must be a non-negative number';
    }
    payload.amount = normalizedAmount;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'transaction_date')) {
    const normalizedDate = normalizeTransactionDate(payload.transaction_date);
    if (normalizedDate === null) {
      return 'Invalid transaction_date provided';
    }
    payload.transaction_date = normalizedDate;
  }

  return null;
};

const buildTransactionResponse = (transaction) => ({
  id: transaction._id,
  name: transaction.name,
  amount: transaction.amount,
  category: transaction.category,
  transaction_date: transaction.transaction_date,
  note: transaction.note,
  payment_method: transaction.payment_method,
  reference_id: transaction.reference_id,
  source: transaction.source,
  sms_body: transaction.sms_body,
  is_auto: transaction.is_auto,
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt,
});

const handleServerError = (res, error, logPrefix) => {
  console.error(`${logPrefix}:`, error);
  return res.status(500).json({ message: 'Server error' });
};

exports.createTransaction = async (req, res) => {
  try {
    const transactionPayload = sanitizePayload(req.body);
    const validationError = normalizeTransactionPayload(transactionPayload, { requireNameAndAmount: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      ...transactionPayload,
    });

    return res
      .status(201)
      .json({ message: 'Transaction created successfully', transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    return handleServerError(res, error, 'Create transaction error');
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ transaction_date: -1, createdAt: -1 });
    return res.json({ transactions: transactions.map(buildTransactionResponse) });
  } catch (error) {
    return handleServerError(res, error, 'Get transactions error');
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    return handleServerError(res, error, 'Get transaction error');
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const transactionPayload = sanitizePayload(req.body);
    const validationError = normalizeTransactionPayload(transactionPayload, { requireNameAndAmount: true });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      transactionPayload,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ message: 'Transaction updated successfully', transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    return handleServerError(res, error, 'Update transaction error');
  }
};

exports.partialUpdateTransaction = async (req, res) => {
  try {
    const transactionPayload = sanitizePayload(req.body);

    if (!Object.keys(transactionPayload).length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    const validationError = normalizeTransactionPayload(transactionPayload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      transactionPayload,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ message: 'Transaction updated successfully', transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    return handleServerError(res, error, 'Partial update transaction error');
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    return handleServerError(res, error, 'Delete transaction error');
  }
};