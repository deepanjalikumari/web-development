import { Request, Response } from 'express';
import logger from '../utils/logger.util';
import ApiError from '../utils/apiError.util';
import ExperienceRoom from '../models/room.model';
import User from '../models/user.models';
import createExperienceRoomValidator from '../validation/createRoom.validation';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { uploadToImageKit, deleteLocalFile } from '../utils/imageKit.util';

const createExperienceRoom = async (request: Request, response: Response) => {
  const { error, value } = createExperienceRoomValidator.validate(request.body);
  if (error) {
    logger.error('Validation error', {
      message: error.message,
      input: request.body,
      stack: new Error().stack,
    });
    throw new ApiError(400, 'Validation Error');
  }

  const { name } = value;
  const creatorUserId = request.user?._id;

  const creatorDetails = await User.findById(creatorUserId).select(
    '-updatedAt -isActive -createdAt -refreshToken -__v -role -password',
  );

  const newExperienceRoom = await ExperienceRoom.create({
    name,
    creator: creatorDetails,
    members: [
      {
        user: creatorUserId,
        joinedAt: new Date(),
      },
    ],
    moderators: [
      {
        user: creatorUserId,
        role: 'host',
        assignedAt: new Date(),
      },
    ],
  });

  if (!newExperienceRoom) {
    logger.error('Error creating experience room', {
      creatorUserId,
      name,
    });
    throw new ApiError(500, 'Error creating experience room');
  }

  return response.status(201).json({
    success: true,
    data: newExperienceRoom,
    message: 'Room created successfully',
  });
};

const getAllExperienceRoom = async (request: Request, response: Response) => {
  const { page = 1, limit = 10 } = request.query;
  const skip = ((page as number) - 1) * Number(limit);

  const experienceRooms = await ExperienceRoom.find()
    .skip(skip)
    .limit(Number(limit))
    .populate('creator', ' -refreshToken -__v  -updatedAt');

  if (!experienceRooms || experienceRooms.length === 0) {
    logger.warn('No experience rooms found', {
      page,
      limit,
      skip,
    });
    return response.status(404).json({
      success: false,
      message: 'No experience rooms found',
    });
  }

  return response.status(200).json({
    success: true,
    data: experienceRooms,
    message: 'Experience rooms retrieved successfully',
  });
};

const getExperienceRoomById = async (request: Request, response: Response) => {
  const { roomId } = request.params;
  if (!roomId) {
    logger.error('Room ID is required', {
      stack: new Error().stack,
    });
    throw new ApiError(400, 'Room ID is required');
  }
  const experienceRoom = await ExperienceRoom.findById(roomId)
    .populate('creator', '-refreshToken -__v -updatedAt')
    .populate('members', '-refreshToken -__v -updatedAt');
  if (!experienceRoom) {
    logger.error('Experience room not found', {
      roomId,
      stack: new Error().stack,
    });
    throw new ApiError(404, 'Experience room not found');
  }
  return response.status(200).json({
    success: true,
    data: experienceRoom,
    message: 'Experience room retrieved successfully',
  });
};

const deleteExperienceRoom = async (request: Request, response: Response) => {
  const { roomId } = request.params;
  if (!roomId) {
    logger.error('Room ID is required', {
      stack: new Error().stack,
    });
    throw new ApiError(400, 'Room ID is required');
  }

  const experienceRoom = await ExperienceRoom.findByIdAndDelete(roomId);
  if (!experienceRoom) {
    logger.error('Experience room not found or already deleted', {
      roomId,
      stack: new Error().stack,
    });
    throw new ApiError(404, 'Experience room not found or already deleted');
  }

  return response.status(200).json({
    success: true,
    message: 'Experience room deleted successfully',
  });
};

