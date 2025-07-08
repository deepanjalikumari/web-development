import Joi from 'joi';

const usernameRegex = /^[a-z0-9_.]+$/i;
const phoneRegex = /^[6-9]\d{9}$/;

const updatedUser = Joi.object({
  username: Joi.string()
    .pattern(usernameRegex)
    .min(3)
    .max(30)
    .optional()
    .messages({
      'string.empty': 'Username is required.',
      'string.pattern.base':
        'Username can only contain letters, numbers, underscores, and dots.',
    }),

  firstName: Joi.string().trim().min(2).max(50).optional().messages({
    'string.empty': 'First name is required.',
  }),

  lastName: Joi.string().trim().min(2).max(50).optional().messages({
    'string.empty': 'Last name is required.',
  }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: ['com', 'net', 'org', 'in', 'co'] } })
    .optional()
    .messages({
      'string.empty': 'Email is required.',
      'string.email': 'Please enter a valid email like yourname@gmail.com.',
    }),

  age: Joi.number().integer().min(13).max(100).optional(),

  phoneNumber: Joi.string().pattern(phoneRegex).optional().messages({
    'string.empty': 'Phone number is required.',
    'string.pattern.base': 'Phone number must be a valid Indian mobile number.',
  }),

  role: Joi.string().valid('User', 'Admin').optional(),
}).min(1);

export default updatedUser;
