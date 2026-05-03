'use strict';

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

document.querySelectorAll('.carousel').forEach((el) => new Carousel(el));
