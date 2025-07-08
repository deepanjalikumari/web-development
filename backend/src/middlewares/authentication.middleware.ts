import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.util';
import logger from '../utils/logger.util';
import dotenv from 'dotenv';
import User, { UserDocument } from '../models/user.models';
import { Request, NextFunction, Response } from 'express';
dotenv.config();

interface jwtPayload {
  _id: string;
}

const verifyJwt = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const authHeader = request.header('Authorization');

  const token =
    request.cookies?.access_token ||
    request.body?.access_token ||
    (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    logger.error('Token not found');
    throw new ApiError(404, 'Token not found');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwtPayload;

    const user = await User.findById(decoded._id).select('-refreshToken');

    if (!user) {
      logger.error(`User not found decoded id : ${decoded._id}`);
      throw new ApiError(404, 'User not found with decoded token id');
    }

    request.user = user;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.info('Authentication error:', error);
      logger.error('Authentication failed', {
        message: error.message,
        stack: error.stack,
      });
      throw new ApiError(404, 'Authetication failed');
    }
  }
};

export default verifyJwt;
