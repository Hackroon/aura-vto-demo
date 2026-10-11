(() => {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_SIDE = 4096;
  const MIN_LONG_SIDE = 512;
  const MIN_SHORT_SIDE = 384;
  const state = {
    mode: 'apparel',
    files: { user: null, product: null },
    previewUrls: { user: null, product: null },
    validationRun: { user: 0, product: 0 },
    apiConfigured: false,
    busy: false,
    jobId: null,
    pollStopped: false,
  };

  const byId = (id) => document.getElementById(id);
  const els = {
    modeApparel: byId('modeApparel'),
    modeEarring: byId('modeEarring'),
    userSlotTitle: byId('userSlotTitle'),
    userSlotDesc: byId('userSlotDesc'),
    userSlotTag: byId('userSlotTag'),
    userEmptyTitle: byId('userEmptyTitle'),
    userTip: byId('userTip'),
    productSlotTitle: byId('productSlotTitle'),
    productSlotDesc: byId('productSlotDesc'),
    productSlotTag: byId('productSlotTag'),
    productEmptyTitle: byId('productEmptyTitle'),
    productTip: byId('productTip'),
    apparelSettingsGroup: byId('apparelSettingsGroup'),
    earringSettingsGroup: byId('earringSettingsGroup'),
    settingsTitle: byId('settingsTitle'),
    apiStatus: byId('apiStatus'),
    runButton: byId('runButton'),
    runButtonLabel: byId('runButtonLabel'),
    submitError: byId('submitError'),
    globalError: byId('globalError'),
    resultEmpty: byId('resultEmpty'),
    processingState: byId('processingState'),
    resultError: byId('resultError'),
    resultSuccess: byId('resultSuccess'),
    resultErrorText: byId('resultErrorText'),
    processingTitle: byId('processingTitle'),
    processingCopy: byId('processingCopy'),
    progressBar: byId('progressBar'),
    progressLabel: byId('progressLabel'),
    progressPercent: byId('progressPercent'),
    resultState: byId('resultState'),
    resultImage: byId('resultImage'),
    downloadResult: byId('downloadResult'),
    successMeta: byId('successMeta'),
    resultDetails: byId('resultDetails'),
    taskIdValue: byId('taskIdValue'),
    categoryValue: byId('categoryValue'),
    requestLog: byId('requestLog'),
  };

  const slots = {
    user: {
      zone: byId('userDropzone'), input: byId('userInput'), empty: byId('userEmpty'),
      preview: byId('userPreview'), image: byId('userPreviewImage'),
      name: byId('userFileName'), size: byId('userFileSize'), validation: byId('userValidation'),
      label: 'person photo',
    },
    product: {
      zone: byId('productDropzone'), input: byId('productInput'), empty: byId('productEmpty'),
      preview: byId('productPreview'), image: byId('productPreviewImage'),
      name: byId('productFileName'), size: byId('productFileSize'), validation: byId('productValidation'),
      label: 'garment image',
    },
  };

  function setApiPill(mode, text) {
    els.apiStatus.classList.remove('is-online', 'is-offline');
    if (mode === 'online') els.apiStatus.classList.add('is-online');
    if (mode === 'offline') els.apiStatus.classList.add('is-offline');
    const textNode = els.apiStatus.querySelector('span:last-child');
    if (textNode) textNode.textContent = text;
  }

  async function checkApiConfig() {
    try {
      const response = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || 'The local service is unavailable.');
      state.apiConfigured = Boolean(data.apiConfigured);
      setApiPill(state.apiConfigured ? 'online' : 'offline', state.apiConfigured ? 'API ready' : 'API key needed');
      if (!state.apiConfigured) {
        els.requestLog.textContent = 'The page is connected to the local server. Add YOUCAM_API_KEY to the server-side .env file to enable live requests.';
      }
    } catch (error) {
      state.apiConfigured = false;
      setApiPill('offline', 'Server unavailable');
      showGlobalError('Could not reach the local demo server. Refresh the page, or restart the server at http://localhost:3939.');
    }
    updateButton();
  }

  function showGlobalError(message) {
    els.globalError.textContent = message;
    els.globalError.hidden = !message;
  }

  function setLog(lines) {
    els.requestLog.textContent = Array.isArray(lines) ? lines.join('\n') : String(lines || '');
  }

  function setResultMode(mode) {
    els.resultEmpty.hidden = mode !== 'empty';
    els.processingState.hidden = mode !== 'processing';
    els.resultError.hidden = mode !== 'error';
    els.resultSuccess.hidden = mode !== 'success';
    els.resultDetails.hidden = mode !== 'success';
    els.resultState.classList.remove('is-working', 'is-done', 'is-error');
    const label = els.resultState.querySelector('span:last-child');
    if (mode === 'processing') {
      els.resultState.classList.add('is-working');
      if (label) label.textContent = 'PROCESSING';
    } else if (mode === 'success') {
      els.resultState.classList.add('is-done');
      if (label) label.textContent = 'PREVIEW READY';
    } else if (mode === 'error') {
      els.resultState.classList.add('is-error');
      if (label) label.textContent = 'NEEDS ATTENTION';
    } else if (label) {
      label.textContent = 'READY WHEN YOU ARE';
    }
  }

  function setStudioMode(mode) {
    state.mode = mode;
    if (els.modeApparel) els.modeApparel.classList.toggle('is-active', mode === 'apparel');
    if (els.modeEarring) els.modeEarring.classList.toggle('is-active', mode === 'earring');

    if (mode === 'earring') {
      if (els.userSlotTitle) els.userSlotTitle.textContent = 'User Face-with-Ear photo';
      if (els.userSlotDesc) els.userSlotDesc.textContent = 'Clear portrait showing face and ear';
      if (els.userSlotTag) els.userSlotTag.textContent = 'FACE + EAR';
      if (els.userEmptyTitle) els.userEmptyTitle.textContent = 'Drop face-with-ear photo here';
      if (els.userTip) els.userTip.innerHTML = '<span class="tip-spark">✦</span> Clear portrait with ear clearly visible (hair tucked or 3-quarter view) works best.';

      if (els.productSlotTitle) els.productSlotTitle.textContent = 'Earring image';
      if (els.productSlotDesc) els.productSlotDesc.textContent = 'The earring item to try on';
      if (els.productSlotTag) els.productSlotTag.textContent = 'EARRING';
      if (els.productEmptyTitle) els.productEmptyTitle.textContent = 'Drop earring product image here';
      if (els.productTip) els.productTip.innerHTML = '<span class="tip-spark">✦</span> Clean product image of single or pair on plain/white background.';

      if (els.apparelSettingsGroup) els.apparelSettingsGroup.hidden = true;
      if (els.earringSettingsGroup) els.earringSettingsGroup.hidden = false;
      if (els.settingsTitle) els.settingsTitle.textContent = 'Earring VTO settings';
    } else {
      if (els.userSlotTitle) els.userSlotTitle.textContent = 'User image';
      if (els.userSlotDesc) els.userSlotDesc.textContent = 'The person wearing the look';
      if (els.userSlotTag) els.userSlotTag.textContent = 'PERSON';
      if (els.userEmptyTitle) els.userEmptyTitle.textContent = 'Drop your photo here';
      if (els.userTip) els.userTip.innerHTML = '<span class="tip-spark">✦</span> A clear, front-facing photo with one person works best.';

      if (els.productSlotTitle) els.productSlotTitle.textContent = 'Object image';
      if (els.productSlotDesc) els.productSlotDesc.textContent = 'The clothing item you want to try on';
      if (els.productSlotTag) els.productSlotTag.textContent = 'OBJECT';
      if (els.productEmptyTitle) els.productEmptyTitle.textContent = 'Drop an object image here';
      if (els.productTip) els.productTip.innerHTML = '<span class="tip-spark">✦</span> Use a front-facing image of one garment, not a collage.';

      if (els.apparelSettingsGroup) els.apparelSettingsGroup.hidden = false;
      if (els.earringSettingsGroup) els.earringSettingsGroup.hidden = true;
      if (els.settingsTitle) els.settingsTitle.textContent = 'Try-on settings';
    }
  }

  async function loadPreset(presetKey) {
    if (state.busy) return;
    try {
      showSubmitError('');
      if (presetKey === 'earring_gold') {
        setStudioMode('earring');
        const [uBlob, pBlob] = await Promise.all([
          fetch('/samples/user_face_with_ear.jpg').then((r) => r.blob()),
          fetch('/samples/product_earring.jpg').then((r) => r.blob()),
        ]);
        const userFile = new File([uBlob], 'user_face_with_ear.jpg', { type: 'image/jpeg' });
        const prodFile = new File([pBlob], 'product_earring.jpg', { type: 'image/jpeg' });
        await validateAndSet('user', userFile);
        await validateAndSet('product', prodFile);
      } else if (presetKey === 'apparel_sweater') {
        setStudioMode('apparel');
        byId('garmentCategory').value = 'upper_body';
        const [uBlob, pBlob] = await Promise.all([
          fetch('/samples/user1_female.jpg').then((r) => r.blob()),
          fetch('/samples/garment_red_sweater.jpg').then((r) => r.blob()),
        ]);
        const userFile = new File([uBlob], 'user1_female.jpg', { type: 'image/jpeg' });
        const prodFile = new File([pBlob], 'garment_red_sweater.jpg', { type: 'image/jpeg' });
        await validateAndSet('user', userFile);
        await validateAndSet('product', prodFile);
      } else if (presetKey === 'apparel_denim') {
        setStudioMode('apparel');
        byId('garmentCategory').value = 'outer';
        const [uBlob, pBlob] = await Promise.all([
          fetch('/samples/user2_male.jpg').then((r) => r.blob()),
          fetch('/samples/garment_denim_jacket.jpg').then((r) => r.blob()),
        ]);
        const userFile = new File([uBlob], 'user2_male.jpg', { type: 'image/jpeg' });
        const prodFile = new File([pBlob], 'garment_denim_jacket.jpg', { type: 'image/jpeg' });
        await validateAndSet('user', userFile);
        await validateAndSet('product', prodFile);
      }
    } catch (err) {
      showSubmitError('Could not load preset sample images. You can choose your own files.');
    }
  }

  function setProgress(progress, label, title, copy) {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));
    els.progressBar.style.width = `${value}%`;
    els.progressPercent.textContent = `${Math.round(value)}%`;
    els.progressLabel.textContent = label || 'Working…';
    if (title) els.processingTitle.textContent = title;
    if (copy) els.processingCopy.textContent = copy;
  }

  function updateButton() {
    const canRun = Boolean(state.files.user && state.files.product && !state.busy);
    els.runButton.disabled = !canRun;
    els.runButtonLabel.textContent = state.busy ? 'Creating your preview…' : 'Generate try-on';
    for (const slot of Object.values(slots)) {
      slot.zone.setAttribute('aria-disabled', String(state.busy));
      slot.zone.tabIndex = state.busy ? -1 : 0;
      slot.zone.classList.toggle('is-disabled', state.busy);
      const removeButton = slot.zone.querySelector('.remove-button');
      if (removeButton) removeButton.disabled = state.busy;
    }
    for (const id of ['garmentCategory', 'multiFilter', 'changeShoes', 'resetSettings']) {
      byId(id).disabled = state.busy;
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function matchesImageType(file) {
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    return mime === 'image/jpeg' || mime === 'image/png' || /\.(jpe?g|png)$/.test(name);
  }

  async function getImageDimensions(file) {
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      if (typeof bitmap.close === 'function') bitmap.close();
      return dimensions;
    }
    return new Promise((resolve, reject) => {
      const tempUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(tempUrl);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        reject(new Error('This image could not be opened. Try a different JPG or PNG.'));
      };
      image.src = tempUrl;
    });
  }

  async function validateAndSet(slotName, file) {
    const slot = slots[slotName];
    const run = ++state.validationRun[slotName];
    slot.validation.textContent = '';
    if (!file) return;

    clearFile(slotName, false, false);
    if (!matchesImageType(file)) {
      slot.validation.textContent = 'Please choose a JPG or PNG image.';
      updateButton();
      return;
    }
    if (file.size === 0) {
      slot.validation.textContent = 'This file is empty. Please choose another image.';
      updateButton();
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      slot.validation.textContent = 'This image is over the 10 MB limit. Choose a smaller file.';
      updateButton();
      return;
    }

    slot.validation.textContent = 'Checking image…';
    try {
      const { width, height } = await getImageDimensions(file);
      if (run !== state.validationRun[slotName]) return;
      const longSide = Math.max(width, height);
      const shortSide = Math.min(width, height);
      if (longSide > MAX_SIDE) {
        slot.validation.textContent = 'The longest side must be 4096 px or less. Resize the image and try again.';
        updateButton();
        return;
      }
      if (longSide < MIN_LONG_SIDE || shortSide < MIN_SHORT_SIDE) {
        slot.validation.textContent = 'Use an image at least 512 × 384 px (portrait or landscape is fine).';
        updateButton();
        return;
      }

      state.files[slotName] = file;
      const previewUrl = URL.createObjectURL(file);
      state.previewUrls[slotName] = previewUrl;
      slot.image.src = previewUrl;
      slot.name.textContent = file.name || (slotName === 'user' ? 'Person photo' : 'Garment image');
      slot.size.textContent = `${width} × ${height} px · ${formatBytes(file.size)}`;
      slot.empty.hidden = true;
      slot.preview.hidden = false;
      slot.validation.textContent = '';
    } catch (error) {
      if (run === state.validationRun[slotName]) {
        slot.validation.textContent = error && error.message ? error.message : 'Could not read this image. Please choose another file.';
      }
    }
    updateButton();
  }

  function clearFile(slotName, clearMessage = true, bumpValidation = true) {
    const slot = slots[slotName];
    if (bumpValidation) state.validationRun[slotName] += 1;
    state.files[slotName] = null;
    if (state.previewUrls[slotName]) URL.revokeObjectURL(state.previewUrls[slotName]);
    state.previewUrls[slotName] = null;
    slot.image.removeAttribute('src');
    slot.preview.hidden = true;
    slot.empty.hidden = false;
    if (clearMessage) slot.validation.textContent = '';
    if (slot.input) slot.input.value = '';
    updateButton();
  }

  function configureDropzone(slotName) {
    const slot = slots[slotName];
    // A single click handler opens the hidden picker. The dropzone is not a label,
    // so native label forwarding cannot accidentally open the picker a second time.
    slot.zone.addEventListener('click', (event) => {
      if (event.target.closest('button') || event.target === slot.input) return;
      slot.input.click();
    });
    slot.zone.addEventListener('keydown', (event) => {
      if (event.target.closest('button')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        slot.input.click();
      }
    });
    slot.input.addEventListener('change', () => {
      const file = slot.input.files && slot.input.files[0];
      if (file) validateAndSet(slotName, file);
      // Clear the native value so choosing the same file again still fires `change`.
      slot.input.value = '';
    });
    slot.zone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      slot.zone.classList.add('is-dragging');
    });
    slot.zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    slot.zone.addEventListener('dragleave', (event) => {
      if (!slot.zone.contains(event.relatedTarget)) slot.zone.classList.remove('is-dragging');
    });
    slot.zone.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.zone.classList.remove('is-dragging');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) validateAndSet(slotName, file);
    });
  }

  async function readJson(response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); }
    catch { return { message: text.slice(0, 300) || 'Unexpected response from the server.' }; }
  }

  function showSubmitError(message) {
    els.submitError.textContent = message || '';
    els.submitError.hidden = !message;
  }

  function categoryLabel(value) {
    return ({ auto: 'Auto-detect', upper_body: 'Upper body', lower_body: 'Lower body', full_body: 'Full body', outer: 'Outerwear', shoes: 'Shoes' })[value] || 'Auto-detect';
  }

  async function startTryOn() {
    if (state.busy) return;
    showSubmitError('');
    if (!state.files.user || !state.files.product) {
      showSubmitError('Add both a person photo and a garment image before starting.');
      return;
    }
    if (!state.apiConfigured) {
      showSubmitError('The API key is not configured on the server yet. Add YOUCAM_API_KEY to the private .env file, then restart the demo.');
      setResultMode('error');
      els.resultErrorText.textContent = 'Live processing is disabled until a server-side YouCam API key is configured.';
      setLog('No request was sent. Add YOUCAM_API_KEY to the server-side .env file and restart the app.');
      return;
    }

    state.busy = true;
    state.pollStopped = false;
    state.jobId = null;
    updateButton();
    setResultMode('processing');
    const isEarring = state.mode === 'earring';
    setLog([
      'POST /api/tryon',
      isEarring ? 'Studio mode: Earring Virtual Try-On' : 'Studio mode: Apparel Try-On',
      'Registering and uploading two images to YouCam…',
      !isEarring ? `Garment category: ${categoryLabel(byId('garmentCategory').value)}` : 'Category: Earring Jewelry (Auto Placement)',
    ]);

    try {
      const formData = new FormData();
      formData.append('userImage', state.files.user, state.files.user.name || (isEarring ? 'face-ear.jpg' : 'person-image.jpg'));
      formData.append('productImage', state.files.product, state.files.product.name || (isEarring ? 'earring.jpg' : 'garment-image.jpg'));
      formData.append('tryon_type', state.mode || 'apparel');
      formData.append('garment_category', byId('garmentCategory').value);
      formData.append('filter_multi_person', byId('multiFilter').value);
      formData.append('change_shoes', String(byId('changeShoes').checked));

      const response = await fetch('/api/tryon', { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || 'The request could not be started.');
      if (!data.jobId) throw new Error('The server did not return a job ID. Please retry.');
      state.jobId = data.jobId;
      setLog([`Local job: ${data.jobId}`, 'YouCam file upload initialized…', 'Waiting for processing status…']);
      await pollJob(data.jobId);
    } catch (error) {
      const message = error && error.message ? error.message : 'A network error interrupted the request. Check your connection and try again.';
      showSubmitError(message);
      showResultError(message);
    } finally {
      state.busy = false;
      updateButton();
    }
  }

  async function pollJob(jobId) {
    let transientFailures = 0;
    while (!state.pollStopped) {
      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          headers: { Accept: 'application/json' }, cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || 'Could not read the try-on status.');
        transientFailures = 0;
        const pct = Number(data.progress) || 0;
        setProgress(pct, data.step || 'Working…', 'Creating your preview…', 'The AI is preparing your result. This may take a few minutes.');
        setLog([
          `Local job: ${jobId}`,
          `Stage: ${data.step || data.status}`,
          `Progress: ${Math.round(pct)}%`,
          data.taskId ? `YouCam task: ${data.taskId}` : 'YouCam task: creating…',
        ]);

        if (data.status === 'success') {
          showSuccess(data);
          return;
        }
        if (data.status === 'error') throw new Error(data.error || 'The try-on task failed. Please check the images and retry.');
        await delay(1300);
      } catch (error) {
        if (error && error.name === 'AbortError' || error && error.name === 'TimeoutError') {
          transientFailures += 1;
          if (transientFailures <= 4) {
            setProgress(45, 'Reconnecting…', 'Checking the task status…', 'The connection paused briefly. We’re retrying the status check.');
            await delay(1200 * transientFailures);
            continue;
          }
        }
        if (transientFailures > 0 && transientFailures <= 4) continue;
        throw error;
      }
    }
  }

  function showSuccess(data) {
    state.busy = false;
    setResultMode('success');
    const imagePath = data.resultImage || `/api/jobs/${encodeURIComponent(data.jobId || state.jobId)}/image`;
    const freshImagePath = `${imagePath}${imagePath.includes('?') ? '&' : '?'}v=${Date.now()}`;
    els.resultImage.onload = () => {
      els.resultImage.onload = null;
      els.resultImage.onerror = null;
    };
    els.resultImage.onerror = () => {
      els.resultImage.onload = null;
      els.resultImage.onerror = null;
      showResultError('The task finished, but the result image could not be loaded. Its temporary download link may have expired. Please run the try-on again.');
    };
    els.resultImage.src = freshImagePath;
    els.downloadResult.href = `/api/jobs/${encodeURIComponent(data.jobId || state.jobId)}/image?download=1`;
    els.successMeta.textContent = `Ready · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    els.taskIdValue.textContent = data.taskId || '—';
    const displayCategory = (data.tryonType === 'earring' || state.mode === 'earring')
      ? 'Earring Virtual Try-On'
      : categoryLabel(data.garmentCategory || byId('garmentCategory').value);
    els.categoryValue.textContent = displayCategory;
    setLog([
      'Status: success',
      `YouCam task: ${data.taskId || '—'}`,
      `Category: ${displayCategory}`,
      'Result image is served through the same-origin local proxy.',
    ]);
  }

  function showResultError(message) {
    state.busy = false;
    setResultMode('error');
    els.resultErrorText.textContent = message;
    setLog(`Request error: ${message}`);
    updateButton();
  }

  function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  function clearAll() {
    if (state.busy) return;
    clearFile('user');
    clearFile('product');
    showSubmitError('');
    setResultMode('empty');
    els.resultImage.removeAttribute('src');
    els.resultDetails.hidden = true;
    setLog('Waiting for your images.');
  }

  configureDropzone('user');
  configureDropzone('product');

  document.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearFile(button.dataset.remove);
      showSubmitError('');
    });
  });

  if (els.modeApparel) {
    els.modeApparel.addEventListener('click', () => setStudioMode('apparel'));
  }
  if (els.modeEarring) {
    els.modeEarring.addEventListener('click', () => setStudioMode('earring'));
  }

  document.querySelectorAll('.preset-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const presetKey = pill.dataset.preset;
      if (presetKey) loadPreset(presetKey);
    });
  });

  byId('runButton').addEventListener('click', startTryOn);
  byId('retryButton').addEventListener('click', () => {
    if (state.files.user && state.files.product) startTryOn();
    else {
      setResultMode('empty');
      showSubmitError('Add both images to try again.');
    }
  });
  byId('resetSettings').addEventListener('click', () => {
    byId('garmentCategory').value = 'auto';
    byId('multiFilter').value = 'strict';
    byId('changeShoes').checked = true;
  });
  byId('cancelWait').addEventListener('click', () => {
    // This only stops this page from polling; the upstream API does not expose task cancellation.
    // Be explicit instead of implying the already-submitted API task was cancelled.
    state.pollStopped = true;
    state.busy = false;
    updateButton();
    setResultMode('error');
    els.resultErrorText.textContent = 'Stopped checking from this page. The submitted API task may still be processing; starting another try-on can use additional API units.';
    setLog(`Stopped local status polling for job ${state.jobId || '—'}. Upstream cancellation is not available.`);
  });

  window.addEventListener('online', () => {
    showGlobalError('');
    checkApiConfig();
  });
  window.addEventListener('offline', () => {
    setApiPill('offline', 'Offline');
    showGlobalError('You appear to be offline. Reconnect to the local server and retry.');
  });
  window.addEventListener('beforeunload', () => {
    for (const url of Object.values(state.previewUrls)) if (url) URL.revokeObjectURL(url);
  });

  updateButton();
  checkApiConfig();
})();
