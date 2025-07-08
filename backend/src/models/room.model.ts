import mongoose, { Schema } from 'mongoose';

const experienceRoomSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    mode: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    invites: [
      {
        token: { type: String, required: true },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        used: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true },
      },
    ],

    invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    moderators: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: {
          type: String,
          enum: ['host', 'co-host', 'moderator', 'helper'],
          default: 'moderator',
        },
        assignedAt: { type: Date, default: Date.now },
      },
    ],

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    linkedListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },

    media: [
      {
        type: {
          type: String,
          enum: ['image', 'video', 'voice', 'link'],
        },
        url: String,
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        postedAt: { type: Date, default: Date.now },
      },
    ],

    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String },
        media: {
          type: {
            type: String,
            enum: ['image', 'video', 'voice', 'link'],
          },
          urls: [{ type: String }],
        },
        sentAt: { type: Date, default: Date.now },
      },
    ],

    isLive: {
      type: Boolean,
      default: false,
    },

    streamURL: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    expiresAt: {
      type: Date,
      default: () => Date.now() + 24 * 60 * 60 * 1000,
    },
  },
  { timestamps: true },
);

const ExperienceRoom = mongoose.model('ExperienceRoom', experienceRoomSchema);

export default ExperienceRoom;
