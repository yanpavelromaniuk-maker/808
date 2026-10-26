(() => {
  'use strict';

  const html = document.documentElement;
  const body = document.body;
  const isErrorPage = body.dataset.page === 'error';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const mobileViewport = window.matchMedia('(max-width: 980px)');
  const languageKey = 'yan-language';

  const ui = {
    ru: {
      copy: 'COPY',
      copied: 'OK',
      copyEmail: 'Скопировать email',
      copiedEmail: 'Email скопирован',
      copySuccess: 'Email скопирован',
      copyError: 'Не удалось скопировать. Выделите адрес вручную.',
      menuOpen: 'Открыть меню',
      menuClose: 'Закрыть меню',
      menu: 'Меню',
      close: 'Закрыть'
    },
    en: {
      copy: 'COPY',
      copied: 'OK',
      copyEmail: 'Copy email',
      copiedEmail: 'Email copied',
      copySuccess: 'Email copied',
      copyError: 'Could not copy. Please select the address manually.',
      menuOpen: 'Open menu',
      menuClose: 'Close menu',
      menu: 'Menu',
      close: 'Close'
    }
  };

  let language = readLanguage();
  let lenis = null;
  let lenisFrame = null;
  let scrollFrame = null;
  let statementObserver = null;
  let copyResetTimer = null;
  let toastTimer = null;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function readLanguage() {
    try {
      return window.localStorage.getItem(languageKey) === 'en' ? 'en' : 'ru';
    } catch (_) {
      return 'ru';
    }
  }

  function saveLanguage(nextLanguage) {
    try {
      window.localStorage.setItem(languageKey, nextLanguage);
    } catch (_) {
      /* localStorage can be unavailable in private or local file contexts. */
    }
  }

  function dictionary() {
    return ui[language];
  }

  function getMenuToggle() {
    return $('[data-menu-toggle]');
  }

  function getMobileMenu() {
    return $('[data-mobile-menu]');
  }

  function isMenuOpen() {
    return body.classList.contains('is-menu-open');
  }

  function updateMeta(selector, value) {
    const element = $(selector);
    if (element && value) element.setAttribute('content', value);
  }

  function applyLanguage(nextLanguage) {
    if (nextLanguage !== 'ru' && nextLanguage !== 'en') return;
    language = nextLanguage;
    const strings = dictionary();
    html.lang = language;
    body.dataset.lang = language;

    $$('[data-ru][data-en]').forEach((element) => {
      if (element.hasAttribute('data-split-line')) return;
      element.textContent = element.dataset[language];
    });

    $$('[data-aria-ru][data-aria-en]').forEach((element) => {
      element.setAttribute('aria-label', element.dataset[`aria${language === 'ru' ? 'Ru' : 'En'}`]);
    });

    const title = body.dataset[`title${language === 'ru' ? 'Ru' : 'En'}`];
    const description = body.dataset[`desc${language === 'ru' ? 'Ru' : 'En'}`];
    if (title) document.title = title;
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', title);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[name="twitter:title"]', title);
    updateMeta('meta[name="twitter:description"]', description);
    updateMeta('meta[property="og:locale"]', language === 'ru' ? 'ru_RU' : 'en_US');

    $$('[data-set-lang]').forEach((button) => {
      const isActive = button.dataset.setLang === language;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.setAttribute('lang', button.dataset.setLang);
    });

    buildStatement();
    syncMenuUi();
    syncCopyUi();
    saveLanguage(language);
    scheduleMeasure();
  }

  function initLanguageSwitch() {
    $$('[data-set-lang]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.setLang !== language) applyLanguage(button.dataset.setLang);
      });
    });
  }

  function buildStatement() {
    const lines = $$('[data-split-line]');
    if (!lines.length) return;

    if (statementObserver) {
      statementObserver.disconnect();
      statementObserver = null;
    }

    lines.forEach((line) => {
      const text = line.dataset[language] || line.textContent || '';
      line.textContent = '';
      const words = text.split(/\s+/).filter(Boolean);
      words.forEach((word, index) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        span.style.transitionDelay = `${Math.min(index * 35, 280)}ms`;
        line.appendChild(span);
        if (index < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });

    const words = $$('.statement__line .word');
    if (reduceMotion.matches) {
      words.forEach((word) => word.classList.add('is-lit'));
      return;
    }

    statementObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-lit');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -4% 0px' }
    );

    words.forEach((word) => statementObserver.observe(word));
    updateScrollState();
  }

  function initReveals() {
    const items = $$('.reveal');
    if (!items.length) return;

    if (reduceMotion.matches) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, revealObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -4% 0px' }
    );

    items.forEach((item) => observer.observe(item));
  }

  function initLenis() {
    if (isErrorPage || reduceMotion.matches || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      lerp: 0.078,
      smoothWheel: true,
      wheelMultiplier: 0.88,
      touchMultiplier: 1.15,
      touchInertiaMultiplier: 18
    });

    lenis.on('scroll', scheduleScrollUpdate);

    const raf = (time) => {
      lenis.raf(time);
      lenisFrame = requestAnimationFrame(raf);
    };
    lenisFrame = requestAnimationFrame(raf);
  }

  function getHeaderOffset() {
    return window.innerWidth <= 640 ? 80 : 96;
  }

  function scrollToTarget(target) {
    if (!target) return;
    if (target.id === 'top') {
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.1 });
      } else {
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
      return;
    }

    const offset = -getHeaderOffset();
    if (lenis) {
      lenis.scrollTo(target, { offset, duration: 1.15 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  }

  function initAnchorLinks() {
    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor || anchor.classList.contains('skip-link')) return;
      const hash = anchor.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();
      if (isMenuOpen()) closeMenu({ restoreFocus: false });
      scrollToTarget(target);

      try {
        window.history.pushState(null, '', hash);
      } catch (_) {
        /* file:// can reject pushState, the scroll still works. */
      }

      if (event.detail === 0) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  function initMenu() {
    const toggle = getMenuToggle();
    const menu = getMobileMenu();
    if (!toggle || !menu) return;

    const close = (options = {}) => closeMenu(options);

    toggle.addEventListener('click', () => {
      if (isMenuOpen()) close();
      else openMenu();
    });

    $$('[data-menu-close]', menu).forEach((link) => {
      link.addEventListener('click', () => close({ restoreFocus: false }));
    });

    document.addEventListener('keydown', (event) => {
      if (!isMenuOpen()) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getMenuFocusableElements();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const onChange = () => {
      if (!mobileViewport.matches && isMenuOpen()) close({ restoreFocus: false });
    };
    if (mobileViewport.addEventListener) mobileViewport.addEventListener('change', onChange);
    else mobileViewport.addListener(onChange);
  }

  function getMenuFocusableElements() {
    const toggle = getMenuToggle();
    const menu = getMobileMenu();
    if (!toggle || !menu) return [];
    const items = [toggle, ...$$('a[href], button:not([disabled])', menu)];
    return items.filter((element) => element.offsetParent !== null || element === toggle);
  }

  function openMenu() {
    const toggle = getMenuToggle();
    const menu = getMobileMenu();
    if (!toggle || !menu) return;

    body.classList.add('is-menu-open');
    menu.classList.add('is-open');
    menu.removeAttribute('inert');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    setPageInert(true);
    if (lenis) lenis.stop();
    syncMenuUi();

    window.setTimeout(() => {
      const firstLink = $('.mobile-menu__link', menu);
      if (firstLink) firstLink.focus({ preventScroll: true });
    }, 80);
  }

  function closeMenu({ restoreFocus = true } = {}) {
    const toggle = getMenuToggle();
    const menu = getMobileMenu();
    if (!toggle || !menu || !isMenuOpen()) return;

    body.classList.remove('is-menu-open');
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menu.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false');
    setPageInert(false);
    if (lenis) lenis.start();
    syncMenuUi();

    if (restoreFocus) {
      window.setTimeout(() => toggle.focus({ preventScroll: true }), 40);
    }
  }

  function setPageInert(shouldBeInert) {
    const targets = $$(
      '#main, .site-footer, .skip-link, .site-header .brand, .site-header .nav-pill, .site-header .lang-switch'
    ).filter((element) => !element.contains(getMenuToggle()) && !element.contains(getMobileMenu()));

    targets.forEach((element) => {
      if (shouldBeInert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function syncMenuUi() {
    const toggle = getMenuToggle();
    const menu = getMobileMenu();
    if (!toggle) return;
    const label = $('[data-menu-label]', toggle);
    const strings = dictionary();
    const open = isMenuOpen();

    toggle.setAttribute('aria-label', open ? strings.menuClose : strings.menuOpen);
    if (label) label.textContent = open ? strings.close : strings.menu;
    toggle.setAttribute('aria-expanded', String(open));
    if (menu) menu.setAttribute('aria-hidden', String(!open));
  }

  function initCopyButtons() {
    $$('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copy || '';
        if (!value) return;
        try {
          await copyText(value);
          showToast(dictionary().copySuccess);
          markCopyButton(button, true);
        } catch (_) {
          showToast(dictionary().copyError);
        }
      });
    });
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, value.length);
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Copy failed');
  }

  function markCopyButton(button, copied) {
    window.clearTimeout(copyResetTimer);
    const text = $('.copy-button__text', button);
    const strings = dictionary();

    button.classList.toggle('is-copied', copied);
    button.setAttribute('aria-label', copied ? strings.copiedEmail : strings.copyEmail);
    if (text) text.textContent = copied ? strings.copied : strings.copy;

    if (copied) {
      copyResetTimer = window.setTimeout(() => resetCopyButton(button), 2200);
    }
  }

  function resetCopyButton(button) {
    if (!button) return;
    const text = $('.copy-button__text', button);
    const strings = dictionary();
    button.classList.remove('is-copied');
    button.setAttribute('aria-label', strings.copyEmail);
    if (text) text.textContent = strings.copy;
  }

  function syncCopyUi() {
    $$('.copy-button').forEach((button) => {
      if (!button.classList.contains('is-copied')) {
        button.setAttribute('aria-label', dictionary().copyEmail);
        const text = $('.copy-button__text', button);
        if (text) text.textContent = dictionary().copy;
      } else {
        button.setAttribute('aria-label', dictionary().copiedEmail);
      }
    });
  }

  function showToast(message) {
    const toast = $('[data-toast]');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  function initYear() {
    $$('[data-year]').forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  function elementDocumentTop(element) {
    let top = 0;
    let current = element;
    while (current) {
      top += current.offsetTop;
      current = current.offsetParent;
    }
    return top;
  }

  let parallaxItems = [];
  let navTargets = [];
  let layoutMeasureFrame = 0;

  function measureLayout() {
    parallaxItems = $$('[data-parallax]').map((element) => ({
      element,
      speed: Number.parseFloat(element.dataset.parallax) || 0,
      top: elementDocumentTop(element),
      height: element.offsetHeight
    }));

    navTargets = [
      { id: 'synergy', element: document.getElementById('synergy') },
      { id: 'approach', element: document.getElementById('approach') },
      { id: 'contact', element: document.getElementById('contact') }
    ]
      .filter((item) => item.element)
      .map((item) => ({
        id: item.id,
        top: elementDocumentTop(item.element)
      }));

    updateScrollState();
  }

  function scheduleMeasure() {
    window.cancelAnimationFrame(layoutMeasureFrame);
    layoutMeasureFrame = window.requestAnimationFrame(measureLayout);
  }

  function scheduleScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      updateScrollState();
    });
  }

  function updateScrollState() {
    if (isErrorPage) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const header = $('[data-header]');
    if (header) header.classList.toggle('is-scrolled', scrollTop > 24);

    const progress = $('.scroll-progress span');
    if (progress) {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }

    if (navTargets.length) {
      const probe = scrollTop + window.innerHeight * 0.36;
      let active = '';
      navTargets.forEach((item) => {
        if (probe >= item.top + 8) active = item.id;
      });
      $$('[data-nav-link]').forEach((link) => {
        const isActive = link.dataset.navLink === active;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });

      $$('.mobile-menu__link').forEach((link) => {
        const isActive = link.getAttribute('href') === `#${active}`;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    if (!reduceMotion.matches && parallaxItems.length) {
      const viewportCenter = scrollTop + window.innerHeight / 2;
      parallaxItems.forEach((item) => {
        const elementCenter = item.top + item.height / 2;
        const distance = viewportCenter - elementCenter;
        const offset = Math.round(distance * item.speed * 100) / 100;
        item.element.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    }
  }

  function initScrollState() {
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('load', scheduleMeasure, { once: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMeasure).catch(() => {});
    }

    measureLayout();
  }

  function initErrorParallax() {
    if (!isErrorPage || reduceMotion.matches || !finePointer.matches) return;
    const items = $$('[data-depth]');
    const sky = $('.error-sky');
    if (!items.length) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let started = false;

    window.addEventListener(
      'pointermove',
      (event) => {
        targetX = event.clientX / window.innerWidth - 0.5;
        targetY = event.clientY / window.innerHeight - 0.5;
        started = true;
      },
      { passive: true }
    );

    function frame() {
      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;

      if (started) {
        items.forEach((element) => {
          const depth = Number.parseFloat(element.dataset.depth) || 0;
          const x = currentX * depth;
          const y = currentY * depth;
          element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        });
        if (sky) {
          sky.style.transform = `translate3d(${(currentX * 8).toFixed(2)}px, ${(currentY * 8).toFixed(2)}px, 0) scale(1.03)`;
        }
      }

      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  function initFloatingObjects() {
    const layer = $('.floating-objects');
    if (!layer) return;

    const elements = $$('.floating-object', layer);
    if (!elements.length) return;

    const pathDefinitions = {
      sweep: [
        [-0.16, 0.12],
        [0.08, 0.16],
        [0.2, 0.24],
        [0.32, 0.25],
        [0.5, 0.36],
        [0.64, 0.38],
        [0.75, 0.4],
        [0.9, 0.43],
        [1.16, 0.45]
      ],
      rise: [
        [-0.16, 0.78],
        [0.08, 0.7],
        [0.17, 0.63],
        [0.25, 0.53],
        [0.27, 0.43],
        [0.27, 0.33],
        [0.31, 0.21],
        [0.36, 0.05],
        [0.42, -0.18]
      ],
      fall: [
        [0.26, -0.18],
        [0.25, 0.1],
        [0.27, 0.27],
        [0.24, 0.45],
        [0.28, 0.63],
        [0.31, 0.84],
        [0.32, 1.18]
      ],
      diagonal: [
        [0.1, 1.18],
        [0.25, 1.02],
        [0.31, 0.9],
        [0.36, 0.78],
        [0.45, 0.69],
        [0.51, 0.6],
        [0.56, 0.49],
        [0.64, 0.37],
        [0.69, 0.27],
        [0.74, 0.13],
        [0.79, -0.18]
      ],
      descend: [
        [0.63, -0.18],
        [0.64, 0.1],
        [0.69, 0.19],
        [0.72, 0.26],
        [0.73, 0.38],
        [0.77, 0.5],
        [0.8, 0.69],
        [0.88, 0.8],
        [0.96, 0.88],
        [1.16, 0.94]
      ],
      under: [
        [-0.16, 0.87],
        [0.1, 0.82],
        [0.26, 0.76],
        [0.4, 0.66],
        [0.55, 0.7],
        [0.7, 0.6],
        [0.85, 0.55],
        [1.16, 0.48]
      ],
      reverse: [
        [1.16, 0.18],
        [0.9, 0.22],
        [0.74, 0.27],
        [0.6, 0.35],
        [0.48, 0.46],
        [0.34, 0.54],
        [0.2, 0.66],
        [-0.16, 0.8]
      ],
      upper: [
        [-0.16, 0.28],
        [0.1, 0.34],
        [0.25, 0.42],
        [0.4, 0.44],
        [0.55, 0.39],
        [0.7, 0.33],
        [0.85, 0.28],
        [1.16, 0.2]
      ]
    };

    const segmentSteps = 30;

    const items = elements
      .map((element) => ({
        element,
        path: element.dataset.path,
        phase: Math.min(1, Math.max(0, Number.parseFloat(element.dataset.phase) || 0)),
        speed: Number.parseFloat(element.dataset.speed) || 1
      }))
      .filter((item) => pathDefinitions[item.path]);

    if (!items.length) return;

    let paths = {};
    let frameId = 0;
    let resizeId = 0;
    let startedAt = performance.now();

    function catmullRomPoint(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      return {
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      };
    }

    function buildPaths() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const nextPaths = {};

      Object.entries(pathDefinitions).forEach(([name, points]) => {
        const controls = points.map(([x, y]) => ({ x: x * width, y: y * height }));
        const samples = [];

        for (let index = 0; index < controls.length - 1; index += 1) {
          const p0 = controls[Math.max(0, index - 1)];
          const p1 = controls[index];
          const p2 = controls[index + 1];
          const p3 = controls[Math.min(controls.length - 1, index + 2)];

          for (let step = 0; step < segmentSteps; step += 1) {
            samples.push(catmullRomPoint(p0, p1, p2, p3, step / segmentSteps));
          }
        }

        samples.push({ ...controls[controls.length - 1] });

        let totalLength = 0;
        samples.forEach((point, index) => {
          if (index > 0) {
            totalLength += Math.hypot(point.x - samples[index - 1].x, point.y - samples[index - 1].y);
          }
          point.distance = totalLength;
        });

        nextPaths[name] = { samples, length: totalLength };
      });

      return nextPaths;
    }

    function pointAtDistance(path, distance) {
      if (!path.length) return path.samples[0];

      const normalized = ((distance % path.length) + path.length) % path.length;
      let low = 0;
      let high = path.samples.length - 1;

      while (low < high) {
        const middle = (low + high) >> 1;
        if (path.samples[middle].distance < normalized) low = middle + 1;
        else high = middle;
      }

      const next = path.samples[low];
      const previous = path.samples[Math.max(0, low - 1)];
      const segmentLength = next.distance - previous.distance || 1;
      const progress = (normalized - previous.distance) / segmentLength;

      return {
        x: previous.x + (next.x - previous.x) * progress,
        y: previous.y + (next.y - previous.y) * progress
      };
    }

    // The old straight pass ran at 200vw / 24s. This is exactly half that pace,
    // with a small per-object speed variation.
    const baseSpeedVwPerSecond = 200 / 24 / 2;

    function render(now) {
      const elapsed = Math.max(0, now - startedAt) / 1000;
      const baseSpeed = (window.innerWidth * baseSpeedVwPerSecond) / 100;

      items.forEach((item) => {
        const path = paths[item.path];
        if (!path || !path.length) return;

        const travel = item.phase * path.length + elapsed * baseSpeed * item.speed;
        const point = pointAtDistance(path, travel);
        item.element.style.transform = `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      });
    }

    function tick(now) {
      if (reduceMotion.matches) {
        frameId = 0;
        layer.classList.remove('is-running');
        return;
      }

      render(now);
      frameId = window.requestAnimationFrame(tick);
    }

    function startMotion() {
      if (reduceMotion.matches) return;
      layer.classList.add('is-running');
      if (!frameId) frameId = window.requestAnimationFrame(tick);
    }

    function stopMotion() {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      layer.classList.remove('is-running');
    }

    paths = buildPaths();
    render(performance.now());
    startMotion();

    window.addEventListener(
      'resize',
      () => {
        window.cancelAnimationFrame(resizeId);
        resizeId = window.requestAnimationFrame(() => {
          paths = buildPaths();
          if (!reduceMotion.matches) render(performance.now());
        });
      },
      { passive: true }
    );

    const onMotionChange = (event) => {
      if (event.matches) {
        stopMotion();
      } else {
        startedAt = performance.now();
        paths = buildPaths();
        render(startedAt);
        startMotion();
      }
    };

    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
    else reduceMotion.addListener(onMotionChange);
  }

  function initCursor() {
    const cursor = $('.cursor');
    if (!cursor || !finePointer.matches || reduceMotion.matches) return;

    html.classList.add('has-cursor');

    const move = (event) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.classList.remove('is-hidden');
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    window.addEventListener('blur', () => cursor.classList.add('is-hidden'));

    document.addEventListener('pointerover', (event) => {
      if (event.target.closest('a, button, .hero-visual')) {
        cursor.classList.add('is-hover');
      }
    });

    document.addEventListener('pointerout', (event) => {
      if (event.target.closest('a, button, .hero-visual')) {
        if (!event.relatedTarget || !event.relatedTarget.closest('a, button, .hero-visual')) {
          cursor.classList.remove('is-hover');
        }
      }
    });
  }

  function initMotionPreference() {
    const onChange = (event) => {
      if (!event.matches) return;
      $$('.reveal').forEach((item) => item.classList.add('is-visible'));
      $$('.statement__line .word').forEach((word) => word.classList.add('is-lit'));
      if (statementObserver) {
        statementObserver.disconnect();
        statementObserver = null;
      }
      html.classList.remove('has-cursor');
      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
      if (lenisFrame) {
        window.cancelAnimationFrame(lenisFrame);
        lenisFrame = null;
      }
      scheduleMeasure();
    };

    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onChange);
    else reduceMotion.addListener(onChange);
  }

  function init() {
    applyLanguage(language);
    initLanguageSwitch();
    initCopyButtons();
    initYear();
    initLenis();
    initMenu();
    initReveals();
    initAnchorLinks();
    initScrollState();
    initErrorParallax();
    initFloatingObjects();
    initCursor();
    initMotionPreference();
    updateScrollState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