const inviteUserToRoom = async (request: Request, response: Response) => {
  const inviteValidation = Joi.object({
    token: Joi.string().uuid().required().messages({
      'string.empty': 'Token is required',
      'string.guid': 'Token must be a valid UUID',
    }),

    room: Joi.string().length(24).hex().required().messages({
      'string.length': 'Room ID must be a 24-character ObjectId',
      'string.hex': 'Room ID must be a valid ObjectId',
      'string.empty': 'Room ID is required',
    }),

    invitedBy: Joi.string().length(24).hex().required().messages({
      'string.length': 'InvitedBy must be a 24-character ObjectId',
      'string.hex': 'InvitedBy must be a valid ObjectId',
      'string.empty': 'InvitedBy is required',
    }),

    used: Joi.boolean().optional(),

    expiresAt: Joi.date().greater('now').required().messages({
      'date.base': 'ExpiresAt must be a valid date',
      'date.greater': 'ExpiresAt must be in the future',
    }),
  });

  const { error, value } = inviteValidation.validate(request.body);
  if (error) {
    logger.error('Validation error', {
      message: error.message,
      stack: new Error().stack,
    });
    throw new ApiError(404, 'Validation error');
  }
  const token = uuidv4();
  const { roomId, invitedByUserId, expiresAt } = value;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    logger.error('No room found');
    response.json({
      success: false,
      message: 'No room found',
    });
    throw new ApiError(404, 'No room found');
  }
  room.invites = room.invites || [];
  room.invites.push({
    token,
    invitedBy: invitedByUserId,
    used: false,
    expiresAt,
  });
  await room.save();

  const inviteLink = `https://croudly/invite/experience-room?token=${token}`;

  return response.status(201).json({
    success: true,
    data: inviteLink,
    message: 'Invite link created successfully',
  });
};

const joinExperienceRoom = async (request: Request, response: Response) => {
  const { token } = request.params;
  const userId = request.user?._id;

  try {
    const room = await ExperienceRoom.findOne({
      invites: {
        $elemMatch: {
          token,
          used: false,
          expiresAt: { $gt: Date.now() },
        },
      },
    });

    if (!room) {
      return response.status(201).json({
        success: false,
        message: 'No room found',
      });
    }
    const invite = room.invites.find((inv) => inv.token === token);

    const alreadyJoined = room.members.some(
      (m) => m.user.toString() === userId.toString(),
    );

    if (alreadyJoined) {
      return response.json({
        success: false,
        message: 'User already room member',
      });
    }

    room.members.push({ user: userId, joinedAt: Date.now() });

    invite.used = true;
    await room.save();

    return response.status(201).json({
      sucess: true,
      message: 'User joined room successfully',
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Server error', {
        message: error.message,
        stack: error.stack,
      });
      throw new ApiError(500, 'Server error');
    }
  }
};

const removeUserFromRoom = async (request, response) => {
  const { roomId } = request.params;
  const { removeUserId } = request.body;
  const currentUserId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Room not found',
    });
  }

  const isCurrentUserHost =
    room.creator.toString() === currentUserId.toString();

  const isCurrentUserCoHost = room.moderators.some(
    (coHostId) => (coHostId) => coHostId.toString === currentUserId.toString(),
  );
  const isCurrentUserModerator = room.moderators.some(
    (modId) => modId.toString() === currentUserId.toString(),
  );

  const isTargetUserModerator = room.moderators.some(
    (modId) => modId.toString() === removeUserId.toString(),
  );

  if (isTargetUserModerator) {
    if (!isCurrentUserHost && !isCurrentUserCoHost) {
      return response.status(403).json({
        success: false,
        message: 'Only the host or co-host can remove a moderator',
      });
    }
  } else {
    if (!isCurrentUserHost && !isCurrentUserModerator) {
      return response.status(403).json({
        success: false,
        message: 'Only host or moderator can remove members',
      });
    }
  }

  room.members = room.members.filter(
    (m) => m.user.toString() !== removeUserId.toString(),
  );
  room.invitedUsers = room.invitedUsers.filter(
    (id) => id.toString() !== removeUserId.toString(),
  );
  room.moderators = room.moderators.filter(
    (id) => id.toString() !== removeUserId.toString(),
  );

  await room.save();

  return response.status(200).json({
    success: true,
    message: 'User removed successfully from the room',
  });
};

const leaveExperienceRoom = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);

  const user = room.members.find(
    (member) => member.user.toString() === userId.toString,
  );

  if (!user) {
    return response.json({
      success: false,
      message: 'User is not in room',
    });
  }

  room.members = room.members.filter(
    (member) => member.user.toString() !== userId.toString(),
  );

  await room.save();

  return response.json({
    success: true,
    message: 'User leaved remove successfully',
  });
};

