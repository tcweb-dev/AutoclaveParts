'use strict';

// Observe ad cards entering the viewport and trigger their animation class
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('ad-in-view');
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 },
);

document
  .querySelectorAll('.ad-card.ad-animate')
  .forEach((card) => observer.observe(card));
