import logger from '../utils/logger.util';
import User from '../models/user.models';
import ApiError from '../utils/apiError.util';
import { Request, Response, NextFunction } from 'express';
const isAdmin = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  try {
    const user = await User.findById(request.user?._id);

    if (!user) {
      logger.error('User not found', {
        message: 'User not found',
        stack: new Error().stack,
      });
      throw new ApiError(404, 'User not found');
    }

    if (user.role !== 'Admin') {
      logger.warn('Unauthorized access attempt by non-admin user', {
        userId: request.user?._id,
      });
      throw new ApiError(403, 'Access denied. Admins only.');
    }

    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error in isAdmin middleware', {
        message: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
};

export default isAdmin;
