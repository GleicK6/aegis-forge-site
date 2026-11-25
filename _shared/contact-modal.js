/* ─────────────────────────────────────────────────────────────
   AEGIS — Modal de contact (Formspree)

   Usage : ajouter class="js-aegis-contact" sur n'importe quel
   <button> ou <a>. Au clic, ouvre la modal. Si JS desactive, le
   bouton conserve son href mailto: comme fallback.

   Configuration : remplacer FORMSPREE_ENDPOINT par le vrai
   endpoint Formspree (https://formspree.io/f/xxxxxxxx).
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mbdbkdee';
  var FALLBACK_EMAIL = 'contact@aegis-forge.fr';

  var modal = null;
  var lastFocus = null;
  var sending = false;
  var sent = false;
  var focusTimer = null;
  var contactContexts = {
    agora: {
      title: 'Demander une présentation d’AGORA',
      subject: 'Présentation AGORA',
      help: 'Indiquez votre commune et un exemple de mission : comment l’élu la pilote, comment l’agent partage ses retours du terrain et comment vous préparez la suite.'
    },
    forge: {
      title: 'Parler de mon besoin',
      subject: 'Projet sur mesure — AEGIS Forge',
      help: 'Décrivez votre fonctionnement actuel et ce que vous aimeriez simplifier. Une idée encore à préciser suffit.'
    },
    octane: {
      title: 'Contacter l’équipe Octane',
      subject: 'Question ou retour sur Octane',
      help: 'Décrivez votre question ou le problème rencontré. Pour un problème technique, précisez votre modèle de téléphone et la version de l’application.'
    }
  };
  var contactContext = contactContexts[document.body.getAttribute('data-contact-context')] || null;

  function buildHtml() {
    return [
      '<div class="aegis-cm" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="aegis-cm-title">',
      '  <div class="aegis-cm__overlay" data-close></div>',
      '  <div class="aegis-cm__dialog" role="document">',
      '    <button type="button" class="aegis-cm__close" data-close aria-label="Fermer">&times;</button>',
      '    <div class="aegis-cm__header">',
      '      <span class="aegis-cm__eyebrow">Nous contacter</span>',
      '      <h2 class="aegis-cm__title" id="aegis-cm-title">Demande de contact</h2>',
      '      <p class="aegis-cm__lede">Réponse sous 48 h ouvrées. Vos coordonnées servent uniquement à traiter votre demande.</p>',
      '    </div>',
      '    <form class="aegis-cm__form">',
      '      <input type="hidden" name="subject" value="">',
      '      <div class="aegis-cm__field">',
      '        <label class="aegis-cm__label" for="aegis-cm-name">Nom</label>',
      '        <input class="aegis-cm__input" type="text" id="aegis-cm-name" name="name" required autocomplete="name">',
      '      </div>',
      '      <div class="aegis-cm__field">',
      '        <label class="aegis-cm__label" for="aegis-cm-email">Email</label>',
      '        <input class="aegis-cm__input" type="email" id="aegis-cm-email" name="email" required autocomplete="email">',
      '      </div>',
      '      <div class="aegis-cm__field">',
      '        <label class="aegis-cm__label" for="aegis-cm-message">Message</label>',
      '        <textarea class="aegis-cm__textarea" id="aegis-cm-message" name="message" minlength="10" required aria-describedby="aegis-cm-message-help"></textarea>',
      '        <p class="aegis-cm__help" id="aegis-cm-message-help">Décrivez le besoin, le contexte et les personnes qui utiliseront l\'outil.</p>',
      '      </div>',
      '      <input type="text" name="_gotcha" tabindex="-1" aria-hidden="true" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;">',
      '      <div class="aegis-cm__consent">',
      '        <input type="checkbox" id="aegis-cm-consent" name="consent" value="yes" required>',
      '        <label for="aegis-cm-consent">J\'accepte le traitement de ma demande via Formspree, avec un transfert aux États-Unis, selon la <a href="mentions.html#confidentialite">politique de confidentialité</a>.</label>',
      '      </div>',
      '      <div class="aegis-cm__actions">',
      '        <button type="submit" class="aegis-cm__submit">Envoyer</button>',
      '        <p class="aegis-cm__fallback">ou écrivez à <a href="mailto:' + FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + '</a><button type="button" class="aegis-cm__copy" data-copy-email>Copier l’adresse</button></p>',
      '      </div>',
      '      <p class="aegis-cm__status" role="status" aria-live="polite"></p>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function getFocusableElements(root) {
    return Array.prototype.filter.call(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ), function (el) { return el.getAttribute('tabindex') !== '-1' && el.getAttribute('aria-hidden') !== 'true'; });
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var focusables = getFocusableElements(modal.querySelector('.aegis-cm__dialog'));
    if (focusables.length === 0) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    trapFocus(e);
  }

  function open(trigger) {
    if (sent) resetForm();
    lastFocus = trigger || document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('aegis-cm-open');
    document.addEventListener('keydown', onKeydown);
    clearTimeout(focusTimer);
    focusTimer = setTimeout(function () {
      if (modal.getAttribute('aria-hidden') !== 'false') return;
      var focusTarget = modal.querySelector(sending ? '.aegis-cm__close' : '#aegis-cm-name');
      if (focusTarget) focusTarget.focus();
    }, 50);
  }

  function close() {
    clearTimeout(focusTimer);
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('aegis-cm-open');
    document.removeEventListener('keydown', onKeydown);
    // Garder le brouillon et l'envoi en cours lors d'une fermeture accidentelle.
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function resetForm() {
    sent = false;
    var form = modal.querySelector('.aegis-cm__form');
    var status = modal.querySelector('.aegis-cm__status');
    var submit = modal.querySelector('.aegis-cm__submit');
    if (form) form.reset();
    if (status) {
      status.className = 'aegis-cm__status';
      status.textContent = '';
    }
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Envoyer';
    }
    setFieldsDisabled(false);
  }

  function setFieldsDisabled(disabled) {
    var fields = modal.querySelectorAll('.aegis-cm__input, .aegis-cm__textarea, #aegis-cm-consent');
    for (var i = 0; i < fields.length; i++) {
      fields[i].disabled = disabled;
    }
  }

  function showStatus(type, message) {
    var status = modal.querySelector('.aegis-cm__status');
    if (!status) return;
    status.className = 'aegis-cm__status aegis-cm__status--' + type;
    status.textContent = message;
  }

  function isPlaceholderEndpoint() {
    return FORMSPREE_ENDPOINT.indexOf('REPLACE_WITH_REAL_ENDPOINT') !== -1;
  }

  function copyEmail() {
    function copied() {
      showStatus('ok', 'Adresse email copiée.');
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(FALLBACK_EMAIL).then(copied).catch(function () {
        showStatus('err', 'Copie impossible. Sélectionnez l’adresse email ci-dessus.');
      });
      return;
    }

    var field = document.createElement('textarea');
    field.value = FALLBACK_EMAIL;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(field);
    field.select();
    var success = document.execCommand('copy');
    document.body.removeChild(field);
    if (success) copied();
    else showStatus('err', 'Copie impossible. Sélectionnez l’adresse email ci-dessus.');
  }

  async function onSubmit(e) {
    e.preventDefault();
    var form = e.target;
    if (sending || sent) return;
    ['name', 'email', 'message'].forEach(function (key) { form.elements[key].value = form.elements[key].value.trim(); });

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (isPlaceholderEndpoint()) {
      showStatus('err', 'Le formulaire n\'est pas encore configuré. Écrivez directement à ' + FALLBACK_EMAIL + '.');
      return;
    }

    var submit = form.querySelector('.aegis-cm__submit');
    sending = true;
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    submit.textContent = 'Envoi en cours...';
    setFieldsDisabled(true);
    showStatus('', '');

    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      consent: form.elements.consent.checked,
      _gotcha: form.elements._gotcha.value
    };
    var payload = {
      name: data.name,
      email: data.email,
      message: data.message,
      consent: data.consent ? 'yes' : 'no'
    };
    if (contactContext) payload.subject = contactContext.subject;

    // Anti-spam honeypot : si _gotcha rempli, on simule un succes
    if (data._gotcha) {
      sending = false;
      sent = true;
      form.setAttribute('aria-busy', 'false');
      showStatus('ok', 'Merci, on vous répond sous 48 h ouvrées.');
      submit.textContent = 'Envoyé';
      return;
    }

    var controller = new AbortController();
    var timedOut = false;
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
        reject(new Error('timeout'));
      }, 15000);
    });
    try {
      var res = await Promise.race([fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
      }), timeout]);
      if (!res.ok) {
        showStatus('err', 'Le service n’a pas accepté le message (' + res.status + '). Réessayez ou écrivez à ' + FALLBACK_EMAIL + '.');
      } else {
        sent = true;
        showStatus('ok', 'Votre message a été transmis. Merci, on vous répond sous 48 h ouvrées.');
        submit.textContent = 'Envoyé';
      }
    } catch (_) {
      showStatus('err', (timedOut ? 'Le délai de confirmation est dépassé.' : 'La connexion a été interrompue.') + ' L’envoi n’est pas confirmé. Votre texte est conservé ; évitez les renvois répétés. Vous pouvez écrire à ' + FALLBACK_EMAIL + '.');
    } finally {
      clearTimeout(timer);
      sending = false;
      form.setAttribute('aria-busy', 'false');
      if (!sent) {
        submit.disabled = false;
        submit.textContent = 'Réessayer';
        setFieldsDisabled(false);
      }
    }
  }

  function attachTriggers() {
    document.addEventListener('click', function (e) {
      var copy = e.target.closest('[data-copy-email]');
      if (copy) {
        e.preventDefault();
        copyEmail();
        return;
      }
      var trigger = e.target.closest('.js-aegis-contact');
      if (trigger) {
        e.preventDefault();
        open(trigger);
        return;
      }
      if (e.target.matches('[data-close]')) {
        close();
      }
    });
  }

  function init() {
    var container = document.createElement('div');
    container.innerHTML = buildHtml();
    modal = container.firstElementChild;
    document.body.appendChild(modal);
    if (contactContext) {
      modal.querySelector('#aegis-cm-title').textContent = contactContext.title;
      modal.querySelector('#aegis-cm-message-help').textContent = contactContext.help;
      var subject = modal.querySelector('[name="subject"]');
      subject.value = contactContext.subject;
      subject.defaultValue = contactContext.subject;
    }
    modal.querySelector('.aegis-cm__form').addEventListener('submit', onSubmit);
    attachTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
