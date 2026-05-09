class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') { super(message, 401); }
}

class NotFoundError extends AppError {
  constructor(message) { super(message, 404); }
}

class ConflictError extends AppError {
  constructor(message) { super(message, 409); }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
};
