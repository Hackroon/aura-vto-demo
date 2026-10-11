'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  YouCamError,
  assertHttpsUrl,
  extractFileUploadInfo,
  extractTaskId,
  makeUserFacingError,
  parseTaskResult,
} = require('../lib/youcam');

test('extracts a file ID and signed upload request from the documented response', () => {
  const result = extractFileUploadInfo({
    status: 200,
    data: {
      files: [{
        file_id: 'file/abc',
        requests: [{ method: 'PUT', url: 'https://uploads.example/signed', headers: { 'Content-Type': 'image/png' } }],
      }],
    },
  });
  assert.equal(result.fileId, 'file/abc');
  assert.equal(result.uploadRequest.method, 'PUT');
  assert.equal(result.uploadRequest.url, 'https://uploads.example/signed');
});

test('extracts upload information when it is nested under a different response wrapper', () => {
  const result = extractFileUploadInfo({
    result: {
      file_id: 'file-2',
      request: { method: 'put', url: 'https://uploads.example/second', headers: {} },
    },
  });
  assert.equal(result.fileId, 'file-2');
  assert.equal(result.uploadRequest.method, 'PUT');
});

test('rejects an upload response missing a signed URL', () => {
  assert.throws(() => extractFileUploadInfo({ data: { file_id: 'file-3' } }), YouCamError);
});

test('extracts a task ID defensively', () => {
  assert.equal(extractTaskId({ data: { task_id: 'task-123' } }), 'task-123');
  assert.throws(() => extractTaskId({ data: {} }), YouCamError);
});

test('parses running and successful task responses', () => {
  assert.deepEqual(parseTaskResult({ data: { task_status: 'running' } }), {
    status: 'running', resultUrl: null, upstreamStatus: 'running',
  });
  assert.deepEqual(parseTaskResult({ data: { task_status: 'success', results: { url: 'https://result.example/image.jpg' } } }), {
    status: 'success', resultUrl: 'https://result.example/image.jpg', upstreamStatus: 'success',
  });
});

test('treats a result URL as success if the API omits an explicit task status', () => {
  assert.deepEqual(parseTaskResult({ data: { results: { url: 'https://result.example/image.jpg' } } }), {
    status: 'success', resultUrl: 'https://result.example/image.jpg', upstreamStatus: 'running',
  });
});

test('turns failed task statuses into safe errors', () => {
  assert.throws(() => parseTaskResult({ data: { task_status: 'error', error: { message: 'invalid reference image' } } }), /invalid reference image/i);
});

test('maps an invalid API key to an actionable message', () => {
  const error = makeUserFacingError(401, { error: 'Unauthorized', error_code: 'InvalidAccessToken' });
  assert.match(error.message, /API key/i);
  assert.equal(error.httpStatus, 401);
});

test('only accepts HTTPS URLs returned by the API', () => {
  assert.equal(assertHttpsUrl('https://files.example/image.png').hostname, 'files.example');
  assert.throws(() => assertHttpsUrl('http://files.example/image.png'), /non-secure/i);
});
