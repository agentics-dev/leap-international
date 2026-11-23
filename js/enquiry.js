(function () {
  'use strict';

  var messages = {
    invalid: ['Please complete the required fields with a valid email address.', '請填妥必填資料及有效的電郵地址。', '请填妥必填资料及有效的邮箱地址。'],
    sending: ['Sending your message…', '正在發送訊息…', '正在发送讯息…'],
    success: ['Message sent. Our team will contact you shortly.', '訊息已送出，我們的團隊將盡快與您聯繫。', '讯息已送出，我们的团队将尽快与您联系。'],
    failed: ['Your message could not be sent. Please try again, or email info@leapcorpser.com.', '訊息未能送出，請重試或電郵至 info@leapcorpser.com。', '讯息未能送出，请重试或发送邮件至 info@leapcorpser.com。']
  };

  function showStatus(form, key) {
    var status = form.querySelector('[data-enquiry-status]');
    if (!status) {
      status = document.createElement('p');
      status.setAttribute('data-enquiry-status', '');
      status.setAttribute('role', 'status');
      status.style.cssText = 'margin-top:12px;font-size:14px;line-height:1.5;overflow-wrap:anywhere';
      form.appendChild(status);
    }
    status.dataset.statusKey = key;
    status.style.color = key === 'success' ? '#047857' : '#374151';
    status.textContent = window.leapText.apply(null, messages[key]);
  }

  function value(form, selectors) {
    var field = form.querySelector(selectors);
    return field ? field.value.trim() : '';
  }

  window.submitLeapEnquiry = async function (form) {
    if (form.dataset.sending === 'true') return;
    var contact = form.id === 'contactForm';
    var name = contact ? value(form, '#nameInput') : value(form, '#enqFirstName, #enquireFirstName') + ' ' + value(form, '#enqLastName, #enquireLastName');
    var phone = value(form, '#enqPhone, #enquirePhone');
    var payload = {
      name: name.trim(),
      email: value(form, '#emailInput, #enqEmail, #enquireEmail'),
      phone: phone ? value(form, '#enqPhoneCode, select') + ' ' + phone : '',
      service: value(form, '#serviceInput'),
      message: value(form, '#messageInput, #enqMessage, #enquireMessage'),
      source: window.location.pathname,
      website: value(form, '[name="website"]')
    };
    var requiredMissing = Array.from(form.querySelectorAll('[required]')).some(function (field) { return !field.value.trim(); });
    if (requiredMissing || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      showStatus(form, 'invalid');
      form.reportValidity();
      return;
    }
    var serialized = JSON.stringify(payload);
    if (form.dataset.enquiryPayload !== serialized) {
      form.dataset.enquiryPayload = serialized;
      form.dataset.enquiryRequest = crypto.randomUUID();
    }
    payload.requestId = form.dataset.enquiryRequest;
    var button = form.querySelector('button[type="submit"]');
    form.dataset.sending = 'true';
    button.disabled = true;
    showStatus(form, 'sending');
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Enquiry not accepted');
      form.reset();
      delete form.dataset.enquiryPayload;
      delete form.dataset.enquiryRequest;
      showStatus(form, 'success');
    } catch (error) {
      showStatus(form, 'failed');
    } finally {
      clearTimeout(timeout);
      form.dataset.sending = 'false';
      button.disabled = false;
    }
  };

  document.addEventListener('langchange', function () {
    document.querySelectorAll('[data-enquiry-status]').forEach(function (status) {
      showStatus(status.closest('form'), status.dataset.statusKey);
    });
  });
})();