const sendMessageToRoom = async (request, response) => {
  const senderId = request.user?._id;
  const { roomId } = request.params;
  const { text } = request.body;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.status(201).json({
      success: false,
      message: 'Room does not exist',
    });
  }

  const isMember = room.members.find(
    (member) => member.user.toString() === senderId.toString(),
  );

  const isUserBlocked = room.blockedUsers.includes(senderId.toString());

  if (!isMember) {
    return response.status(201).json({
      success: false,
      message: 'User is not member of this room',
    });
  }
  if (isUserBlocked) {
    return response.status(201).json({
      success: false,
      message: 'User is blocked cannot send message',
    });
  }
  const message = room.messages.push({
    sender: senderId,
    text,
    sentAt: new Date(),
  });

  await room.save();

  return response.status(201).json({
    success: true,
    data: {
      message,
    },
    message: 'Message sent successfully',
  });
};
const uploadRoomMedia = async (request, response) => {
  const mediaValidation = Joi.object({
    type: Joi.string()
      .valid('image', 'video', 'voice', 'link')
      .required()
      .messages({
        'any.only': 'Type must be one of: image, video, voice, or link',
        'string.empty': 'Type is required',
      }),
    text: Joi.string().optional(),
  });

  const { error, value } = mediaValidation.validate(request.body);
  if (error) {
    logger.error('Validation error', {
      message: error.message,
      stack: error.stack,
    });
    return response.status(400).json({
      success: false,
      message: error.message,
    });
  }

  const { roomId } = request.params;
  const userId = request.user?._id;
  const { type, text = '' } = value;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Room not found',
    });
  }

  const mediaUrls = [];

  if (request.files && request.files.length > 0) {
    for (const file of request.files) {
      try {
        // console.log('Uploading file', file);
        const uploaded = await uploadToImageKit(file.path, file.originalname);
        if (uploaded?.url) {
          // logger.info('Uploaded to ImageKit:', uploaded.url);
          mediaUrls.push({
            type,
            url: uploaded.url,
            postedBy: userId,
            postedAt: new Date(),
          });
        } else {
          logger.error('No url returned from imagekit');
          throw new ApiError(404, 'No URL returned from ImageKit');
        }
        deleteLocalFile(file.path);
      } catch (err) {
        logger.error('Upload error', { message: err.message });
        return response.status(500).json({
          success: false,
          message: `Upload failed: ${err.message}`,
        });
      }
    }
  }

  if (mediaUrls.length === 0 && !text.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Either text or media is required',
    });
  }

  room.media.push(...mediaUrls);

  room.messages.push({
    sender: userId,
    text,
    media: mediaUrls.length === 1 ? mediaUrls[0] : mediaUrls,
    sentAt: new Date(),
  });

  await room.save();

  return response.status(201).json({
    success: true,
    message: 'Media uploaded and message sent',
  });
};

const getRoomMembers = async (request, response) => {
  const { roomId } = request.params;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    logger.error('Room not found', {
      roomId,
      stack: new Error().stack,
    });
    throw new ApiError(404, 'Room not found');
  }

  const members = await User.find({
    _id: { $in: room.members.map((m) => m.user) },
  }).select('-refreshToken -__v -updatedAt');

  if (!members || members.length === 0) {
    logger.warn('No members found in room', {
      roomId,
      stack: new Error().stack,
    });
    return response.status(404).json({
      success: false,
      message: 'No members found in this room',
    });
  }

  return response.status(200).json({
    success: true,
    message: 'Room members fetched successfully',
    data: members,
  });
};

const getRoomMessages = async (request, response) => {
  const { roomId } = request.params;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    logger.error('Room not found', {
      roomId,
      stack: new Error().stack,
    });
    throw new ApiError(404, 'Room not found');
  }

  if (room.messages.length === 0) {
    return response.status(200).json({
      success: true,
      message: 'No messages in this room',
      data: [],
    });
  }

  return response.status(200).json({
    success: true,
    message: 'Room messages fetched successfully',
    data: room.messages,
  });
};

const deleteMessageFromRoom = async (request, response) => {
  const { roomId } = request.params;
  const { messageId } = request.body;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Room does not exist',
    });
  }

  const messageToDelete = room.messages.find(
    (message) => message._id.toString() === messageId.toString(),
  );

  if (!messageToDelete) {
    return response.status(404).json({
      success: false,
      message: 'Message not found in this room',
    });
  }

  const isCreator = room.creator.toString() === userId.toString();
  const isModerator = room.moderators?.some(
    (modId) => modId.toString() === userId.toString(),
  );
  const isSender = messageToDelete.sender.toString() === userId.toString();

  if (!isSender && !isModerator && !isCreator) {
    return response.status(403).json({
      success: false,
      message:
        'Only the sender, a moderator, or the room creator can delete this message',
    });
  }

  room.messages = room.messages.filter(
    (msg) => msg._id.toString() !== messageId.toString(),
  );

  await room.save();

  return response.status(200).json({
    success: true,
    message: 'Message deleted successfully',
  });
};

