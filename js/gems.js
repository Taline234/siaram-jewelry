// Birthstones on the Gold & Gemstones page: tapping a stone's name opens its photo.
(() => {
  const dialog = document.querySelector('.gem-dialog');
  if (!dialog) return;
  const img = dialog.querySelector('img');
  document.addEventListener('click', (event) => {
    const gem = event.target.closest('.gem-pop');
    if (gem) {
      img.src = gem.dataset.img;
      img.alt = gem.textContent;
      dialog.querySelector('.gem-dialog-glow').style.background = `radial-gradient(circle, ${gem.dataset.glow} 0%, transparent 70%)`;
      dialog.querySelector('.gem-dialog-name').textContent = gem.textContent;
      dialog.showModal();
    } else if (event.target === dialog || event.target.closest('.gem-dialog-close')) {
      dialog.close();
    }
  });
})();
