import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ListingDocument extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  listingType: 'resell' | 'share';
  price: number;
  quantity: number;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
  };
  images: string[];
  isActive: boolean;
  isApproved: boolean;
  expiresAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const listingSchema = new Schema<ListingDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    listingType: {
      type: String,
      enum: ['resell', 'share'],
      required: true,
    },
    price: {
      type: Number,
      min: 0,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
    },
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    images: {
      type: [String],
      default: [],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Listing = mongoose.model<ListingDocument>('Listing', listingSchema);

export { listingSchema };
export default Listing;