const deleteRoomMessages = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.json({
      success: false,
      message: 'Room does not exist',
    });
  }

  const isUserModerator = room.moderators.some(
    (modId) => modId.toString() === userId.toString(),
  );

  const isUserCreator = room.creator.toString() === userId.toString();

  if (!isUserModerator && !isUserCreator) {
    return response.json({
      success: false,
      message: 'Sorry you do not have authority to delete messages',
    });
  }

  room.messages = [];

  await room.save();

  return response.status(201).json({
    success: true,
    message: 'Successfully deleted all messages',
  });
};

const getRoomMedia = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?.id;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.json({
      success: false,
      message: 'No room found',
    });
  }
  const isRoomPrivate = room.mode === 'private';
  const isUserMember = room.members.some(
    (member) => member._id.toString() === userId.toString(),
  );

  if (isRoomPrivate && !isUserMember) {
    return response.json({
      message: 'Sorry you are not member of room you cannot access media.',
    });
  }

  const roomMedia = room.media;

  return response.status(201).json({
    success: true,
    data: roomMedia,
    message: 'Room media fetched successfully',
  });
};

const deleteRoomMedia = async (request, response) => {
  const { roomId } = request.params;
  const { mediaId } = request.body;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Room not found',
    });
  }

  const isUserModerator = room.moderators?.some(
    (modId) => modId.toString() === userId.toString(),
  );
  const isUserCreator = room.creator.toString() === userId.toString();
  const mediaToDelete = room.media.find(
    (media) => media._id.toString() === mediaId.toString(),
  );
  const isUserPostedMedia =
    mediaToDelete?.postedBy.toString() === userId.toString();

  if (!isUserModerator && !isUserCreator && !isUserPostedMedia) {
    return response.status(403).json({
      success: false,
      message: 'You are not authorized to delete this media file',
    });
  }

  room.media = room.media.filter(
    (media) => media._id.toString() !== mediaId.toString(),
  );

  await room.save();

  return response.status(200).json({
    success: true,
    message: 'Media deleted successfully',
  });
};

const toogleRoomPrivacy = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Sorry, no room found',
    });
  }

  const isUserModerator = room.moderators.some(
    (modId) => modId._id.toString() === userId.toString(),
  );
  const isUserCreator = room.creator.toString() === userId.toString();

  if (isUserCreator || isUserModerator) {
    room.mode = room.mode === 'private' ? 'public' : 'private';
    await room.save();

    return response.status(200).json({
      success: true,
      message: 'Room privacy changed successfully',
    });
  }

  return response.status(403).json({
    success: false,
    message: 'Sorry, you are not authorised to change room privacy',
  });
};

const isUserRoomAdmin = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.json({
      success: false,
      message: 'Room does not exist',
    });
  }

  if (room.creator.toString() === userId.toString()) {
    return response.status(201).json({
      success: true,
      message: 'Yes user is the creator of room',
    });
  } else {
    return response.json({
      success: false,
      message: 'User is not the creator of the room',
    });
  }
};

const verifyRoomAccess = async (request, response) => {};

const generateVideoToken = async (request, response) => {};

const startLiveSessionInRoom = async (request, response) => {};

const endLiveSessionInRoom = async (request, response) => {};

const getLiveRoomStatus = async (request, response) => {};

const muteUserInRoom = async (request, response) => {};

const blockUserInRoom = async (request, response) => {
  const { roomId } = request.params;
  const currentUserId = request.user?._id;
  const userToBlockId = request.body;

  const room = await ExperienceRoom.findById(roomId);
  if (!room) {
    return response.status(404).json({
      success: false,
      message: 'Room not found',
    });
  }

  const isCreator = room.creator.toString() === currentUserId.toString();

  const currentUserMod = room.moderators.find(
    (mod) => mod.user.toString() === currentUserId.toString(),
  );
  const targetUserMod = room.moderators.find(
    (mod) => mod.user.toString() === userToBlockId,
  );

  const currentUserRole = isCreator
    ? 'creator'
    : currentUserMod?.role || 'user';
  const targetUserRole = targetUserMod?.role || 'user';

  const isAlreadyBlocked = room.blockedUsers.some(
    (id) => id.toString() === userToBlockId,
  );
  if (isAlreadyBlocked) {
    return response.status(400).json({
      success: false,
      message: 'User is already blocked',
    });
  }

  const canBlock = () => {
    if (currentUserRole === 'creator') return true;
    if (currentUserRole === 'host') {
      return ['co-host', 'moderator', 'user'].includes(targetUserRole);
    }
    if (currentUserRole === 'co-host') {
      return ['moderator', 'user'].includes(targetUserRole);
    }
    if (currentUserRole === 'moderator') {
      return targetUserRole === 'user';
    }
    return false;
  };

  if (!canBlock()) {
    return response.status(403).json({
      success: false,
      message: 'You are not authorized to block this user',
    });
  }

  room.blockedUsers.push(userToBlockId);
  await room.save();

  return response.status(200).json({
    success: true,
    message: 'User blocked successfully',
  });
};

