'use strict';

class YouCamError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'YouCamError';
    this.httpStatus = options.httpStatus || 502;
    this.code = options.code || 'YOUCAM_UPSTREAM_ERROR';
    this.upstreamStatus = options.upstreamStatus || null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function walk(value, visitor, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return undefined;
  seen.add(value);
  const result = visitor(value);
  if (result !== undefined && result !== null) return result;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = walk(child, visitor, seen);
      if (found !== undefined && found !== null) return found;
    }
  } else {
    for (const child of Object.values(value)) {
      const found = walk(child, visitor, seen);
      if (found !== undefined && found !== null) return found;
    }
  }
  return undefined;
}

function findString(payload, keys) {
  const accepted = new Set(keys.map((key) => key.toLowerCase()));
  return walk(payload, (node) => {
    if (!isObject(node)) return undefined;
    for (const [key, value] of Object.entries(node)) {
      if (accepted.has(key.toLowerCase()) && typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  });
}

function extractFileUploadInfo(payload) {
  const fileId = findString(payload, ['file_id', 'fileId']);
  const request = walk(payload, (node) => {
    if (!isObject(node) || typeof node.url !== 'string' || !node.url.trim()) return undefined;
    if (typeof node.method === 'string' || isObject(node.headers) || node.upload === true) return node;
    return undefined;
  });
  if (!fileId || !request || !request.url) {
    throw new YouCamError('YouCam returned an incomplete upload response. Retry the request; if it continues, check the API docs and account status.', {
      code: 'INVALID_UPLOAD_RESPONSE',
      httpStatus: 502,
    });
  }
  return {
    fileId,
    uploadRequest: {
      url: request.url,
      method: typeof request.method === 'string' ? request.method.toUpperCase() : 'PUT',
      headers: isObject(request.headers) ? request.headers : {},
    },
  };
}

function extractTaskId(payload) {
  const taskId = findString(payload, ['task_id', 'taskId']);
  if (!taskId) {
    throw new YouCamError('YouCam did not return a task ID. Check the API response and try again.', {
      code: 'INVALID_TASK_RESPONSE',
      httpStatus: 502,
    });
  }
  return taskId;
}

function getTaskStatus(payload) {
  const directStatus = findString(payload, ['task_status', 'taskStatus', 'task_state', 'taskState', 'state']);
  if (directStatus) return directStatus.toLowerCase();
  const genericStatus = walk(payload, (node) => {
    if (!isObject(node)) return undefined;
    for (const [key, value] of Object.entries(node)) {
      if (key.toLowerCase() === 'status' && typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
    }
    return undefined;
  });
  return genericStatus || 'running';
}

function findResultUrl(payload) {
  const resultUrl = walk(payload, (node) => {
    if (!isObject(node)) return undefined;
    for (const key of ['result_url', 'output_url', 'image_url']) {
      if (typeof node[key] === 'string' && node[key].trim()) return node[key].trim();
    }
    if (typeof node.url === 'string' && node.url.trim()) return node.url.trim();
    return undefined;
  });
  return resultUrl || null;
}

function extractErrorDetails(payload) {
  if (!isObject(payload)) return { code: null, message: '' };
  let code = findString(payload, ['error_code', 'code']);
  let message = '';
  const errorValue = walk(payload, (node) => {
    if (!isObject(node) || !Object.prototype.hasOwnProperty.call(node, 'error')) return undefined;
    const value = node.error;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (isObject(value)) {
      const nestedMessage = value.message || value.error_message || value.detail;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage.trim();
    }
    return undefined;
  });
  if (typeof errorValue === 'string') message = errorValue;
  if (!message) message = findString(payload, ['error_message', 'message', 'detail']) || '';
  if (!code) code = findString(payload, ['error_code']);
  return { code, message: message.slice(0, 500) };
}

function makeUserFacingError(statusCode, payload) {
  const details = extractErrorDetails(payload);
  const code = details.code || '';
  let message;
  if (statusCode === 401 || statusCode === 403 || /InvalidAccessToken|Unauthorized/i.test(code)) {
    message = 'YouCam rejected the API key. Confirm that the server-side key is active and has access to AI Clothes V4.';
  } else if (statusCode === 429 || /rate.?limit|quota/i.test(code)) {
    message = 'The YouCam API is rate-limiting requests or the account has reached its current quota. Wait a little and try again.';
  } else if (statusCode === 413 || /filesize|file_size/i.test(code)) {
    message = 'One of the images is too large for the API. Use a JPG or PNG under 10 MB.';
  } else if (statusCode >= 500) {
    message = 'The YouCam service had a temporary problem. Please wait a moment and try again.';
  } else if (statusCode === 400) {
    message = details.message
      ? `YouCam could not process this request: ${details.message}`
      : 'YouCam rejected the request. Check that both images are valid and meet the try-on photo guidelines.';
  } else {
    message = details.message ? `YouCam returned an error: ${details.message}` : 'The YouCam request did not complete. Please try again.';
  }
  return new YouCamError(message, {
    httpStatus: statusCode >= 400 && statusCode < 600 ? statusCode : 502,
    upstreamStatus: statusCode,
    code: code || 'YOUCAM_UPSTREAM_ERROR',
  });
}

async function requestJson(url, options = {}, timeoutMs = 30000) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new YouCamError('The YouCam API took too long to respond. Please retry in a moment.', {
        code: 'UPSTREAM_TIMEOUT', httpStatus: 504,
      });
    }
    throw new YouCamError('Could not connect to the YouCam API. Check the server connection and try again.', {
      code: 'UPSTREAM_NETWORK_ERROR', httpStatus: 502,
    });
  }

  const text = await response.text().catch(() => '');
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { message: text.slice(0, 500) }; }
  }
  const bodyStatus = Number(isObject(payload) ? payload.status : NaN);
  const effectiveStatus = !response.ok ? response.status : (Number.isFinite(bodyStatus) && bodyStatus >= 400 ? bodyStatus : 0);
  if (effectiveStatus) throw makeUserFacingError(effectiveStatus, payload);
  if (!response.ok) throw makeUserFacingError(response.status, payload);
  return payload;
}

function assertHttpsUrl(value, label = 'URL') {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new YouCamError(`YouCam returned an invalid ${label}.`, { code: 'INVALID_UPSTREAM_URL', httpStatus: 502 }); }
  if (parsed.protocol !== 'https:') {
    throw new YouCamError(`YouCam returned a non-secure ${label}; the request was blocked.`, { code: 'INSECURE_UPSTREAM_URL', httpStatus: 502 });
  }
  return parsed;
}

function parseTaskResult(payload) {
  const status = getTaskStatus(payload);
  const resultUrl = findResultUrl(payload);
  const error = extractErrorDetails(payload);
  if (['error', 'failed', 'failure', 'canceled', 'cancelled'].includes(status)) {
    const message = error.message || error.code || 'The YouCam task failed. Check the images and try again.';
    throw makeUserFacingError(400, { error: message, error_code: error.code });
  }
  if (resultUrl || ['success', 'succeeded', 'completed', 'complete', 'done'].includes(status)) {
    return { status: 'success', resultUrl, upstreamStatus: status };
  }
  return { status: 'running', resultUrl: null, upstreamStatus: status };
}

module.exports = {
  YouCamError,
  assertHttpsUrl,
  extractErrorDetails,
  extractFileUploadInfo,
  extractTaskId,
  findResultUrl,
  makeUserFacingError,
  parseTaskResult,
  requestJson,
};
