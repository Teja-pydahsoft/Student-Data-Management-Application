const multer = require('multer');
const path = require('path');
const fs = require('fs');

const chatDir = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatDir),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '';
    cb(null, `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Invalid file type. Allowed: images (JPEG, PNG, GIF, WebP) and PDF.'), false);
};

const MAX_SIZE = 20 * 1024; // 20 KB
module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});
