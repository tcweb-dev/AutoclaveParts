'use strict';

(() => {
  const lightbox = document.getElementById('adminLightbox');
  const lightboxImage = document.getElementById('adminLightboxImage');
  const closeButton = document.getElementById('adminLightboxClose');
  const backdropButton = document.getElementById('adminLightboxBackdrop');
  const thumbLinks = document.querySelectorAll('[data-lightbox-thumb="true"]');

  if (!lightbox || !lightboxImage || !thumbLinks.length) return;

  let lastTrigger = null;

  const openLightbox = (linkEl) => {
    const imageSrc = linkEl.getAttribute('href');
    const thumbImg = linkEl.querySelector('img');
    if (!imageSrc) return;

    lastTrigger = linkEl;
    lightboxImage.src = imageSrc;
    lightboxImage.alt = thumbImg?.alt || 'Expanded ad image preview';
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-lightbox-open');
    closeButton?.focus();
  };

  const closeLightbox = () => {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.src = '';
    document.body.classList.remove('admin-lightbox-open');
    if (lastTrigger) lastTrigger.focus();
  };

  thumbLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openLightbox(link);
    });
  });

  closeButton?.addEventListener('click', closeLightbox);
  backdropButton?.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLightbox();
  });
})();
