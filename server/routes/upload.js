const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Check if Cloudinary has real (non-placeholder) credentials
const rawCloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const rawApiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
const rawApiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

const isCloudinaryConfigured = Boolean(
  rawCloudName &&
  !rawCloudName.includes('your_') &&
  rawApiKey &&
  !rawApiKey.includes('your_') &&
  rawApiSecret &&
  !rawApiSecret.includes('your_')
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: rawCloudName,
    api_key: rawApiKey,
    api_secret: rawApiSecret
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

    // Build secure public URL (HTTPS for cloud/production)
    let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'localhost:3001';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      protocol = 'https';
    }
    const serverBase = `${protocol}://${host}`;

    let fileUrl = '';

    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'pulsechat_media',
          resource_type: 'auto'
        });
        fileUrl = result.secure_url;
        // Clean up temp file
        fs.unlink(file.path, () => {});
      } catch (cloudErr) {
        console.warn('⚠️ Cloudinary upload failed, falling back to local storage:', cloudErr.message);
        fileUrl = `${serverBase}/uploads/${file.filename}`;
      }
    } else {
      fileUrl = `${serverBase}/uploads/${file.filename}`;
    }

    let detectedType = 'file';
    if (isAudio) detectedType = 'audio';
    else if (isImage) detectedType = 'image';

    res.json({
      url: fileUrl,
      name: file.originalname || 'Attachment',
      size: file.size,
      type: detectedType,
      fileType: file.mimetype
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to upload file', details: err.message });
  }
});

module.exports = router;
