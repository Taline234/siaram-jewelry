// Journal page: the category buttons above the stories show only the stories of that category.
document.addEventListener('click', (event) => {
  const chip = event.target.closest('.journal-chip');
  if (!chip) return;
  const filter = chip.dataset.filter;
  document.querySelectorAll('.journal-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  document.querySelectorAll('.journal-feature, .journal-grid .journal-card').forEach((card) => {
    card.hidden = Boolean(filter) && card.dataset.category !== filter;
  });
});
