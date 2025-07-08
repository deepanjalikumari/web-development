import User, { UserDocument } from '../models/user.models';
import ApiError from '../utils/apiError.util';
import logger from '../utils/logger.util';
import { uploadToImageKit, deleteLocalFile } from '../utils/imageKit.util';
import registerUserValidation from '../validation/sign-up.validation';
import updatedUser from '../validation/update.validation';
import Joi from 'joi';
import crypto from 'crypto';
import sendMail from '../utils/sendmail.util';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: UserDocument;
}

const generateAccessTokenAndRefreshToken = async (
  userId: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const user = await User.findById(userId);

  if (!user) {
    logger.error('User not found');
    throw new ApiError(404, 'Authentication failed');
  }

  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const signUp = async (request: Request, response: Response) => {
  logger.info('Sign-up request received', { body: request.body });

  const { error, value } = registerUserValidation.validate(request.body);
  if (error) {
    logger.error('Validation failed', {
      message: error.message,
      stack: error.stack,
    });
    throw new ApiError(400, error.message);
  }

  const { username, email, password, firstName, lastName, phoneNumber, age } =
    value;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    logger.warn('User already exists with this email or username');
    throw new ApiError(409, 'User already exists with this email or username');
  }

  //Image handling

  let profileImageUrl;

  if (request.file) {
    try {
      const imageKitResponse = await uploadToImageKit(
        request.file.path,
        request.file.originalname,
      );
      profileImageUrl = imageKitResponse?.url;
      await deleteLocalFile(request.file.path);
      logger.info('Profile image uploaded and deleted successfully');
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Upload error', {
          message: error.message,
          stack: error.stack,
        });
        throw new ApiError(500, 'Failed to upload profile image');
      }
    }
  }
  // Create user
  const user = await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    age,
    profileImage: profileImageUrl || null,
  });

  //Tokens
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id as any);

  if (!user) {
    ``;
    logger.error('User creation failed');
    throw new ApiError(500, 'Failed to create user. Please try again later.');
  }

  logger.info('User successfully created', { userId: user._id });

  return response.status(201).json({
    success: true,
    data: {
      user: user,
      refreshToken: refreshToken,
      accessToken: accessToken,
    },
    message: 'User registration successful.',
  });
};

const signIn = async (request: Request, response: Response) => {
  console.log(request.body);
  const { username, email, password } = request.body;

  if (!username && !email) {
    logger.error('Username or email is required');
    throw new ApiError(400, 'Username or email is required');
  }

  if (!password) {
    logger.error('Password is required');
    throw new ApiError(400, 'Password is required');
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    logger.error('User not found');
    throw new ApiError(401, 'User not found');
  }

  //Check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    logger.error('Incorrect password');
    throw new ApiError(401, 'Incorrect password');
  }

  //  Mark user as active
  if (!user.isActive) {
    user.isActive = true;
    await user.save({ validateBeforeSave: false });
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id as any);

  response.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return response.status(200).json({
    success: true,
    data: {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
      },
    },
    message: 'User logged in successfully',
  });
};

const signOut = async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.user?._id;

  await User.findByIdAndUpdate(
    userId,
    { refreshToken: null, isActive: false },
    { new: true },
  );

  response.clearCookie('refreshToken', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  });
  console.log('Cookies after clearing:', request.cookies);
  response.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

const updateProfileDetails = async (
  request: AuthenticatedRequest,
  response: Response,
) => {
  logger.info('Request body', JSON.stringify(request.body));

  const { error, value } = updatedUser.validate(request.body);
  if (error) {
    logger.error('Validation error', {
      message: error.message,
      stack: error.stack,
    });
    throw new ApiError(404, error.message);
  }
  const { username, firstName, lastName, age, email, phoneNumber } = value;

  const userId = request.user?._id;
  console.log(userId);

  if (!userId) {
    logger.error('User id not found');
    throw new ApiError(404, 'User id not found');
  }
  const userUpdate = await User.findByIdAndUpdate(
    userId,
    {
      username,
      age,
      email,
      phoneNumber,
      firstName,
      lastName,
    },
    { new: true },
  );

  if (!userUpdate) {
    logger.error('Not able to updated user');
    throw new ApiError(404, 'Not able to updated the user');
  }

  response.status(201).json({
    success: true,
    data: userUpdate,
    message: 'User updated successfully',
  });
};

const updateProfilePicture = async (
  request: AuthenticatedRequest,
  response: Response,
) => {
  const userId = request.user?._id;

  if (!userId) {
    logger.error('User not authenticated');
    throw new ApiError(401, 'User not authenticated');
  }

  if (!request.file) {
    logger.error('Profile image file is required');
    throw new ApiError(400, 'Profile image file is required');
  }

  let profileImageUrl;

  try {
    const imageKitResponse = await uploadToImageKit(
      request.file.path,
      request.file.originalname,
    );
    profileImageUrl = imageKitResponse?.url;

    await deleteLocalFile(request.file.path);
    logger.info('Image uploaded successfully');
  } catch (error) {
    logger.error('Upload error');
    throw new ApiError(500, 'Failed to upload profile image');
  }

  const updatedProfilePicture = await User.findByIdAndUpdate(
    userId,
    {
      $set: { profileImage: profileImageUrl },
    },
    { new: true },
  );

  response.status(200).json({
    success: true,
    data: updatedProfilePicture,
    message: 'Profile picture changed successfully',
  });
};

