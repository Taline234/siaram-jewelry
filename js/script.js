// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    // aria-expanded tells screen readers whether the phone menu is open.
    const setOpen = (open) => { menu.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  }

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal, .product-card');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => observer.observe(el));

  // Shop filter: by type and by collection; #<collection> in the URL preselects one
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.product-card[data-category]');
  const intro = document.querySelector('.collection-intro');
  const introData = document.getElementById('collection-intros');
  const intros = introData ? JSON.parse(introData.textContent) : {};
  const active = { category: 'all', collection: 'all' };
  const applyFilter = () => {
    filterBtns.forEach((b) => b.classList.toggle('active', active[b.dataset.group || 'category'] === b.dataset.filter));
    cards.forEach((card) => {
      const show = (active.category === 'all' || card.dataset.category === active.category)
        && (active.collection === 'all' || card.dataset.collection === active.collection);
      card.style.display = show ? '' : 'none';
    });
    if (intro) intro.textContent = intros[active.collection] || '';
  };
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      active[btn.dataset.group || 'category'] = btn.dataset.filter;
      applyFilter();
    });
  });
  // The Shop menu links here with #all, a type (#rings) or a collection (#equestrian).
  const categories = [...filterBtns].filter((b) => (b.dataset.group || 'category') === 'category').map((b) => b.dataset.filter);
  const filterFromHash = () => {
    const key = location.hash.slice(1);
    if (!filterBtns.length) return;
    if (key === 'all') {
      active.category = 'all';
      active.collection = 'all';
    } else if (categories.includes(key)) {
      active.category = key;
      active.collection = 'all';
    } else if (intros[key]) {
      active.category = 'all';
      active.collection = key;
    } else {
      return;
    }
    applyFilter();
  };
  filterFromHash();
  window.addEventListener('hashchange', filterFromHash);

  // Product photo gallery
  document.querySelectorAll('.product-gallery').forEach((gallery) => {
    const main = gallery.querySelector('.gallery-main');
    const thumbs = gallery.querySelectorAll('.gallery-thumb');
    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        main.src = thumb.dataset.src;
        main.alt = thumb.dataset.alt;
        thumbs.forEach((t) => t.setAttribute('aria-current', String(t === thumb)));
      });
    });
  });

  // Card photo browser: arrows (and swipe) to flick through a piece's photos
  document.querySelectorAll('.product-media[data-photos]').forEach((link) => {
    const photos = link.dataset.photos.split(',');
    if (photos.length < 2) return;
    const img = link.querySelector('img');
    const wrap = document.createElement('div');
    wrap.className = 'card-gallery';
    link.before(wrap);
    wrap.append(link);
    let index = 0;
    const dots = document.createElement('div');
    dots.className = 'card-dots';
    dots.setAttribute('aria-hidden', 'true');
    photos.forEach(() => dots.append(document.createElement('span')));
    const show = (i) => {
      index = (i + photos.length) % photos.length;
      img.src = photos[index];
      dots.querySelectorAll('span').forEach((d, j) => d.classList.toggle('on', j === index));
    };
    const button = (dir, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `card-nav card-${dir}`;
      b.setAttribute('aria-label', label);
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
      b.addEventListener('click', () => show(index + (dir === 'prev' ? -1 : 1)));
      return b;
    };
    wrap.append(button('prev', 'Previous photo'), button('next', 'Next photo'), dots);
    show(0);
    // Fetch the other photos once someone shows interest, so flicking is instant
    wrap.addEventListener('pointerenter', () => photos.slice(1).forEach((src) => { new Image().src = src; }), { once: true });
    let startX = null;
    link.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    link.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) { e.preventDefault(); show(index + (dx < 0 ? 1 : -1)); }
    });
  });

  // Clear the "choose a size" warning once a size is picked
  document.querySelectorAll('.size-select').forEach((size) => {
    size.addEventListener('change', () => { if (size.value) size.classList.remove('invalid'); });
  });

  // Size guide pop-ups
  document.querySelectorAll('.size-guide-open').forEach((btn) => {
    const dialog = document.getElementById(`size-guide-${btn.dataset.guide}`);
    if (!dialog) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault(); // guide links on the Custom page fall back to the guide pages without JavaScript
      dialog.showModal();
    });
    dialog.querySelector('.size-guide-close').addEventListener('click', () => dialog.close());
    // A click on the dimmed backdrop closes it too
    dialog.addEventListener('click', (e) => {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.faq-item').classList.toggle('open');
    });
  });

  // Set active nav link
  // Addresses can be short (/shop) or long (/shop.html); only the top-level menu items are underlined.
  let path = window.location.pathname.split('/').pop() || 'index.html';
  if (!path.endsWith('.html')) path += '.html';
  if (path.startsWith('product-')) path = 'shop.html';
  document.querySelectorAll('.nav-links > li > a, .mobile-menu > a').forEach((a) => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});

// Header "Enquire": a small menu with WhatsApp and Email. Opens on hover (desktop) or tap, closes on a tap elsewhere.
document.querySelectorAll('.enquire-menu').forEach((menu) => {
  const toggle = menu.querySelector('.enquire-toggle');
  const set = (open) => { menu.classList.toggle('open', open); toggle.setAttribute('aria-expanded', open); };
  toggle.addEventListener('click', (e) => { e.stopPropagation(); set(!menu.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
});

// Product pages: the made-to-order note follows the metal chosen (yellow gold: only if out of stock; rose and white: always).
document.addEventListener('change', (e) => {
  if (e.target.name !== 'metal') return;
  const yellow = e.target.value === 'yellow';
  document.querySelectorAll('[data-metal-note]').forEach((n) => { n.hidden = (n.dataset.metalNote === 'yellow') !== yellow; });
});

// Product pages: choosing a different stone or pearl makes the piece made to order; say so straight away.
document.addEventListener('change', (e) => {
  if (!e.target.classList?.contains('alt-stone-select') || !e.target.value) return;
  const dialog = document.getElementById('alt-stone-dialog');
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
});
document.querySelectorAll('#alt-stone-dialog').forEach((dialog) => {
  dialog.querySelectorAll('.size-guide-close, .mto-ok').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
});
