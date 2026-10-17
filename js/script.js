// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => menu.classList.remove('open'))
    );
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
  const filterFromHash = () => {
    const key = location.hash.slice(1);
    if (!filterBtns.length || !intros[key]) return;
    active.category = 'all';
    active.collection = key;
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

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.faq-item').classList.toggle('open');
    });
  });

  // Set active nav link
  let path = window.location.pathname.split('/').pop() || 'index.html';
  if (path.startsWith('product-')) path = 'shop.html';
  if (path.startsWith('journal-')) path = 'journal.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach((a) => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});
