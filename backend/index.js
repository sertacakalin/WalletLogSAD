const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();

const authRoutes        = require('./routes/authRoutes');
const categoryRoutes    = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes      = require('./routes/budgetRoutes');
const { errorHandler }  = require('./middleware/errorHandler');
const { requireAuth }   = require('./middleware/authMiddleware');
const { authLimiter }   = require('./middleware/rateLimit');

if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 16) {
  // Fail fast: do not boot a vulnerable server.
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_ACCESS_SECRET must be set (min 16 chars). Check your .env.');
  process.exit(1);
}

const swaggerDoc = YAML.load(path.join(__dirname, 'swagger.yaml'));

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/categories',   requireAuth, categoryRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/budgets',      requireAuth, budgetRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/', (_req, res) => res.redirect('/api-docs'));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  // eslint-disable-next-line no-console
  app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
}

module.exports = app;
