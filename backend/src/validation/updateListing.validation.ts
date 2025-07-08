import Joi from 'joi';

const updateListingValidator = Joi.object({
  title: Joi.string().trim().optional().messages({
    'string.empty': 'Title is optional',
  }),

  description: Joi.string().trim().optional().messages({
    'string.empty': 'Description is optional',
  }),

  category: Joi.string().optional().messages({
    'string.empty': 'Category is optional',
  }),

  listingType: Joi.string().valid('resell', 'share').optional().messages({
    'any.only': 'Listing type must be either "resell" or "share"',
  }),

  price: Joi.number().min(0).optional().messages({
    'number.min': 'Price must be at least 0',
    'number.base': 'Price must be a number',
  }),

  quantity: Joi.number().integer().min(1).default(1).optional().messages({
    'number.min': 'Quantity must be at least 1',
    'number.base': 'Quantity must be a number',
  }),

  location: Joi.object({
    address: Joi.string().trim().optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    country: Joi.string().trim().optional(),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  }).optional(),

  images: Joi.array().items(Joi.string()).min(1).optional().messages({
    'array.min': 'At least one image URL is optional',
  }),

  isActive: Joi.boolean().optional(),

  expiresAt: Joi.date().greater('now').optional().messages({
    'date.greater': 'Expiration date must be in the future',
    'date.base': 'ExpiresAt must be a valid date',
  }),

  isDeleted: Joi.boolean().optional(),
}).min(1);

export default updateListingValidator;
