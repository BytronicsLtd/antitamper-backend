const fs = require('fs');
const path = require('path');

const DOWNLOADS_DIR = path.resolve(__dirname, '../../../downloads');
const MANIFEST_PATH = path.join(DOWNLOADS_DIR, 'manifest.json');

function readManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSafeFilename(name) {
  return typeof name === 'string' && name.length > 0 && !name.includes('/') && !name.includes('..');
}

module.exports = {
  // List the catalogue. For each manifest entry, attach size + availability
  // by stat-ing the file. Missing files are returned with available:false
  // so the UI can disable the download button instead of 404-ing.
  list: async (req, res) => {
    try {
      const manifest = readManifest();
      const enriched = manifest.map((entry) => {
        if (!entry || !entry.filename) return { ...entry, available: false };
        const filePath = path.join(DOWNLOADS_DIR, entry.filename);
        try {
          const stat = fs.statSync(filePath);
          return {
            ...entry,
            size: stat.size,
            updatedAt: stat.mtime,
            available: true,
          };
        } catch {
          return { ...entry, available: false };
        }
      });
      return res.status(200).send({ success: true, results: enriched });
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error listing downloads',
        error: err.message,
      });
    }
  },

  // Serve a file from the downloads dir. Strict filename validation guards
  // against path traversal — only flat names are allowed.
  serve: async (req, res) => {
    try {
      const { filename } = req.params;
      if (!isSafeFilename(filename)) {
        return res.status(400).send({ success: false, message: 'Invalid filename' });
      }
      const filePath = path.join(DOWNLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send({ success: false, message: 'File not found' });
      }
      const stat = fs.statSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime =
        ext === '.apk' ? 'application/vnd.android.package-archive'
        : ext === '.zip' ? 'application/zip'
        : ext === '.pdf' ? 'application/pdf'
        : 'application/octet-stream';
      res.header('Content-Type', mime);
      res.header('Content-Length', String(stat.size));
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(fs.createReadStream(filePath));
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error serving download',
        error: err.message,
      });
    }
  },
};
