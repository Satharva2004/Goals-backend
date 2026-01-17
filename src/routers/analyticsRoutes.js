const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getAnalytics } = require('../controller/analyticsController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAnalytics);

module.exports = router;
