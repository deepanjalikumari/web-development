import Joi from 'joi';

const listingValidator = Joi.object({
  title: Joi.string().trim().required().messages({
    'string.empty': 'Title is required',
  }),

  description: Joi.string().trim().required().messages({
    'string.empty': 'Description is required',
  }),

  category: Joi.string().required().messages({
    'string.empty': 'Category is required',
  }),

  listingType: Joi.string().valid('resell', 'share').required().messages({
    'any.only': 'Listing type must be either "resell" or "share"',
  }),

  price: Joi.number().min(0).required().messages({
    'number.min': 'Price must be at least 0',
    'number.base': 'Price must be a number',
  }),

  quantity: Joi.number().integer().min(1).default(1).required().messages({
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

  images: Joi.array().items(Joi.string()).min(1).required().messages({
    'array.min': 'At least one image URL is required',
  }),

  isActive: Joi.boolean().optional(),

  expiresAt: Joi.date().greater('now').required().messages({
    'date.greater': 'Expiration date must be in the future',
    'date.base': 'ExpiresAt must be a valid date',
  }),

  isDeleted: Joi.boolean().optional(),
});

export default listingValidator;
