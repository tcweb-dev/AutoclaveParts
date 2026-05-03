'use strict';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/gif',
]);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Only JPEG, PNG, and GIF images are allowed (received ${file.mimetype || 'unknown'}).`,
      ),
      false,
    );
  }
}

export const uploadFields = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 2 },
}).fields([
  { name: 'picture', maxCount: 1 },
  { name: 'picture2', maxCount: 1 },
]);

/** Wrap multer to pass errors to express error handler */
export function handleUpload(req, res, next) {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.session.validationErrors = [
        {
          msg:
            err.code === 'LIMIT_FILE_SIZE'
              ? 'Image must be under 5 MB'
              : err.message,
        },
      ];
      return res.redirect('back');
    }
    if (err) {
      req.session.validationErrors = [{ msg: err.message }];
      return res.redirect('back');
    }
    // Normalise to req.file / req.file2 for convenience
    req.file = req.files?.picture?.[0];
    req.file2 = req.files?.picture2?.[0];
    next();
  });
}
