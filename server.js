'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const { Readable } = require('node:stream');
const express = require('express');
const multer = require('multer');
const {
  YouCamError,
  assertHttpsUrl,
  extractFileUploadInfo,
  extractTaskId,
  parseTaskResult,
  requestJson,
} = require('./lib/youcam');

const app = express();
const PORT = Number(process.env.PORT) || 3939;
const API_BASE_URL = (process.env.YOUCAM_API_BASE_URL || 'https://yce-api-01.makeupar.com').replace(/\/$/, '');
const API_KEY = process.env.YOUCAM_API_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const JOB_TTL_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 8000;
const MAX_POLL_ATTEMPTS = 60;
const jobs = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 2, fields: 6, parts: 10 },
});

function getApiKey() {
  return process.env.YOUCAM_API_KEY || API_KEY;
}

function jsonApiHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function isSupportedImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length < 12) return null;
  const b = file.buffer;
  const isPng = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const declared = (file.mimetype || '').toLowerCase();
  if (isPng && (!declared || declared === 'image/png' || declared === 'application/octet-stream')) return 'image/png';
  if (isJpeg && (!declared || declared === 'image/jpeg' || declared === 'image/jpg' || declared === 'application/octet-stream')) return 'image/jpg';
  return null;
}

function validateFiles(files) {
  const userImage = files && files.userImage && files.userImage[0];
  const productImage = files && files.productImage && files.productImage[0];
  if (!userImage || !productImage) {
    const error = new Error('Add both a person photo and a garment image.');
    error.status = 400;
    throw error;
  }
  for (const [label, file] of [['person photo', userImage], ['garment image', productImage]]) {
    if (!file.buffer || file.size === 0) {
      const error = new Error(`The ${label} is empty. Choose another image.`);
      error.status = 400;
      throw error;
    }
    if (file.size > MAX_FILE_BYTES) {
      const error = new Error(`The ${label} is over the 10 MB limit.`);
      error.status = 413;
      throw error;
    }
    const verifiedMime = isSupportedImage(file);
    if (!verifiedMime) {
      const error = new Error(`The ${label} must be a valid JPG or PNG image.`);
      error.status = 400;
      throw error;
    }
    file.verifiedMime = verifiedMime;
  }
  return { userImage, productImage };
}

function parseBoolean(value, defaultValue = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return defaultValue;
}

function validateOptions(body = {}) {
  const allowedCategories = new Set(['auto', 'full_body', 'upper_body', 'lower_body', 'outer', 'shoes']);
  const allowedFilters = new Set(['off', 'normal', 'strict']);
  const allowedTypes = new Set(['apparel', 'earring']);
  const tryonType = allowedTypes.has(body.tryon_type) ? body.tryon_type : 'apparel';
  const garmentCategory = allowedCategories.has(body.garment_category) ? body.garment_category : 'auto';
  const filterMultiPerson = allowedFilters.has(body.filter_multi_person) ? body.filter_multi_person : 'strict';
  return {
    tryonType,
    garmentCategory,
    filterMultiPerson,
    changeShoes: parseBoolean(body.change_shoes, true),
  };
}

function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: Date.now() });
}

function publicJob(job) {
  return {
    jobId: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    taskId: job.taskId || null,
    error: job.error || null,
    tryonType: job.tryonType || 'apparel',
    garmentCategory: job.garmentCategory,
    resultImage: job.status === 'success' ? `/api/jobs/${encodeURIComponent(job.id)}/image` : null,
    createdAt: new Date(job.createdAt).toISOString(),
  };
}

function apiUrl(pathname) {
  return `${API_BASE_URL}${pathname}`;
}

