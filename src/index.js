const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routers/authRoutes');
const goalRoutes = require('./routers/goalRoutes');
const transcationRouters = require('./routers/transcationRoutes');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const parseEnvOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const localOrigins = [
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:8081',
  'http://127.0.0.1:8081'
];

const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? parseEnvOrigins(process.env.CORS_ALLOWED_ORIGINS)
  : [];

const allowedOrigins = Array.from(new Set([...localOrigins, ...envOrigins]));

const lanPorts = new Set(['19006', '8081']);

const isLanHostname = (hostname) =>
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { origin: normalizedOrigin, hostname, port, protocol } = new URL(origin);

    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    if (allowedOrigins.includes(normalizedOrigin)) {
      return true;
    }

    if (isLanHostname(hostname)) {
      return port ? lanPorts.has(port) : false;
    }
  } catch (error) {
    return false;
  }

  return false;
};

app.use(express.json());

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (!requestOrigin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (isAllowedOrigin(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/transcation', transcationRouters);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
  }
};

startServer();
