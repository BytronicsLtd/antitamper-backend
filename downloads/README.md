# Downloads

Files served by `GET /api/v1/downloads/<filename>`.

Drop release artefacts here (APKs, helper installers, sample configs) and
list them in `manifest.json`. Entries without a matching file on disk are
returned with `available: false` so the UI can grey them out instead of
404-ing.

Files are public — no auth required. Don't put credentials or anything
sensitive in this directory.
