import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface UserDocument extends Document {
  username: string;
  email: string;
  lastName: string;
  firstName: string;
  profileImage?: string;
  password: string;
  age?: number;
  phoneNumber: string;
  role: 'User' | 'Admin';
  refreshToken?: string;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;

  //Methods
  isPasswordCorrect(password: string): Promise<boolean>;
  generateAccessToken(): Promise<string>;
  generateRefreshToken(): Promise<string>;
}

const userSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      required: [true, 'Username is required.'],
    },
    firstName: {
      type: String,
      trim: true,
      required: [true, 'First name is required.'],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, 'Last name is required.'],
    },
    email: {
      type: String,
      trim: true,
      required: [true, 'Email is required.'],
      unique: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
    },
    age: {
      type: Number,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
    },
    role: {
      type: String,
      enum: ['User', 'Admin'],
      default: 'User',
    },
    refreshToken: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.isPasswordCorrect = async function (
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

//Generate access token
userSchema.methods.generateAccessToken = async function (): Promise<string> {
  const payLoad = {
    _id: this._id.toString(),
  };
  const secret: Secret = process.env.JWT_SECRET!;
  return jwt.sign(payLoad, secret, {
    expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES! as any,
  });
};
//Genrate refresh token
userSchema.methods.generateRefreshToken = async function (): Promise<string> {
  const payLoad = { _id: this._id as any };
  const secret: Secret = process.env.JWT_SECRET!;
  return jwt.sign(payLoad, secret, {
    expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES! as any,
  });
};

const User = mongoose.model<UserDocument>('User', userSchema);
export default User;
