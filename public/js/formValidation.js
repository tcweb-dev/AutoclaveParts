'use strict';

const form = document.getElementById('adForm');

function cssObjectPosition(value) {
  const map = {
    center: 'center center',
    top: 'center top',
    bottom: 'center bottom',
    left: 'left center',
    right: 'right center',
    'top-left': 'left top',
    'top-right': 'right top',
    'bottom-left': 'left bottom',
    'bottom-right': 'right bottom',
  };
  return map[value] || 'center center';
}

function objectPositionToPercent(value) {
  const map = {
    center: [50, 50],
    top: [50, 0],
    bottom: [50, 100],
    left: [0, 50],
    right: [100, 50],
    'top-left': [0, 0],
    'top-right': [100, 0],
    'bottom-left': [0, 100],
    'bottom-right': [100, 100],
  };
  return map[value] || [50, 50];
}

function captionPositionToPercent(value) {
  const map = {
    'top-left': [5, 5],
    'top-center': [30, 5],
    'top-right': [62, 5],
    'bottom-left': [5, 68],
    'bottom-center': [30, 68],
    'bottom-right': [62, 68],
  };
  return map[value] || [5, 5];
}

function percentToCaptionPosition(xPct, yPct) {
  const x = xPct < 33 ? 'left' : xPct > 66 ? 'right' : 'center';
  const y = yPct < 50 ? 'top' : 'bottom';
  return `${y}-${x}`;
}

