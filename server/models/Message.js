const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  username: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String }, // 'image' or 'file'
  fileType: { type: String },
  size: { type: Number },
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
  attachment: AttachmentSchema,
  replyTo: ReplyToSchema,
  reactions: [ReactionSchema],
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
