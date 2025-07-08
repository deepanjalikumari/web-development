import { ErrorRequestHandler } from 'express';
import { expression } from 'joi';

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Server Error';

  if (err instanceof Error) {
    console.error(err);

    if ((err as any).name === 'CastError') {
      statusCode = 404;
      message = 'Resource not found';
    } else if ((err as any).code === 11000) {
      statusCode = 400;
      message = 'Duplicate field value entered';
    } else if ((err as any).name === 'ValidationError') {
      statusCode = 400;
      message = Object.values((err as any).errors)
        .map((val: any) => val.message)
        .join(', ');
    } else {
      message = err.message || message;
    }
  }

  res.status(statusCode).json({ success: false, error: message });

  next(err);
};

export default errorHandler;