function percentToObjectPosition(xPct, yPct) {
  const x = xPct < 33 ? 'left' : xPct > 66 ? 'right' : 'center';
  const y = yPct < 33 ? 'top' : yPct > 66 ? 'bottom' : 'center';
  if (x === 'center' && y === 'center') return 'center';
  if (x === 'center') return y;
  if (y === 'center') return x;
  return `${y}-${x}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setupLivePreview(currentForm) {
  const companyName = currentForm.querySelector('#companyName');
  const companyWebsite = currentForm.querySelector('#companyWebsite');
  const companyPhone = currentForm.querySelector('#companyPhone');
  const companyDescription = currentForm.querySelector('#companyDescription');
  const linkUrl = currentForm.querySelector('#linkUrl');
  const picture = currentForm.querySelector('#picture');
  const picture2 = currentForm.querySelector('#picture2');
  const removePicture = currentForm.querySelector('#removePicture');
  const removePicture2 = currentForm.querySelector('#removePicture2');
  const captionPosition = currentForm.querySelector('#captionPosition');
  const captionPositionXInput = currentForm.querySelector('#captionPositionX');
  const captionPositionYInput = currentForm.querySelector('#captionPositionY');
  const descriptionPositionXInput = currentForm.querySelector(
    '#descriptionPositionX',
  );
  const descriptionPositionYInput = currentForm.querySelector(
    '#descriptionPositionY',
  );
  const imagePosition = currentForm.querySelector('#imagePosition');
  const imagePositionXInput = currentForm.querySelector('#imagePositionX');
  const imagePositionYInput = currentForm.querySelector('#imagePositionY');
  const picture2PositionXInput =
    currentForm.querySelector('#picture2PositionX');
  const picture2PositionYInput =
    currentForm.querySelector('#picture2PositionY');
  const imageScale = currentForm.querySelector('#imageScale');
  const picture2Scale = currentForm.querySelector('#picture2Scale');
  const resetImageScaleBtn = currentForm.querySelector('#resetImageScale');
  const resetPicture2ScaleBtn = currentForm.querySelector(
    '#resetPicture2Scale',
  );
  const fillFrameCrop = currentForm.querySelector('#fillFrameCrop');

  const previewCompany = document.getElementById('previewCompany');
  const previewWebsite = document.getElementById('previewWebsite');
  const previewPhone = document.getElementById('previewPhone');
  const previewDescriptionBox = document.getElementById(
    'previewDescriptionBox',
  );
  const previewDescription = document.getElementById('previewDescription');
  const previewLinkState = document.getElementById('previewLinkState');
  const previewImage = document.getElementById('previewImage');
  const previewImage2 = document.getElementById('previewImage2');
  const currentSecondImageWrap = document.getElementById(
    'currentSecondImageWrap',
  );
  const currentSecondImage = document.getElementById('currentSecondImage');
  const currentSecondImageLabel = document.getElementById(
    'currentSecondImageLabel',
  );
  const previewCaption = document.getElementById('previewCaption');
  const imageScaleValue = document.getElementById('imageScaleValue');
  const picture2ScaleValue = document.getElementById('picture2ScaleValue');
  const previewCanvas = document.getElementById('livePreview');

  if (!previewCompany || !previewImage || !previewCaption) return;

  const applyCaptionXY = (xPct, yPct) => {
    const x = clamp(xPct, 0, 100);
    const y = clamp(yPct, 0, 100);
    previewCaption.style.left = `${x}%`;
    previewCaption.style.top = `${y}%`;
    previewCaption.style.right = 'auto';
    previewCaption.style.bottom = 'auto';
    previewCaption.style.transform = 'none';
    if (captionPositionXInput) captionPositionXInput.value = x.toFixed(2);
    if (captionPositionYInput) captionPositionYInput.value = y.toFixed(2);
  };

  const applyPicture2XY = (xPct, yPct) => {
    if (!previewImage2) return;
    const x = clamp(xPct, 0, 100);
    const y = clamp(yPct, 0, 100);
    previewImage2.style.left = `${x}%`;
    previewImage2.style.top = `${y}%`;
    if (picture2PositionXInput) picture2PositionXInput.value = x.toFixed(2);
    if (picture2PositionYInput) picture2PositionYInput.value = y.toFixed(2);
  };

  const applyDescriptionXY = (xPct, yPct) => {
    if (!previewDescriptionBox) return;
    const x = clamp(xPct, 0, 100);
    const y = clamp(yPct, 0, 100);
    previewDescriptionBox.style.left = `${x}%`;
    previewDescriptionBox.style.top = `${y}%`;
    if (descriptionPositionXInput)
      descriptionPositionXInput.value = x.toFixed(2);
    if (descriptionPositionYInput)
      descriptionPositionYInput.value = y.toFixed(2);
  };

  companyName?.addEventListener('input', () => {
    previewCompany.textContent =
      companyName.value.trim() || 'Your Company Name';
  });

  companyWebsite?.addEventListener('input', () => {
    previewWebsite.textContent =
      companyWebsite.value.trim() || 'Website address';
  });

  companyPhone?.addEventListener('input', () => {
    previewPhone.textContent = companyPhone.value.trim() || 'Phone number';
  });

  companyDescription?.addEventListener('input', () => {
    if (!previewDescription || !previewDescriptionBox) return;
    previewDescription.textContent = companyDescription.value.trim();
    previewDescriptionBox.style.display = companyDescription.value.trim()
      ? 'block'
      : 'none';
  });

  linkUrl?.addEventListener('input', () => {
    previewLinkState.textContent = linkUrl.value.trim()
      ? 'Image click opens your URL'
      : 'No click-through URL set yet';
  });

  captionPosition?.addEventListener('change', () => {
    const [xPct, yPct] = captionPositionToPercent(captionPosition.value);
    applyCaptionXY(xPct, yPct);
  });

  imagePosition?.addEventListener('change', () => {
    const [xPct, yPct] = objectPositionToPercent(imagePosition.value);
    previewImage.style.objectPosition = `${xPct}% ${yPct}%`;
    if (imagePositionXInput) imagePositionXInput.value = String(xPct);
    if (imagePositionYInput) imagePositionYInput.value = String(yPct);
  });

  imageScale?.addEventListener('input', () => {
    const numericScale = Number(imageScale.value) || 100;
    if (imageScaleValue) imageScaleValue.textContent = String(numericScale);
    previewImage.style.setProperty(
      '--preview-scale',
      (numericScale / 100).toFixed(2),
    );
    previewImage.style.setProperty(
      '--preview-fit',
      fillFrameCrop?.checked ? 'cover' : 'contain',
    );
  });

  picture2Scale?.addEventListener('input', () => {
    const numericScale = Number(picture2Scale.value) || 100;
    if (picture2ScaleValue)
      picture2ScaleValue.textContent = String(numericScale);
    if (previewImage2) {
      previewImage2.style.setProperty(
        '--preview-img2-scale',
        (numericScale / 100).toFixed(2),
      );
    }
  });

  resetImageScaleBtn?.addEventListener('click', () => {
    if (!imageScale) return;
    imageScale.value = '100';
    imageScale.dispatchEvent(new Event('input', { bubbles: true }));
  });

  resetPicture2ScaleBtn?.addEventListener('click', () => {
    if (!picture2Scale) return;
    picture2Scale.value = '100';
    picture2Scale.dispatchEvent(new Event('input', { bubbles: true }));
  });

  fillFrameCrop?.addEventListener('change', () => {
    previewImage.style.setProperty(
      '--preview-fit',
      fillFrameCrop.checked ? 'cover' : 'contain',
    );
  });

  const captionFontColorInput = document.getElementById('captionFontColor');
  const captionFontSizeInput = document.getElementById('captionFontSize');
  const captionFontWeightInput = document.getElementById('captionFontWeight');
  const descriptionFontColorInput = document.getElementById(
    'descriptionFontColor',
  );
  const descriptionFontSizeInput = document.getElementById(
    'descriptionFontSize',
  );
  const descriptionFontWeightInput = document.getElementById(
    'descriptionFontWeight',
  );
  const descriptionBgColorInput = document.getElementById('descriptionBgColor');
  const descriptionFontSizeVal = document.getElementById(
    'descriptionFontSizeVal',
  );
  const slideBgColorInput = document.getElementById('slideBgColor');
  const fontSizeVal = document.getElementById('fontSizeVal');

  captionFontColorInput?.addEventListener('input', () => {
    previewCaption.style.color = captionFontColorInput.value;
  });

  captionFontSizeInput?.addEventListener('input', () => {
    if (fontSizeVal) fontSizeVal.textContent = captionFontSizeInput.value;
    previewCaption.style.fontSize = captionFontSizeInput.value + 'px';
    const previewCompanyEl = previewCaption.querySelector('#previewCompany');
    const previewPhoneEl = previewCaption.querySelector('#previewPhone');
    const previewWebsiteEl = previewCaption.querySelector('#previewWebsite');
    const previewLinkStateEl =
      previewCaption.querySelector('#previewLinkState');
    if (previewCompanyEl)
      previewCompanyEl.style.fontSize = `${(Number(captionFontSizeInput.value) * 1.4).toFixed(1)}px`;
    if (previewPhoneEl)
      previewPhoneEl.style.fontSize = `${Number(captionFontSizeInput.value).toFixed(1)}px`;
    if (previewWebsiteEl)
      previewWebsiteEl.style.fontSize = `${Number(captionFontSizeInput.value).toFixed(1)}px`;
    if (previewLinkStateEl)
      previewLinkStateEl.style.fontSize = `${(Number(captionFontSizeInput.value) * 0.92).toFixed(1)}px`;
  });

  captionFontWeightInput?.addEventListener('change', () => {
    previewCaption.style.fontWeight = captionFontWeightInput.value;
  });

  descriptionFontColorInput?.addEventListener('input', () => {
    if (!previewDescriptionBox) return;
    previewDescriptionBox.style.color = descriptionFontColorInput.value;
  });

  descriptionFontSizeInput?.addEventListener('input', () => {
    if (!previewDescriptionBox) return;
    if (descriptionFontSizeVal)
      descriptionFontSizeVal.textContent = descriptionFontSizeInput.value;
    previewDescriptionBox.style.fontSize =
      descriptionFontSizeInput.value + 'px';
    if (previewDescription)
      previewDescription.style.fontSize = descriptionFontSizeInput.value + 'px';
  });

  descriptionFontWeightInput?.addEventListener('change', () => {
    if (!previewDescriptionBox) return;
    previewDescriptionBox.style.fontWeight = descriptionFontWeightInput.value;
  });

  descriptionBgColorInput?.addEventListener('input', () => {
    if (!previewDescriptionBox) return;
    previewDescriptionBox.style.backgroundColor = descriptionBgColorInput.value;
  });

  slideBgColorInput?.addEventListener('input', () => {
    if (previewCanvas)
      previewCanvas.style.backgroundColor = slideBgColorInput.value;
  });

  // Init style controls from saved values
  if (previewDescription && previewDescriptionBox) {
    previewDescriptionBox.style.display = previewDescription.textContent.trim()
      ? 'block'
      : 'none';
  }
  if (captionFontColorInput)
    previewCaption.style.color = captionFontColorInput.value;
  if (captionFontSizeInput)
    previewCaption.style.fontSize = captionFontSizeInput.value + 'px';
  if (captionFontSizeInput) {
    const previewCompanyEl = previewCaption.querySelector('#previewCompany');
    const previewPhoneEl = previewCaption.querySelector('#previewPhone');
    const previewWebsiteEl = previewCaption.querySelector('#previewWebsite');
    const previewLinkStateEl =
      previewCaption.querySelector('#previewLinkState');
    if (previewCompanyEl)
      previewCompanyEl.style.fontSize = `${(Number(captionFontSizeInput.value) * 1.4).toFixed(1)}px`;
    if (previewPhoneEl)
      previewPhoneEl.style.fontSize = `${Number(captionFontSizeInput.value).toFixed(1)}px`;
    if (previewWebsiteEl)
      previewWebsiteEl.style.fontSize = `${Number(captionFontSizeInput.value).toFixed(1)}px`;
    if (previewLinkStateEl)
      previewLinkStateEl.style.fontSize = `${(Number(captionFontSizeInput.value) * 0.92).toFixed(1)}px`;
  }
  if (captionFontWeightInput)
    previewCaption.style.fontWeight = captionFontWeightInput.value;
  if (descriptionFontColorInput && previewDescriptionBox)
    previewDescriptionBox.style.color = descriptionFontColorInput.value;
  if (descriptionFontSizeInput && previewDescriptionBox)
    previewDescriptionBox.style.fontSize =
      descriptionFontSizeInput.value + 'px';
  if (descriptionFontSizeInput && previewDescription)
    previewDescription.style.fontSize = descriptionFontSizeInput.value + 'px';
  if (descriptionFontWeightInput && previewDescriptionBox)
    previewDescriptionBox.style.fontWeight = descriptionFontWeightInput.value;
  if (descriptionBgColorInput && previewDescriptionBox)
    previewDescriptionBox.style.backgroundColor = descriptionBgColorInput.value;
  if (slideBgColorInput && previewCanvas)
    previewCanvas.style.backgroundColor = slideBgColorInput.value;

  picture?.addEventListener('change', () => {
    if (!picture.files?.length) return;
    const file = picture.files[0];
    if (!file.type.startsWith('image/')) return;
    const nextUrl = URL.createObjectURL(file);
    previewImage.src = nextUrl;
    if (removePicture) removePicture.checked = false;
    previewImage.style.opacity = '1';
  });

  picture2?.addEventListener('change', () => {
    if (!picture2.files?.length) return;
    const file = picture2.files[0];
    if (!file.type.startsWith('image/')) return;
    const nextUrl = URL.createObjectURL(file);
    if (currentSecondImageWrap && currentSecondImage) {
      currentSecondImage.src = nextUrl;
      currentSecondImageWrap.style.display = 'flex';
    }
    if (previewImage2) {
      previewImage2.src = nextUrl;
      previewImage2.style.display = 'block';
    }
    if (removePicture2) removePicture2.checked = false;
    if (currentSecondImageLabel)
      currentSecondImageLabel.textContent = 'Selected second image';
  });

  removePicture?.addEventListener('change', () => {
    if (!removePicture.checked) {
      previewImage.style.opacity = '1';
      return;
    }
    picture.value = '';
    previewImage.style.opacity = '0.25';
  });

  removePicture2?.addEventListener('change', () => {
    if (!removePicture2.checked) {
      if (previewImage2?.src) previewImage2.style.display = 'block';
      if (previewImage2) previewImage2.style.opacity = '1';
      return;
    }
    picture2.value = '';
    if (previewImage2) previewImage2.style.display = 'none';
    if (currentSecondImageWrap) currentSecondImageWrap.style.display = 'none';
  });

  const rawCaptionX = captionPositionXInput?.value?.trim();
  const rawCaptionY = captionPositionYInput?.value?.trim();
  const startingCaptionX =
    rawCaptionX !== '' && rawCaptionX != null ? Number(rawCaptionX) : NaN;
  const startingCaptionY =
    rawCaptionY !== '' && rawCaptionY != null ? Number(rawCaptionY) : NaN;
  if (Number.isFinite(startingCaptionX) && Number.isFinite(startingCaptionY)) {
    applyCaptionXY(startingCaptionX, startingCaptionY);
  } else {
    const [xPct, yPct] = captionPositionToPercent(
      captionPosition?.value || 'bottom-left',
    );
    applyCaptionXY(xPct, yPct);
  }
  const rawImgX = imagePositionXInput?.value?.trim();
  const rawImgY = imagePositionYInput?.value?.trim();
  const startingX = rawImgX !== '' && rawImgX != null ? Number(rawImgX) : NaN;
  const startingY = rawImgY !== '' && rawImgY != null ? Number(rawImgY) : NaN;
  if (Number.isFinite(startingX) && Number.isFinite(startingY)) {
    previewImage.style.objectPosition = `${clamp(startingX, 0, 100)}% ${clamp(startingY, 0, 100)}%`;
  } else {
    const [xPct, yPct] = objectPositionToPercent(
      imagePosition?.value || 'center',
    );
    previewImage.style.objectPosition = `${xPct}% ${yPct}%`;
    if (imagePositionXInput) imagePositionXInput.value = String(xPct);
    if (imagePositionYInput) imagePositionYInput.value = String(yPct);
  }
  previewImage.style.setProperty(
    '--preview-scale',
    ((Number(imageScale?.value) || 100) / 100).toFixed(2),
  );
  previewImage.style.setProperty(
    '--preview-fit',
    fillFrameCrop?.checked ? 'cover' : 'contain',
  );
  if (previewImage2) {
    previewImage2.style.setProperty(
      '--preview-img2-scale',
      ((Number(picture2Scale?.value) || 100) / 100).toFixed(2),
    );
  }

  const rawImg2X = picture2PositionXInput?.value?.trim();
  const rawImg2Y = picture2PositionYInput?.value?.trim();
  const startingImg2X =
    rawImg2X !== '' && rawImg2X != null ? Number(rawImg2X) : NaN;
  const startingImg2Y =
    rawImg2Y !== '' && rawImg2Y != null ? Number(rawImg2Y) : NaN;
  if (Number.isFinite(startingImg2X) && Number.isFinite(startingImg2Y)) {
    applyPicture2XY(startingImg2X, startingImg2Y);
  } else {
    applyPicture2XY(72, 72);
  }

  const rawDescriptionX = descriptionPositionXInput?.value?.trim();
  const rawDescriptionY = descriptionPositionYInput?.value?.trim();
  const startingDescriptionX =
    rawDescriptionX !== '' && rawDescriptionX != null
      ? Number(rawDescriptionX)
      : NaN;
  const startingDescriptionY =
    rawDescriptionY !== '' && rawDescriptionY != null
      ? Number(rawDescriptionY)
      : NaN;
  if (
    Number.isFinite(startingDescriptionX) &&
    Number.isFinite(startingDescriptionY)
  ) {
    applyDescriptionXY(startingDescriptionX, startingDescriptionY);
  } else {
    applyDescriptionXY(50, 78);
  }

  if (removePicture?.checked) {
    previewImage.style.opacity = '0.25';
  }
  if (removePicture2?.checked) {
    if (previewImage2) previewImage2.style.display = 'none';
    if (currentSecondImageWrap) currentSecondImageWrap.style.display = 'none';
  }

  // Drag caption panel to quickly choose one of the existing six caption positions.
  if (previewCanvas && previewCaption && captionPosition) {
    let draggingCaption = false;

    previewCaption.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      draggingCaption = true;
      previewCaption.setPointerCapture(event.pointerId);
      previewCaption.classList.add('is-dragging');
      event.preventDefault();
    });

    const finishCaptionDrag = (event) => {
      if (!draggingCaption) return;
      draggingCaption = false;
      previewCaption.classList.remove('is-dragging');
      try {
        previewCaption.releasePointerCapture(event.pointerId);
      } catch {}

      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyCaptionXY(xPct, yPct);
      captionPosition.value = percentToCaptionPosition(xPct, yPct);
    };

    previewCaption.addEventListener('pointermove', (event) => {
      if (!draggingCaption) return;
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyCaptionXY(xPct, yPct);
    });

    previewCaption.addEventListener('pointerup', finishCaptionDrag);
    previewCaption.addEventListener('pointercancel', finishCaptionDrag);
  }

  // Drag image to quickly set image focus and sync back to the existing image position select.
  if (previewCanvas && previewImage && imagePosition) {
    let draggingImage = false;

    previewImage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      draggingImage = true;
      previewImage.setPointerCapture(event.pointerId);
      previewImage.classList.add('is-dragging');
      event.preventDefault();
    });

    previewImage.addEventListener('pointermove', (event) => {
      if (!draggingImage) return;
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      previewImage.style.objectPosition = `${xPct}% ${yPct}%`;
      if (imagePositionXInput) imagePositionXInput.value = xPct.toFixed(2);
      if (imagePositionYInput) imagePositionYInput.value = yPct.toFixed(2);
    });

    const finishImageDrag = (event) => {
      if (!draggingImage) return;
      draggingImage = false;
      previewImage.classList.remove('is-dragging');
      try {
        previewImage.releasePointerCapture(event.pointerId);
      } catch {}

      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      if (imagePositionXInput) imagePositionXInput.value = xPct.toFixed(2);
      if (imagePositionYInput) imagePositionYInput.value = yPct.toFixed(2);
      const keyword = percentToObjectPosition(xPct, yPct);
      imagePosition.value = keyword;
      previewImage.style.objectPosition = `${xPct}% ${yPct}%`;
    };

    previewImage.addEventListener('pointerup', finishImageDrag);
    previewImage.addEventListener('pointercancel', finishImageDrag);
  }

  // Drag secondary image overlay to choose where it sits on top of the ad.
  if (previewCanvas && previewImage2) {
    let draggingImage2 = false;

    previewImage2.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || previewImage2.style.display === 'none') return;
      draggingImage2 = true;
      previewImage2.setPointerCapture(event.pointerId);
      previewImage2.classList.add('is-dragging');
      event.preventDefault();
    });

    previewImage2.addEventListener('pointermove', (event) => {
      if (!draggingImage2) return;
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyPicture2XY(xPct, yPct);
    });

    const finishImage2Drag = (event) => {
      if (!draggingImage2) return;
      draggingImage2 = false;
      previewImage2.classList.remove('is-dragging');
      try {
        previewImage2.releasePointerCapture(event.pointerId);
      } catch {}
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyPicture2XY(xPct, yPct);
    };

    previewImage2.addEventListener('pointerup', finishImage2Drag);
    previewImage2.addEventListener('pointercancel', finishImage2Drag);
  }

  // Drag description box independently from company caption data.
  if (previewCanvas && previewDescriptionBox) {
    let draggingDescription = false;

    previewDescriptionBox.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || previewDescriptionBox.style.display === 'none')
        return;
      draggingDescription = true;
      previewDescriptionBox.setPointerCapture(event.pointerId);
      previewDescriptionBox.classList.add('is-dragging');
      event.preventDefault();
    });

    previewDescriptionBox.addEventListener('pointermove', (event) => {
      if (!draggingDescription) return;
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyDescriptionXY(xPct, yPct);
    });

    const finishDescriptionDrag = (event) => {
      if (!draggingDescription) return;
      draggingDescription = false;
      previewDescriptionBox.classList.remove('is-dragging');
      try {
        previewDescriptionBox.releasePointerCapture(event.pointerId);
      } catch {}
      const rect = previewCanvas.getBoundingClientRect();
      const xPct = clamp(
        ((event.clientX - rect.left) / rect.width) * 100,
        0,
        100,
      );
      const yPct = clamp(
        ((event.clientY - rect.top) / rect.height) * 100,
        0,
        100,
      );
      applyDescriptionXY(xPct, yPct);
    };

    previewDescriptionBox.addEventListener('pointerup', finishDescriptionDrag);
    previewDescriptionBox.addEventListener(
      'pointercancel',
      finishDescriptionDrag,
    );
  }
}

if (form) {
  setupLivePreview(form);

  form.addEventListener('submit', (e) => {
    const errors = [];

    const companyName = form.querySelector('#companyName');
    if (companyName && !companyName.value.trim()) {
      errors.push('Company name is required.');
    }

    const linkUrl = form.querySelector('#linkUrl');
    if (linkUrl && linkUrl.value.trim()) {
      try {
        new URL(linkUrl.value.trim());
      } catch {
        errors.push(
          'Click-through URL must be a valid full URL (e.g. https://yoursite.com).',
        );
      }
    }

    const picture = form.querySelector('#picture');
    const picture2 = form.querySelector('#picture2');
    if (picture && picture.files?.length) {
      const file = picture.files[0];
      const allowed = [
        'image/jpeg',
        'image/jpg',
        'image/pjpeg',
        'image/png',
        'image/x-png',
        'image/gif',
      ];
      if (!allowed.includes(file.type))
        errors.push('Only JPEG, PNG, or GIF images are allowed.');
      if (file.size > 5 * 1024 * 1024) errors.push('Image must be under 5 MB.');
    }

    if (picture2 && picture2.files?.length) {
      const file = picture2.files[0];
      const allowed = [
        'image/jpeg',
        'image/jpg',
        'image/pjpeg',
        'image/png',
        'image/x-png',
        'image/gif',
      ];
      if (!allowed.includes(file.type))
        errors.push('Second image must be JPEG, PNG, or GIF.');
      if (file.size > 5 * 1024 * 1024)
        errors.push('Second image must be under 5 MB.');
    }

    if (errors.length) {
      e.preventDefault();
      let banner = form.querySelector('.client-error-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'alert alert-error client-error-banner';
        form.prepend(banner);
      }
      banner.innerHTML =
        '<ul>' + errors.map((m) => `<li>${m}</li>`).join('') + '</ul>';
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ── Carousel builder mirror ──────────────────────────────────────────────────
(function () {
  const livePreview = document.getElementById('livePreview');
  const mirror = document.getElementById('carouselBuilderMirror');
  if (!livePreview || !mirror) return;

  const placeholder = document.getElementById('carouselPlaceholderContent');

  function syncMirror() {
    const clone = livePreview.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.querySelectorAll('.preview-badge').forEach((b) => b.remove());
    const badge = document.createElement('span');
    badge.className = 'preview-badge';
    badge.textContent = 'Carousel preview';
    clone.appendChild(badge);
    mirror.innerHTML = '';
    mirror.appendChild(clone);
    mirror.classList.add('is-active');
    if (placeholder) placeholder.style.display = 'none';
  }

  syncMirror();

  let syncTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncMirror, 80);
  });
  observer.observe(livePreview, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
})();
