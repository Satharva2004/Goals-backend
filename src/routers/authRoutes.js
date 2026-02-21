const express = require('express');
const { signup, login, refreshAccessToken, logout, googleLogin, sendOTP, verifyOTP } = require('../controller/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

module.exports = router;
