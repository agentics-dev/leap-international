(function () {
  'use strict';

  var navVersion = '20260813-5';
  if (window.__leapNavVersion === navVersion) return;
  window.__leapNavBound = true;
  window.__leapNavVersion = navVersion;

  function closeMegaMenus(except) {
    document.querySelectorAll('.mega-group.show').forEach(function (group) {
      if (group !== except) group.classList.remove('show');
      var toggle = group.querySelector('.mega-toggle');
      if (toggle && group !== except) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function setMobileMenu(open) {
    var mobileMenu = document.getElementById('mobileMenu');
    var overlay = document.getElementById('mobileOverlay');
    if (!mobileMenu || !overlay) return;
    mobileMenu.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    if (open) {
      mobileMenu.style.setProperty('transform', 'translateX(0)', 'important');
      overlay.style.setProperty('opacity', '1', 'important');
      overlay.style.setProperty('visibility', 'visible', 'important');
      document.body.style.overflow = 'hidden';
    } else {
      mobileMenu.style.removeProperty('transform');
      overlay.style.removeProperty('opacity');
      overlay.style.removeProperty('visibility');
      document.body.style.overflow = '';
    }
  }

  function toggleLanguageMenu(forceOpen) {
    var btn = document.getElementById('langBtn');
    var dropdown = document.getElementById('langDropdown');
    if (!btn || !dropdown) return;
    var open = typeof forceOpen === 'boolean' ? forceOpen : !dropdown.classList.contains('show');
    dropdown.classList.toggle('show', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  function navigateMenuLink(event) {
    var link = event.target.closest('header a[href], .mega-dropdown a[href], #mobileMenu a[href]');
    if (!link) return false;
    var href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('tel:') || href.startsWith('mailto:')) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(link.href);
    return true;
  }

  document.addEventListener('pointerdown', function (event) {
    if (event.button && event.button !== 0) return;
    navigateMenuLink(event);
  }, true);

  document.addEventListener('pointerup', function (event) {
    if (event.button && event.button !== 0) return;
    navigateMenuLink(event);
  }, true);

  document.addEventListener('click', function (event) {
    if (navigateMenuLink(event)) return;

    var langBtn = event.target.closest('#langBtn');
    if (langBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMegaMenus(null);
      toggleLanguageMenu();
      return;
    }

    var langChoice = event.target.closest('#langDropdown [data-lang]');
    if (langChoice) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof window.setLang === 'function') window.setLang(langChoice.getAttribute('data-lang'));
      toggleLanguageMenu(false);
      return;
    }

    var megaToggle = event.target.closest('.mega-toggle');
    if (megaToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleLanguageMenu(false);
      var group = megaToggle.closest('.mega-group');
      if (!group) return;
      var willOpen = !group.classList.contains('show');
      closeMegaMenus(group);
      group.classList.toggle('show', willOpen);
      megaToggle.setAttribute('aria-expanded', String(willOpen));
      return;
    }

    var mobileOpen = event.target.closest('#menuToggle');
    if (mobileOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMobileMenu(true);
      return;
    }

    var mobileClose = event.target.closest('#menuClose, #mobileOverlay');
    if (mobileClose) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMobileMenu(false);
      return;
    }

    var mobileSubToggle = event.target.closest('[data-mobile-toggle]');
    if (mobileSubToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var row = mobileSubToggle.closest('.flex.items-center');
      var submenu = row ? row.nextElementSibling : null;
      if (submenu) submenu.classList.toggle('hidden');
      return;
    }

    if (!event.target.closest('.mega-group')) closeMegaMenus(null);
    if (!event.target.closest('#langSwitcher')) toggleLanguageMenu(false);
  }, true);
})();
