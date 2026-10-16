const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Check if Cloudinary is configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype.includes('webm')) ext = '.webm';
    if (!ext && file.mimetype.includes('ogg')) ext = '.ogg';
    if (!ext && file.mimetype.includes('mp4')) ext = '.mp4';
    if (!ext && file.mimetype.includes('audio')) ext = '.webm';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'file_' + uniqueSuffix + (ext || ''));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;
    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/') || 
      file.originalname.endsWith('.webm') || 
      file.originalname.endsWith('.mp3') || 
      file.originalname.endsWith('.ogg') || 
      file.originalname.endsWith('.wav');

    let fileUrl = '';

    if (isCloudinaryConfigured) {
      // Auto resource type handles images, audio, video, and raw files seamlessly
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'pulsechat_media',
        resource_type: 'auto'
      });
      fileUrl = result.secure_url;
      fs.unlink(file.path, () => {});
    } else {
      const serverBase = req.protocol + '://' + req.get('host');
      fileUrl = `${serverBase}/uploads/${file.filename}`;
    }

    let detectedType = 'file';
    if (isAudio) detectedType = 'audio';
    else if (isImage) detectedType = 'image';

    res.json({
      url: fileUrl,
      name: file.originalname || 'Voice Note',
      size: file.size,
      type: detectedType,
      fileType: file.mimetype
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
