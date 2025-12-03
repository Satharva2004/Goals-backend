const express = require('express');
const { signup, login, refreshAccessToken, logout } = require('../controller/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

module.exports = router;
