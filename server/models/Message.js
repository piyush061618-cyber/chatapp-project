const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  username: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String }, // 'image', 'audio', or 'file'
  fileType: { type: String },
  size: { type: Number },
  duration: { type: Number }, // in seconds for voice notes
  url: { type: String }
}, { _id: false });

const ReplyToSchema = new mongoose.Schema({
  messageId: { type: String },
  author: { type: String },
  text: { type: String }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  message: { type: String, default: '' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  clientMessageId: { type: String, sparse: true, index: true },
  attachment: AttachmentSchema,
  replyTo: ReplyToSchema,
  reactions: [ReactionSchema],
  timestamp: { type: Date, default: Date.now },
});

// Compound indexes
MessageSchema.index({ room: 1, timestamp: -1 });
MessageSchema.index({ room: 1, isPinned: -1 });
MessageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', MessageSchema);
