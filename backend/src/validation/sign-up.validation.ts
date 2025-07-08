import Joi from 'joi';

const usernameRegex = /^[a-z0-9_.]+$/i;
const phoneRegex = /^[6-9]\d{9}$/;

export const registerUserValidation = Joi.object({
  username: Joi.string()
    .pattern(usernameRegex)
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.empty': 'Username is required.',
      'string.pattern.base':
        'Username can only contain letters, numbers, underscores, and dots.',
    }),

  firstName: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'First name is required.',
  }),

  lastName: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'Last name is required.',
  }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: ['com', 'net', 'org', 'in', 'co'] } })
    .required()
    .messages({
      'string.empty': 'Email is required.',
      'string.email': 'Please enter a valid email like yourname@gmail.com.',
    }),

  profileImage: Joi.string().uri().optional(),

  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&+=!]).*$/)
    .required()
    .messages({
      'string.empty': 'Password is required.',
      'string.pattern.base':
        'Password must include uppercase, lowercase, number, and special character.',
      'string.min': 'Password must be at least 8 characters.',
    }),

  age: Joi.number().integer().min(13).max(100).optional(),

  phoneNumber: Joi.string().pattern(phoneRegex).required().messages({
    'string.empty': 'Phone number is required.',
    'string.pattern.base': 'Phone number must be a valid Indian mobile number.',
  }),

  role: Joi.string().valid('User', 'Admin').optional(),
});

export default registerUserValidation;
