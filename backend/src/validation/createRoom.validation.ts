import Joi from 'joi';

const createExperienceRoomValidator = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'Room name is required',
    'string.min': 'Room name must be at least 3 characters',
    'string.max': 'Room name must not exceed 100 characters',
  }),

  mode: Joi.string().valid('public', 'private').default('public').messages({
    'any.only': 'Mode must be either "public" or "private"',
  }),

  linkedListing: Joi.string().length(24).hex().optional().messages({
    'string.length': 'Linked listing ID must be a valid 24-character ObjectId',
    'string.hex': 'Linked listing ID must be a valid hexadecimal ObjectId',
  }),

  invitedUsers: Joi.array()
    .items(
      Joi.string().length(24).hex().messages({
        'string.length':
          'Each invited user ID must be a valid 24-character ObjectId',
        'string.hex':
          'Each invited user ID must be a valid hexadecimal ObjectId',
      }),
    )
    .optional(),

  images: Joi.array()
    .items(
      Joi.string().uri().messages({
        'string.uri': 'Each image must be a valid URL',
      }),
    )
    .optional()
    .messages({
      'array.base': 'Images must be an array of URLs',
    }),

  expiresAt: Joi.date().greater('now').optional().messages({
    'date.greater': 'Expiration date must be in the future',
    'date.base': 'ExpiresAt must be a valid date',
  }),

  isActive: Joi.boolean().optional(),
});

export default createExperienceRoomValidator;
