// config/multerConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

exports.configureMulter = () => {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const companyName = req.company.name;
        const projectId = req.params.projectId;
        const dir = path.join('uploads', companyName, projectId || 'temp');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const safeName = `${Date.now()}-${file.originalname.replace(/[^a-z0-9.-]/g, '_')}`;
        cb(null, safeName);
      }
    }),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB per file
      files: 5
    },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`));
      }
    }
  });
};