async function registerAndUploadImage(file, slotName, apiKey) {
  const extension = file.verifiedMime === 'image/png' ? 'png' : 'jpg';
  const fileName = `${slotName}-${crypto.randomUUID()}.${extension}`;
  const registration = await requestJson(apiUrl('/s2s/v2.0/file'), {
    method: 'POST',
    headers: jsonApiHeaders(apiKey),
    body: JSON.stringify({
      files: [{
        content_type: file.verifiedMime,
        file_name: fileName,
        file_size: file.buffer.length,
      }],
    }),
  });
  const { fileId, uploadRequest } = extractFileUploadInfo(registration);
  const signedUrl = assertHttpsUrl(uploadRequest.url, 'upload URL');
  const method = uploadRequest.method || 'PUT';
  if (method !== 'PUT') {
    throw new YouCamError('YouCam returned an unsupported upload method. Please try again.', {
      code: 'UNSUPPORTED_UPLOAD_METHOD', httpStatus: 502,
    });
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(uploadRequest.headers || {})) {
    const lowerName = name.toLowerCase();
    if (['authorization', 'cookie', 'host', 'connection'].includes(lowerName)) continue;
    if (typeof value === 'string' || typeof value === 'number') headers.set(name, String(value));
  }
  if (!headers.has('content-type')) headers.set('Content-Type', file.verifiedMime);
  if (!headers.has('content-length')) headers.set('Content-Length', String(file.buffer.length));

  let uploadResponse;
  try {
    uploadResponse = await fetch(signedUrl.href, {
      method,
      headers,
      body: file.buffer,
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new YouCamError('The image upload timed out. Check your connection and try again.', {
        code: 'FILE_UPLOAD_TIMEOUT', httpStatus: 504,
      });
    }
    throw new YouCamError('Could not upload an image to the secure file store. Please retry.', {
      code: 'FILE_UPLOAD_NETWORK_ERROR', httpStatus: 502,
    });
  }
  if (!uploadResponse.ok) {
    throw new YouCamError(`The secure image upload failed (HTTP ${uploadResponse.status}). Retry with a JPG or PNG under 10 MB.`, {
      code: 'FILE_UPLOAD_FAILED', httpStatus: 502, upstreamStatus: uploadResponse.status,
    });
  }
  return fileId;
}

async function processJob(job, imageFiles, options) {
  const apiKey = getApiKey();
  try {
    updateJob(job, { status: 'uploading', step: 'Uploading your two images…', progress: 10 });
    const [srcFileId, refFileId] = await Promise.all([
      registerAndUploadImage(imageFiles.userImage, 'person', apiKey),
      registerAndUploadImage(imageFiles.productImage, 'garment', apiKey),
    ]);

    const isEarring = options.tryonType === 'earring';
    updateJob(job, {
      status: 'creating',
      step: isEarring ? 'Creating the earring try-on task…' : 'Creating the try-on task…',
      progress: 30,
    });

    let taskEndpoint;
    let taskBody;
    let statusUrl;

    if (isEarring) {
      taskEndpoint = apiUrl('/s2s/v2.0/task/2d-vto/earring');
      taskBody = {
        src_file_id: srcFileId,
        ref_file_ids: [refFileId],
        source_info: { name: srcFileId },
        object_infos: [{ name: refFileId }],
      };
      statusUrl = (tid) => apiUrl(`/s2s/v2.0/task/2d-vto/earring/${encodeURIComponent(tid)}`);
    } else {
      taskEndpoint = apiUrl('/s2s/v2.0/task/cloth-v4');
      taskBody = {
        src_file_id: srcFileId,
        ref_file_id: refFileId,
        garment_category: options.garmentCategory,
        filter_multi_person: options.filterMultiPerson,
        change_shoes: options.changeShoes,
      };
      statusUrl = (tid) => apiUrl(`/s2s/v2.0/task/cloth-v4/${encodeURIComponent(tid)}`);
    }

    const taskPayload = await requestJson(taskEndpoint, {
      method: 'POST',
      headers: jsonApiHeaders(apiKey),
      body: JSON.stringify(taskBody),
    }, 45000);
    const taskId = extractTaskId(taskPayload);
    updateJob(job, {
      status: 'processing',
      step: isEarring ? 'AI earring placement is processing…' : 'AI try-on is processing…',
      progress: 42,
      taskId,
    });

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      let taskStatus;
      try {
        taskStatus = await requestJson(statusUrl(taskId), {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        }, 30000);
      } catch (pollErr) {
        if (pollErr && (pollErr.code === 'UPSTREAM_NETWORK_ERROR' || pollErr.code === 'UPSTREAM_TIMEOUT') && attempt < MAX_POLL_ATTEMPTS - 1) {
          console.warn('[aura-vto] transient poll error, retrying attempt', attempt + 1);
          continue;
        }
        throw pollErr;
      }
      const result = parseTaskResult(taskStatus);
      if (result.status === 'success') {
        if (!result.resultUrl) {
          throw new YouCamError('The try-on task finished, but YouCam did not return a result image URL. Please retry.', {
            code: 'MISSING_RESULT_URL', httpStatus: 502,
          });
        }
        const resultUrl = assertHttpsUrl(result.resultUrl, 'result URL').href;
        updateJob(job, {
          status: 'success', step: 'Your preview is ready.', progress: 100,
          resultUrl, completedAt: Date.now(),
        });
        return;
      }
      const progress = Math.min(92, 44 + attempt * 0.8);
      updateJob(job, {
        status: 'processing',
        step: 'AI try-on is processing…',
        progress,
        upstreamStatus: result.upstreamStatus,
      });
    }
    throw new YouCamError('The try-on is taking longer than expected. Check your API console before retrying, as the task may still be processing.', {
      code: 'TASK_POLL_TIMEOUT', httpStatus: 504,
    });
  } catch (error) {
    const message = error instanceof YouCamError || error instanceof Error
      ? error.message
      : 'The try-on request failed unexpectedly. Please try again.';
    updateJob(job, {
      status: 'error', step: 'The request did not finish.', progress: 0,
      error: message, completedAt: Date.now(),
    });
    // Do not log error messages or request objects; upstream errors can contain signed URLs.
    console.error('[aura-vto] job failed', { code: error && error.code ? error.code : error && error.name ? error.name : 'UNKNOWN' });
  }
}

