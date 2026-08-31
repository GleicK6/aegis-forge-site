/* ─────────────────────────────────────────────────────────────
   AEGIS — Lightbox screenshots

   Usage : ajouter l'attribut data-lightbox sur n'importe quelle
   <img>. Au clic (ou Enter/Espace au clavier), l'image s'ouvre
   en grand dans un overlay plein ecran. Fermeture : Escape,
   clic overlay, bouton fermer. Sans JS, l'image reste statique.
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var lightbox = null;
  var lastFocus = null;

  function buildHtml() {
    return [
      '<div class="aegis-lb" role="dialog" aria-modal="true" aria-hidden="true" tabindex="-1">',
      '  <div class="aegis-lb__overlay" data-lb-close></div>',
      '  <button type="button" class="aegis-lb__close" data-lb-close aria-label="Fermer">&times;</button>',
      '  <figure class="aegis-lb__figure">',
      '    <img class="aegis-lb__img" alt="" data-lb-close>',
      '    <figcaption class="aegis-lb__caption"></figcaption>',
      '  </figure>',
      '</div>'
    ].join('\n');
  }

  function isOpen() {
    return lightbox && lightbox.getAttribute('aria-hidden') === 'false';
  }

  function open(trigger) {
    lastFocus = trigger;
    var img = lightbox.querySelector('.aegis-lb__img');
    var caption = lightbox.querySelector('.aegis-lb__caption');
    var alt = trigger.getAttribute('alt') || '';
    img.setAttribute('src', trigger.currentSrc || trigger.src);
    // alt reste vide : la legende visible et l'aria-label du dialog
    // portent deja le texte (evite la triple annonce lecteur d'ecran)
    caption.textContent = alt;
    lightbox.setAttribute('aria-label', alt || 'Image agrandie');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('aegis-lb-open');
    document.addEventListener('keydown', onModalKeydown);
    // Focus sur le dialog, pas le bouton fermer : une touche Enter
    // maintenue n'activerait pas la fermeture en boucle
    lightbox.focus();
  }

  function close() {
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.querySelector('.aegis-lb__img').removeAttribute('src');
    document.body.classList.remove('aegis-lb-open');
    document.removeEventListener('keydown', onModalKeydown);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab') {
      // Seul le bouton fermer est focusable dans la lightbox
      e.preventDefault();
      lightbox.querySelector('.aegis-lb__close').focus();
    }
  }

  function onTriggerKeydown(e) {
    if (e.repeat) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (t && t.nodeType === 1 && t.matches('img[data-lightbox]')) {
      e.preventDefault();
      open(t);
    }
  }

  function onClick(e) {
    var trigger = e.target.closest('img[data-lightbox]');
    if (trigger) {
      open(trigger);
      return;
    }
    if (isOpen() && e.target.closest('[data-lb-close]')) {
      close();
    }
  }

  function init() {
    var triggers = document.querySelectorAll('img[data-lightbox]');
    if (!triggers.length) return;

    for (var i = 0; i < triggers.length; i++) {
      triggers[i].setAttribute('tabindex', '0');
      triggers[i].setAttribute('role', 'button');
      triggers[i].setAttribute('aria-label', 'Agrandir : ' + (triggers[i].getAttribute('alt') || 'image'));
    }

    var container = document.createElement('div');
    container.innerHTML = buildHtml();
    lightbox = container.firstElementChild;
    document.body.appendChild(lightbox);
    document.body.classList.add('aegis-lb-ready');

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onTriggerKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
