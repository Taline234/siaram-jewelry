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

  // Shop filter
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('[data-category]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach((card) => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });

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