function requireApiKey(req, res, next) {
  if (!getApiKey()) {
    return res.status(503).json({
      message: 'The server has no YouCam API key configured. Add YOUCAM_API_KEY to the private .env file and restart the demo.',
      code: 'API_KEY_NOT_CONFIGURED',
    });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aura-vto-demo', apiConfigured: Boolean(getApiKey()) });
});

app.get('/api/config', (req, res) => {
  // Intentionally return only whether a key exists, never the key itself.
  res.json({ apiConfigured: Boolean(getApiKey()) });
});

app.post('/api/tryon', requireApiKey, (req, res, next) => {
  upload.fields([
    { name: 'userImage', maxCount: 1 },
    { name: 'productImage', maxCount: 1 },
  ])(req, res, (error) => {
    if (error) return next(error);
    try {
      const imageFiles = validateFiles(req.files);
      const options = validateOptions(req.body || {});
      const id = crypto.randomUUID();
      const job = {
        id,
        status: 'queued',
        step: 'Queued for upload…',
        progress: 3,
        taskId: null,
        error: null,
        resultUrl: null,
        tryonType: options.tryonType,
        garmentCategory: options.garmentCategory,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      jobs.set(id, job);
      res.status(202).json({ jobId: id, status: job.status });
      void processJob(job, imageFiles, options);
    } catch (validationError) {
      next(validationError);
    }
  });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'This try-on job was not found. It may have expired; start a new request.' });
  res.json(publicJob(job));
});

app.get('/api/jobs/:jobId/image', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'This result has expired. Start a new try-on request.' });
  if (job.status !== 'success' || !job.resultUrl) return res.status(409).json({ message: 'The result image is not ready yet.' });

  try {
    // The URL is supplied by the authenticated YouCam task response, not by the browser.
    const url = assertHttpsUrl(job.resultUrl, 'result URL');
    const resultResponse = await fetch(url.href, {
      headers: { Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!resultResponse.ok || !resultResponse.body) {
      return res.status(502).json({ message: 'The temporary result image could not be retrieved. Please run the try-on again.' });
    }
    let contentType = (resultResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      if (url.pathname.endsWith('.png')) {
        contentType = 'image/png';
      } else if (url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (contentType === 'application/octet-stream' || !contentType) {
        contentType = 'image/jpeg';
      } else {
        return res.status(502).json({ message: 'The result service returned an unexpected file type. Please retry.' });
      }
    }
    const ext = contentType === 'image/png' || url.pathname.endsWith('.png') ? 'png' : 'jpg';
    const arrayBuffer = await resultResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Content-Disposition', req.query.download === '1' ? `attachment; filename="aura-tryon-result.${ext}"` : `inline; filename="aura-tryon-result.${ext}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  } catch (error) {
    console.error('[aura-vto] result proxy failed', { code: error && error.code ? error.code : error && error.name ? error.name : 'UNKNOWN', message: error && error.message });
    if (!res.headersSent) res.status(502).json({ message: 'Could not load the generated image. Its temporary link may have expired; please try again.' });
    else res.end();
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: '0' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Each image must be under 10 MB.' });
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: 'Upload exactly one person photo and one garment image.' });
    if (error.code === 'LIMIT_PART_COUNT' || error.code === 'LIMIT_FIELD_COUNT') return res.status(400).json({ message: 'The upload form had too many fields. Refresh and try again.' });
    return res.status(400).json({ message: 'The image upload could not be read. Please choose JPG or PNG files and retry.' });
  }
  const status = Number(error.status) || (error instanceof YouCamError ? error.httpStatus : 500);
  const safeMessage = error instanceof YouCamError || status < 500
    ? error.message
    : 'Something went wrong on the demo server. Please refresh and retry.';
  if (!(error instanceof YouCamError)) console.error('[aura-vto] request failed', { code: error.code || error.name || 'UNKNOWN' });
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: safeMessage,
    code: error.code || undefined,
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aura Try-On demo ready at http://0.0.0.0:${PORT}`);
  console.log(`YouCam API key configured: ${Boolean(getApiKey())}`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to another value in .env, or stop the other server.`);
  } else {
    console.error('The Aura demo server could not start.');
  }
  process.exitCode = 1;
});

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();

module.exports = { app, jobs, validateFiles, validateOptions };