const assignRoomModerator = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;

  const { targetUser, role } = request.body;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.json({
      success: false,
      message: 'Sorry no room found',
    });
  }

  const checkUserCreator = room.creator.toString() === userId.toString();

  const checkUserModerator = room.moderators.find(
    (modId) => modId._id.toString() === userId.toString(),
  );

  const targetUserIsModerator = room.moderators.find(
    (modId) => modId._id.toString() === targetUser.toString(),
  );

  const targetUserRole = targetUserIsModerator?.role;

  if (targetUserRole === role) {
    return response.json({
      success: false,
      message: `User has already assigned : ${role}`,
    });
  }

  const currentUserRole = checkUserCreator
    ? 'creator'
    : checkUserModerator?.role || 'user';

  const canAssignRole = () => {
    if (checkUserCreator) return true;
    if (currentUserRole === 'host') {
      return ['co-host', 'moderator', 'helper'].includes(role);
    } else if (currentUserRole === 'co-host') {
      return ['moderator', 'helper'].includes(role);
    } else if (currentUserRole === 'moderator') {
      return ['helper'].includes(role);
    }

    return false;
  };

  if (!canAssignRole()) {
    return response.json({
      success: false,
      message: 'Sorry this user cannot be assgined any role',
    });
  }

  room.moderators.push({
    user: targetUser,
    role: role,
  });
  await room.save();

  return response.json({
    success: true,
    message: `User has assigned ${role} successfully`,
  });
};

const removeModeratorFromRoom = async (request, response) => {
  const { roomId } = request.params;
  const userId = request.user?._id;
  const { targetedUserId } = request.body;

  const room = await ExperienceRoom.findById(roomId);

  if (!room) {
    return response.json({
      success: false,
      message: 'Sorry, room not found',
    });
  }

  const isCreator = room.creator.toString() === userId.toString();

  if (isCreator) {
    room.moderators = room.moderators.filter(
      (mod) => mod._id.toString() !== targetedUserId.toString(),
    );
    await room.save();
    return response.json({
      success: true,
      message: 'Moderator removed successfully by creator',
    });
  }

  const currentUser = room.moderators.find(
    (mod) => mod._id.toString() === userId.toString(),
  );
  const targetUser = room.moderators.find(
    (mod) => mod._id.toString() === targetedUserId.toString(),
  );

  if (!currentUser || !targetUser) {
    return response.json({
      success: false,
      message: 'Either you or target user is not a valid moderator',
    });
  }

  const currentUserRole = currentUser.role;
  const targetUserRole = targetUser.role;

  if (currentUserRole === targetUserRole) {
    return response.json({
      success: false,
      message: 'Target user has the same role. You cannot remove this user.',
    });
  }

  const canRemoveFromModerator = () => {
    if (currentUserRole === 'host') return true;
    if (currentUserRole === 'co-host') {
      return ['moderator', 'helper'].includes(targetUserRole);
    } else if (currentUserRole === 'moderator') {
      return targetUserRole === 'helper';
    }
    return false;
  };

  if (!canRemoveFromModerator()) {
    return response.json({
      success: false,
      message: 'Sorry, you cannot remove this user from moderator role',
    });
  }

  room.moderators = room.moderators.filter(
    (mod) => mod._id.toString() !== targetedUserId.toString(),
  );
  await room.save();

  return response.json({
    success: true,
    message: 'Moderator removed successfully',
  });
};

export {
  createExperienceRoom,
  removeModeratorFromRoom,
  removeUserFromRoom,
  muteUserInRoom,
  blockUserInRoom,
  getLiveRoomStatus,
  endLiveSessionInRoom,
  assignRoomModerator,
  startLiveSessionInRoom,
  getRoomMembers,
  generateVideoToken,
  isUserRoomAdmin,
  verifyRoomAccess,
  toogleRoomPrivacy,
  deleteExperienceRoom,
  deleteRoomMedia,
  getRoomMedia,
  uploadRoomMedia,
  deleteMessageFromRoom,
  deleteRoomMessages,
  sendMessageToRoom,
  getRoomMessages,
  joinExperienceRoom,
  leaveExperienceRoom,
  inviteUserToRoom,
  getAllExperienceRoom,
  getExperienceRoomById,
};
