'use strict';

function getViewportWidth() {
  return (
    document.documentElement.clientWidth ||
    window.innerWidth ||
    screen.availWidth
  );
}

function sizeMainCarousel() {
  const carousel = document.getElementById('mainCarousel');
  const wrapper = carousel?.closest('.carousel-wrapper');
  if (!wrapper) return;

  const viewportWidth = getViewportWidth();
  const sidePadding = 24;

  // Target about 50% of viewport on desktop, but keep mobile readable.
  let nextWidth = viewportWidth * 0.5;

  if (viewportWidth <= 900) {
    nextWidth = viewportWidth - sidePadding;
  }

  const maxWidth = Math.min(1400, viewportWidth - sidePadding);
  const minWidth = Math.min(360, maxWidth);
  const clampedWidth = Math.max(minWidth, Math.min(nextWidth, maxWidth));

  wrapper.style.width = `${Math.round(clampedWidth)}px`;
}

function parsePercentVar(value, fallback = 50) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEdgeThreshold(viewportWidth) {
  // Conservative around tablet widths, permissive on large desktops.
  return viewportWidth <= 980 ? 12 : 6;
}

function isNearEdge(value, edgeThreshold = 8) {
  return value <= edgeThreshold || value >= 100 - edgeThreshold;
}

function shouldDisableSlideAnimation(img, viewportWidth) {
  const x = parsePercentVar(img.style.getPropertyValue('--img-x'), 50);
  const y = parsePercentVar(img.style.getPropertyValue('--img-y'), 50);
  const edgeThreshold = getEdgeThreshold(viewportWidth);

  // Tiny screens and edge-anchored images are most likely to clip during float.
  return (
    viewportWidth <= 700 ||
    isNearEdge(x, edgeThreshold) ||
    isNearEdge(y, edgeThreshold)
  );
}

function applyCarouselAnimationGuards() {
  const viewportWidth = getViewportWidth();
  document.querySelectorAll('.slide-img.slide-animate').forEach((img) => {
    img.classList.toggle(
      'slide-animate-disabled',
      shouldDisableSlideAnimation(img, viewportWidth),
    );
  });
}

class Carousel {
  #el;
  #track;
  #slides;
  #dots;
  #current = 0;
  #timer = null;
  #interval;

  constructor(el) {
    this.#el = el;
    this.#track = el.querySelector('.carousel-track');
    this.#slides = [...el.querySelectorAll('.carousel-slide')];
    this.#dots = [...el.querySelectorAll('.carousel-dot')];
    this.#interval = Number(el.dataset.interval) || 5000;

    if (this.#slides.length < 2) return;

    el.querySelector('.carousel-btn.prev')?.addEventListener('click', () =>
      this.#move(-1),
    );
    el.querySelector('.carousel-btn.next')?.addEventListener('click', () =>
      this.#move(1),
    );

    this.#dots.forEach((dot, i) =>
      dot.addEventListener('click', () => this.#goTo(i)),
    );

    el.addEventListener('mouseenter', () => this.#stop());
    el.addEventListener('mouseleave', () => this.#start());

    this.#start();
  }

  #goTo(index) {
    this.#slides[this.#current].classList.remove('active');
    this.#slides[this.#current].setAttribute('aria-hidden', 'true');
    this.#dots[this.#current]?.classList.remove('active');

    this.#current = (index + this.#slides.length) % this.#slides.length;
    this.#track.style.transform = `translateX(-${this.#current * 100}%)`;

    this.#slides[this.#current].classList.add('active');
    this.#slides[this.#current].setAttribute('aria-hidden', 'false');
    this.#dots[this.#current]?.classList.add('active');
  }

  #move(dir) {
    this.#stop();
    this.#goTo(this.#current + dir);
    this.#start();
  }

  #start() {
    this.#timer = setInterval(
      () => this.#goTo(this.#current + 1),
      this.#interval,
    );
  }

  #stop() {
    clearInterval(this.#timer);
  }
}

sizeMainCarousel();
applyCarouselAnimationGuards();

window.addEventListener('resize', () => {
  sizeMainCarousel();
  applyCarouselAnimationGuards();
});

document.querySelectorAll('.carousel').forEach((el) => new Carousel(el));
