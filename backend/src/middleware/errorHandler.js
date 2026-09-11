/**
 * Global Express error handler.
 * Catches all errors thrown from async routes (via express-async-errors).
 * Uses err.status if set, otherwise defaults to 500.
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal backend error' });
}

module.exports = errorHandler;
