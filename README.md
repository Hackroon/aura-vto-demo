# Aura — Virtual Try-On Demo

A small responsive demo with two vertically stacked image inputs—**your photo** and the **garment/reference image**—and a result panel on the right. It uses a same-origin Express backend to upload both images to YouCam, create an AI Clothes V4 task, poll it, and proxy the output image back to the page.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and put a **rotated** YouCam API key in `YOUCAM_API_KEY`.
3. In this folder run:
   ```sh
   npm install
   npm start
   ```
4. Open <http://localhost:3939>.

The API key stays server-side and is never returned by the configuration endpoint, written to browser storage, or logged. The app intentionally does not include the key pasted into the chat. Because that key has been exposed in chat, revoke it and use a replacement in your private `.env` file.

## API flow

- The browser posts the two selected images to `POST /api/tryon` on the same origin with `tryon_type` (`apparel` or `earring`).
- The server registers each image with the YouCam File API, uploads the bytes to the signed upload URLs, then dispatches the appropriate AI task:
  - **Apparel Try-On:** creates an AI Clothes V4 task (`/s2s/v2.0/task/cloth-v4`) using `garment_category`, `filter_multi_person`, and `change_shoes`.
  - **Earring Try-On:** creates a 2D Jewelry VTO task (`/s2s/v2.0/task/2d-vto/earring`) mapping the ear portrait and earring product.
- A background job polls the task status. The UI polls the local job endpoint (`/api/jobs/:id`) and displays real-time progress.
- When complete, the result is displayed in the right-hand preview panel through a same-origin image proxy (`/api/jobs/:id/image`) to avoid browser CORS issues with signed S3 URLs.

## Demo behavior and safeguards

- If `YOUCAM_API_KEY` is missing, the app reports that clearly and does not pretend a try-on succeeded.
- JPG/PNG only, one file per slot, max 10 MB each; the browser also checks image dimensions before enabling submission.
- Duplicate submits are blocked; network/API errors, rate limits, auth failures, malformed responses, polling timeout, and failed result-image loads have user-facing messages.
- Uploaded image bytes are held in memory only for the request and are not saved to disk. Job metadata is temporary in memory and is cleared after 30 minutes.
- No API key or raw signed upload URL is returned to the browser or logged.

## Launch shortcuts

- macOS: double-click `start-demo.command`
- Windows: double-click `start-demo.bat`

The launchers install dependencies only if `node_modules` is missing, then start the server. Open the printed local URL if the browser does not open automatically.

## Tests

```sh
npm test
```

The tests cover defensive parsing of YouCam upload/task responses. To test a live transaction, use your own valid key and images that meet YouCam's current image guidelines; live calls may consume API units.