const getUser = async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.user?._id;

  if (!userId) {
    logger.error('User not found');
    throw new ApiError(404, 'User not found');
  }

  const getUser = await User.findById(userId).select(
    '-password -refreshToken -__v -createdAt -updatedAt',
  );
  if (!getUser) {
    logger.error('User not found');
    throw new ApiError(404, 'User not found');
  }
  response.status(200).json({
    success: true,
    data: getUser,
    message: 'User retrieved successfully',
  });
};

const getUserById = async (
  request: AuthenticatedRequest,
  response: Response,
) => {
  const userId = request.params?.id;

  if (!userId) {
    logger.error('User not found');
    throw new ApiError(404, 'User not found');
  }

  const getUser = await User.findById(userId).select(
    '-password -refreshToken -__v -createdAt -updatedAt',
  );
  if (!getUser) {
    logger.error('User not found');
    throw new ApiError(404, 'User not found');
  }
  response.status(200).json({
    success: true,
    data: getUser,
    message: 'User retrieved successfully',
  });
};

const getAllUser = async (request: Request, response: Response) => {
  const users = await User.find({ role: 'User' }).select(
    '-password -refreshToken -__v -createdAt -updatedAt',
  );

  if (!users || users.length === 0) {
    logger.error('No users found');
    throw new ApiError(404, 'No users found');
  }

  response.status(200).json({
    success: true,
    data: users,
    message: 'Users retrieved successfully',
  });
};

const changePassword = async (
  request: AuthenticatedRequest,
  response: Response,
) => {
  const schema = Joi.object({
    oldPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      .required()
      .messages({
        'string.empty': 'Old password is required',
        'string.min': 'Old password must be at least 8 characters long',
        'string.max': 'Old password must not exceed 128 characters',
        'string.pattern.base':
          'Old password must contain uppercase, lowercase, number, and special character',
      }),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      .required()
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password must not exceed 128 characters',
        'string.pattern.base':
          'New password must contain uppercase, lowercase, number, and special character',
      }),
  });

  const { error, value } = schema.validate(request.body);

  if (error) {
    logger.error('Validation error', {
      message: error.message,
      stack: error.stack,
    });
    throw new ApiError(400, error.message);
  }

  const { oldPassword, newPassword } = value;
  const userId = request.user?._id;

  if (!userId) {
    logger.error('User ID missing from request');
    throw new ApiError(401, 'Unauthorized');
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.error('User not found');
      throw new ApiError(404, 'User not found');
    }

    const isMatch = await user.isPasswordCorrect(oldPassword);
    if (!isMatch) {
      logger.error('Old password is incorrect');
      throw new ApiError(401, 'Old password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return response.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    logger.error('Error while changing password');
    throw new ApiError(500, 'Internal Server Error');
  }
};

const resetPassword = async (request: Request, response: Response) => {
  const schema = Joi.object({
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      .required()
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password must not exceed 128 characters',
        'string.pattern.base':
          'New password must contain uppercase, lowercase, number, and special character',
      }),
  });

  const { error, value } = schema.validate(request.body);

  if (error) {
    logger.error('Validation error', {
      message: error.message,
      stack: error.stack,
    });
    throw new ApiError(404, 'Validation error');
  }
  const { newPassword } = value;
  const token = request.params.token;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      logger.error('Reset token is invalid or expired');
      throw new ApiError(400, 'Reset token is invalid or expired');
    }

    user.password = newPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return response.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error('Reset password failed', {
        message: err.message,
        stack: err.stack,
      });
      throw new ApiError(500, 'Internal Server Error');
    }
  }
};

// TODO: Forgot password using phone number also
const forgotPassword = async (request: Request, response: Response) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Invalid email format',
    }),
  });
  console.log(request.body);
  const { error, value } = schema.validate(request.body);

  if (error) {
    logger.log('Validation error', {
      message: error.message,
      stack: error.stack,
    });
    throw new ApiError(404, 'Email validation error');
  }

  const { email } = value;

  const user = await User.findOne({ email });
  if (!user) {
    logger.error('User not found with this email or phone number');
    throw new ApiError(404, 'User not found with this email or phone number');
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetLink = `https://cloudly.com/reset-password/${resetToken}`;

  await sendMail({
    to: user.email,
    templateId: 'd-96dd5760300b42b4ae1bf96323c67e7f',
    dynamicTemplateData: {
      resetLink,
    },
  });

  return response.status(201).json({
    success: true,
    message: 'Reset send successfully to your mail id',
  });
};

// TODO: Dont hard delete user
const deleteAccount = async (
  request: AuthenticatedRequest,
  response: Response,
) => {
  const userId = request.user?._id;

  if (!userId) {
    logger.error('Unauthorized: No user ID found in request');
    throw new ApiError(401, 'Unauthorized');
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.warn(`User not found with ID: ${userId}`);
    throw new ApiError(404, 'User not found');
  }

  await User.findByIdAndDelete(userId);

  logger.info(`User ${user.email} deleted permanently`);

  return response.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
};

export {
  signIn,
  signOut,
  signUp,
  updateProfileDetails,
  updateProfilePicture,
  getUserById,
  getUser,
  getAllUser,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
};
