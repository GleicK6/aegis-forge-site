/* Progressive enhancement: every capture stays available without JavaScript. */
(function () {
  'use strict';
  document.querySelectorAll('[data-product-gallery]').forEach(function (gallery) {
    var controls = gallery.querySelector('.gallery-controls');
    var buttons = Array.from(gallery.querySelectorAll('[data-gallery-target]'));
    var panels = Array.from(gallery.querySelectorAll('.gallery-panel'));
    if (!controls || !buttons.length || buttons.some(function (button) {
      return !panels.some(function (panel) { return panel.id === button.dataset.galleryTarget; });
    })) return;

    function select(button) {
      buttons.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      panels.forEach(function (panel) { panel.hidden = panel.id !== button.dataset.galleryTarget; });
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () { select(button); });
    });
    select(buttons[0]);
    controls.hidden = false;
  });
})();
