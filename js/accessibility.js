(function () {
  'use strict';
  var activeDialog = null;
  var returnFocus = null;
  var scheduled = false;
  var focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  function visible(el) { return !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'); }
  function text(en, zh, hans) { return window.leapText ? window.leapText(en, zh, hans) : en; }
  function set(el, name, value) { if (el.getAttribute(name) !== value) el.setAttribute(name, value); }
  function enhance() {
    scheduled = false;
    if (!window.document) return;
    document.querySelectorAll('div[onclick],span[onclick]').forEach(function (el) {
      var action = el.getAttribute('onclick').replace(/^event\.stopPropagation\(\);\s*/, '');
      if (!/^(select|pickSlot|toggle(?:Summary|Info|Select|SISelect|BookkeepingSelect|AccountingSelect)|proceedToCheckout|openBookingModal|closeEnquireModal)/.test(action)) return;
      if (el.classList.contains('past')) { set(el, 'aria-disabled', 'true'); set(el, 'tabindex', '-1'); return; }
      set(el, 'role', 'button'); set(el, 'tabindex', '0');
      if (/^(select|pickSlot)/.test(action)) set(el, 'aria-pressed', String(el.classList.contains('selected')));
      if (el.classList.contains('cal-day')) { var month = document.getElementById('calMonthLabel'); if (month) set(el, 'aria-label', month.textContent + ' ' + el.textContent); }
      if (el.id === 'summaryToggle') set(el, 'aria-label', text('Toggle order summary', '展開或收起訂單摘要', '展开或收起订单摘要'));
    });
    [['serviceSelect', 'Service', '服務', '服务'], ['timezoneSelect', 'Time zone', '時區', '时区']].forEach(function (item) {
      var el = document.getElementById(item[0]); if (el) set(el, 'aria-label', text(item[1], item[2], item[3]));
    });
    var languageButton = document.getElementById('langBtn');
    var languageLabel = document.getElementById('langLabel');
    if (languageButton && languageLabel) set(languageButton, 'aria-label', text('Language', '語言', '语言') + ': ' + languageLabel.textContent);
    var flag = document.getElementById('langFlag'); if (flag) set(flag, 'aria-hidden', 'true');
    document.querySelectorAll('button .material-symbols-outlined').forEach(function (icon) { if (!icon.hasAttribute('onclick')) set(icon, 'aria-hidden', 'true'); });
    [['prevMonth()', 'Previous month', '上個月', '上个月'], ['nextMonth()', 'Next month', '下個月', '下个月'], ['closeBookingModal()', 'Close', '關閉', '关闭'], ['closeEnquireModal()', 'Close', '關閉', '关闭']].forEach(function (item) {
      document.querySelectorAll('button[onclick="' + item[0] + '"]').forEach(function (button) { set(button, 'aria-label', text(item[1], item[2], item[3])); });
    });
    var next = null;
    ['enquireModal', 'bookingOverlay', 'mobileMenu'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var open = id === 'mobileMenu' ? el.classList.contains('open') : id === 'bookingOverlay' ? !el.classList.contains('hidden') : el.classList.contains('show') || el.classList.contains('active');
      set(el, 'role', 'dialog'); set(el, 'aria-modal', 'true');
      set(el, 'aria-label', id === 'mobileMenu' ? text('Navigation menu', '導覽選單', '导航菜单') : id === 'bookingOverlay' ? text('Book a consultation', '預約諮詢', '预约咨询') : text('Enquire about services', '服務查詢', '服务查询'));
      set(el, 'aria-hidden', String(!open));
      if (!open) set(el, 'inert', ''); else if (el.hasAttribute('inert')) el.removeAttribute('inert');
      if (open && visible(el)) next = el;
      if (id === 'mobileMenu') {
        var toggle = document.getElementById('menuToggle');
        if (toggle) { set(toggle, 'aria-expanded', String(open)); set(toggle, 'aria-controls', id); }
      }
    });
    if (next !== activeDialog) {
      if (!activeDialog && next) returnFocus = document.activeElement;
      var previous = activeDialog; activeDialog = next;
      if (next) {
        set(next, 'tabindex', '-1');
        (Array.from(next.querySelectorAll(focusable)).find(visible) || next).focus();
      } else if (previous && returnFocus && returnFocus.isConnected) {
        returnFocus.focus(); returnFocus = null;
      }
    }
    if (activeDialog && visible(activeDialog) && !activeDialog.contains(document.activeElement)) {
      (Array.from(activeDialog.querySelectorAll(focusable)).find(visible) || activeDialog).focus();
    }
  }
  function queue() { if (!scheduled) { scheduled = true; (window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 0); })(enhance); } }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (activeDialog) {
        if (activeDialog.id === 'enquireModal' && window.closeEnquireModal) window.closeEnquireModal();
        else if (activeDialog.id === 'bookingOverlay' && window.closeBookingModal) window.closeBookingModal();
        else { var close = document.getElementById('menuClose'); if (close) close.click(); }
        event.preventDefault(); queue();
      }
      document.querySelectorAll('.mega-group.show').forEach(function (group) { group.classList.remove('show'); var toggle = group.querySelector('.mega-toggle'); if (toggle) { set(toggle, 'aria-expanded', 'false'); toggle.focus(); } });
      var lang = document.getElementById('langDropdown');
      if (lang && lang.classList.contains('show')) { lang.classList.remove('show'); var button = document.getElementById('langBtn'); if (button) { set(button, 'aria-expanded', 'false'); button.focus(); } }
    }
    if (event.key === 'Tab' && activeDialog) {
      var items = Array.from(activeDialog.querySelectorAll(focusable)).filter(visible);
      var first = items[0] || activeDialog, last = items[items.length - 1] || activeDialog;
      if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    var target = event.target.closest('[role="button"][onclick]');
    if (target === event.target && (event.key === 'Enter' || event.key === ' ') && target.getAttribute('aria-disabled') !== 'true') { event.preventDefault(); target.click(); }
  }, true);
  function init() {
    var style = document.createElement('style');
    style.textContent = ':focus-visible{outline:3px solid #165dff!important;outline-offset:3px}[role="button"][tabindex="0"]{cursor:pointer}';
    document.head.appendChild(style);
    enhance();
    new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-lang'] });
    document.addEventListener('langchange', queue);
    document.addEventListener('transitionend', function (event) { if (['enquireModal', 'bookingOverlay', 'mobileMenu'].includes(event.target.id)) queue(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
