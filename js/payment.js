(function () {
  'use strict';

  var translations = {
    en: {
      help:'Need help?', secureCheckout:'Secure checkout', title:'Complete your order', subtitle:'Review your service package, enter your contact details and pay securely.',
      details:'Details', payment:'Payment', contactTitle:'Contact details', contactLead:'We will send the payment receipt and service follow-up to this email.',
      firstName:'First name', lastName:'Last name', email:'Email address', continue:'Continue to payment', paymentTitle:'Secure payment',
      paymentLead:'Available payment methods are shown based on your payment account and device.', loadingPayment:'Loading secure payment form...',
      secureNote:'Payment details are encrypted and handled by the selected payment provider.', back:'Back', pay:'Pay securely', processing:'Processing...',
      summary:'Order summary', hide:'Hide', show:'Show', subtotal:'Subtotal', discount:'Discount', total:'Total', discountLabel:'Discount code', apply:'Apply', remove:'Remove',
      required:'This field is required.', invalidEmail:'Enter a valid email address.', orderMissing:'Your order is empty or no longer supported. Please select a package again.',
      selectAgain:'Return to services', quoteUnavailable:'We could not verify this order. Please try again.', paymentUnavailable:'Payment is temporarily unavailable. Please contact us for assistance.',
      discountApplied:'Discount applied:', invalidDiscount:'This discount code is invalid or unavailable.', paymentFailed:'Payment could not be completed. Please try again.',
      cybsInstruction:'Complete the payment in the secure form below.',
      wechatScanHint:'Open WeChat on your phone and scan this code to pay', qrOpenInstructions:'Open payment instructions', cancelPayment:'Cancel payment', qrValidFor:'Code valid for {t}', qrExpired:'The QR code has expired. Please return and pay again.',
      line_incorporation_local_starter:'Hong Kong company incorporation - Local Starter', line_incorporation_non_hk_starter:'Hong Kong company incorporation - Non-Hong Kong Starter',
      line_secretary_standard:'Company secretary - Standard', line_secretary_premium:'Company secretary - Premium', line_secretary_extra_shareholder:'Additional shareholder service',
      line_registered_office:'Registered office address', line_audit_standard:'Audit package - Standard', line_audit_premium:'Audit package - Premium'
    },
    'zh-Hant': {
      help:'需要協助？', secureCheckout:'安全結賬', title:'完成您的訂單', subtitle:'確認服務方案、填寫聯絡資料並安全付款。',
      details:'資料', payment:'付款', contactTitle:'聯絡資料', contactLead:'付款收據及服務跟進將發送至此電郵地址。',
      firstName:'名字', lastName:'姓氏', email:'電郵地址', continue:'繼續付款', paymentTitle:'安全付款',
      paymentLead:'可用付款方式會根據您的付款帳戶及裝置顯示。', loadingPayment:'正在載入安全付款表格...',
      secureNote:'付款資料經加密並由所選付款服務商處理。', back:'返回', pay:'安全付款', processing:'處理中...',
      summary:'訂單摘要', hide:'收起', show:'展開', subtotal:'小計', discount:'折扣', total:'總額', discountLabel:'折扣碼', apply:'套用', remove:'移除',
      required:'此欄為必填。', invalidEmail:'請輸入有效的電郵地址。', orderMissing:'訂單為空或已不再支援，請重新選擇服務方案。',
      selectAgain:'返回服務頁面', quoteUnavailable:'未能驗證此訂單，請重試。', paymentUnavailable:'付款功能暫時無法使用，請聯絡我們尋求協助。',
      discountApplied:'已套用折扣：', invalidDiscount:'此折扣碼無效或目前不可使用。', paymentFailed:'未能完成付款，請重試。',
      cybsInstruction:'請在下方安全付款表格中完成付款。',
      wechatScanHint:'請使用手機微信掃描此二維碼付款', qrOpenInstructions:'開啟付款說明', cancelPayment:'取消付款', qrValidFor:'二維碼有效時間 {t}', qrExpired:'二維碼已過期，請返回重新付款。',
      line_incorporation_local_starter:'香港公司註冊 - 本地創業版', line_incorporation_non_hk_starter:'香港公司註冊 - 非香港居民創業版',
      line_secretary_standard:'公司秘書 - 標準版', line_secretary_premium:'公司秘書 - 高級版', line_secretary_extra_shareholder:'額外股東服務',
      line_registered_office:'註冊辦公地址', line_audit_standard:'審計方案 - 標準版', line_audit_premium:'審計方案 - 高級版'
    },
    'zh-Hans': {
      help:'需要协助？', secureCheckout:'安全结账', title:'完成您的订单', subtitle:'确认服务方案、填写联系资料并安全付款。',
      details:'资料', payment:'付款', contactTitle:'联系资料', contactLead:'付款收据及服务跟进将发送至此邮箱。',
      firstName:'名字', lastName:'姓氏', email:'邮箱地址', continue:'继续付款', paymentTitle:'安全付款',
      paymentLead:'可用付款方式会根据您的付款账户及设备显示。', loadingPayment:'正在加载安全付款表格...',
      secureNote:'付款资料经加密并由所选付款服务商处理。', back:'返回', pay:'安全付款', processing:'处理中...',
      summary:'订单摘要', hide:'收起', show:'展开', subtotal:'小计', discount:'折扣', total:'总额', discountLabel:'折扣码', apply:'应用', remove:'移除',
      required:'此栏为必填。', invalidEmail:'请输入有效的邮箱地址。', orderMissing:'订单为空或已不再支持，请重新选择服务方案。',
      selectAgain:'返回服务页面', quoteUnavailable:'未能验证此订单，请重试。', paymentUnavailable:'付款功能暂时无法使用，请联系我们寻求协助。',
      discountApplied:'已应用折扣：', invalidDiscount:'此折扣码无效或目前不可使用。', paymentFailed:'未能完成付款，请重试。',
      cybsInstruction:'请在下方安全付款表格中完成付款。',
      wechatScanHint:'请使用手机微信扫描此二维码付款', qrOpenInstructions:'开启付款说明', cancelPayment:'取消付款', qrValidFor:'二维码有效时间 {t}', qrExpired:'二维码已过期，请返回重新付款。',
      line_incorporation_local_starter:'香港公司注册 - 本地创业版', line_incorporation_non_hk_starter:'香港公司注册 - 非香港居民创业版',
      line_secretary_standard:'公司秘书 - 标准版', line_secretary_premium:'公司秘书 - 高级版', line_secretary_extra_shareholder:'额外股东服务',
      line_registered_office:'注册办公地址', line_audit_standard:'审计方案 - 标准版', line_audit_premium:'审计方案 - 高级版'
    }
  };

  var state = {
    lang: 'en', order: null, quote: null, discountCode: '', step: 1, gateway: null,
    stripe: null, stripeElements: null, stripePaymentElement: null, stripeIntentId: null, stripeClientSecret: null,
    paymentReady: false, paymentBusy: false, cyberCheckout: null, cyberMountStarted: false, cyberCheckoutToken: null,
    idempotencyKey: null, qrPollTimer: null, qrCountdownTimer: null, qrDeadline: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  function t(key) { return (translations[state.lang] && translations[state.lang][key]) || translations.en[key] || key; }
  function money(value) { return new Intl.NumberFormat(state.lang === 'en' ? 'en-HK' : 'zh-HK', { style:'currency', currency:'HKD', maximumFractionDigits:0 }).format(Number(value) || 0); }

  function readJson(storage, key) {
    try { return JSON.parse(storage.getItem(key) || '{}') || {}; } catch (error) { return {}; }
  }

  function normalizePlan(value) { return String(value || '').trim().toLowerCase(); }

  function buildOrderFromStorage() {
    var inc = readJson(localStorage, 'leap-package-inc');
    var cs = readJson(localStorage, 'leap-package-cs');
    var marker = sessionStorage.getItem('leap-checkout-flow');

    if (marker === 'company_secretary' || (!inc.incorporationPlan && cs.csPlan)) {
      var csPlan = normalizePlan(cs.csPlan);
      if (csPlan !== 'standard' && csPlan !== 'premium') return null;
      var auditPlan = normalizePlan(cs.csAuditPlan);
      return {
        flow: 'company_secretary',
        secretary: { plan: csPlan, shareholders: Number(cs.csShareholders || 1) },
        audit: auditPlan && auditPlan !== 'skipped' ? { plan: auditPlan } : null
      };
    }

    if (normalizePlan(inc.incorporationPlan) !== 'starter') return null;
    var source = normalizePlan(inc.incorporationSource);
    var residency = source.indexOf('foreigner') !== -1 || Number(inc.incorporationPrice) === 8500 ? 'non_hk' : 'local';
    var secretaryPlan = normalizePlan(inc.secretaryPlan);
    var secretary = null;
    if (secretaryPlan === 'standard' || secretaryPlan === 'premium') {
      secretary = { plan: secretaryPlan, shareholders: Number(inc.shareholderCount || 1) };
    }
    return {
      flow: 'incorporation',
      incorporation: { residency: residency, plan: 'starter' },
      secretary: secretary,
      registeredOffice: inc.hasOfficeAddress === true || cs.hasOfficeAddress === true
    };
  }

  async function api(path, options) {
    var response = await fetch(path, options);
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || 'Request failed');
      error.code = data.code;
      throw error;
    }
    return data;
  }

  async function requestQuote(discountCode) {
    return api('/api/quote-order', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ order:state.order, discount_code:discountCode || '' })
    });
  }

  function renderQuote() {
    var container = $('summaryLines');
    container.innerHTML = '';
    if (!state.quote) return;
    state.quote.lineItems.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'summary-row';
      var label = document.createElement('span');
      label.textContent = t('line_' + item.code) + (item.quantity > 1 ? ' × ' + item.quantity : '');
      var amount = document.createElement('strong');
      amount.textContent = money(item.total);
      row.append(label, amount);
      container.appendChild(row);
    });
    $('subtotalValue').textContent = money(state.quote.subtotal);
    $('totalValue').textContent = money(state.quote.total);
    $('mobileTotal').textContent = money(state.quote.total);
    $('discountRow').classList.toggle('hidden', !state.quote.discountAmount);
    $('discountValue').textContent = '-' + money(state.quote.discountAmount);
    updatePayLabels();
  }

  function applyLanguage(lang) {
    if (!translations[lang]) lang = 'en';
    state.lang = lang;
    document.documentElement.lang = lang === 'zh-Hant' ? 'zh-HK' : lang === 'zh-Hans' ? 'zh-CN' : 'en';
    document.documentElement.setAttribute('data-lang', lang);
    $('languageSelect').value = lang;
    try { localStorage.setItem('leap-lang', lang); } catch (error) {}
    try { var _u = new URL(window.location.href); _u.searchParams.set('lang', lang); window.history.replaceState({}, '', _u); } catch (error) {}
    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      element.textContent = t(element.getAttribute('data-i18n'));
    });
    $('firstName').placeholder = state.lang === 'en' ? 'Alan' : '名字';
    $('lastName').placeholder = state.lang === 'en' ? 'Lai' : '姓氏';
    $('email').placeholder = state.lang === 'en' ? 'name@example.com' : 'name@example.com';
    $('discountCode').placeholder = state.lang === 'en' ? 'Enter code' : state.lang === 'zh-Hant' ? '輸入折扣碼' : '输入折扣码';
    renderQuote();
    if (state.discountCode) $('discountAppliedText').textContent = t('discountApplied') + ' ' + state.discountCode;
  }

  function showOrderError(message) {
    $('orderError').innerHTML = '';
    var text = document.createElement('span');
    text.textContent = message;
    var spacer = document.createTextNode(' ');
    var link = document.createElement('a');
    link.href = '/pages/pricing.html';
    link.textContent = t('selectAgain');
    link.style.color = 'inherit';
    link.style.fontWeight = '800';
    $('orderError').append(text, spacer, link);
    $('orderError').classList.remove('hidden');
    $('detailsForm').querySelectorAll('input,button').forEach(function (element) { element.disabled = true; });
  }

  function validateField(input, errorId) {
    var error = '';
    if (!input.value.trim()) error = t('required');
    else if (input.type === 'email' && !input.validity.valid) error = t('invalidEmail');
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    $(errorId).textContent = error;
    return !error;
  }

  function validateDetails(showErrors) {
    var fields = [[$('firstName'),'firstNameError'],[$('lastName'),'lastNameError'],[$('email'),'emailError']];
    var valid = fields.every(function (entry) {
      if (!showErrors && !entry[0].value.trim()) return false;
      return validateField(entry[0], entry[1]);
    });
    $('continueButton').disabled = !valid || !state.quote;
    return valid && Boolean(state.quote);
  }

  function customer() {
    return { name: ($('firstName').value.trim() + ' ' + $('lastName').value.trim()).trim(), email: $('email').value.trim() };
  }

  function updateSteps(step) {
    state.step = step;
    $('stepOne').className = 'step ' + (step === 1 ? 'active' : 'done');
    $('stepOne').querySelector('.step-dot').textContent = step === 1 ? '1' : '✓';
    $('stepTwo').className = 'step ' + (step === 2 ? 'active' : '');
    $('detailsForm').classList.toggle('hidden', step !== 1);
    $('paymentStep').classList.toggle('hidden', step !== 2);
    $('mobilePaybar').classList.toggle('visible', step === 2);
    $('discountCode').disabled = step === 2;
    $('applyDiscount').disabled = step === 2;
    $('removeDiscount').disabled = step === 2;
    sessionStorage.setItem('leap-checkout-step', String(step));
  }

  function updatePayLabels() {
    var label = state.paymentBusy ? t('processing') : t('pay') + (state.quote ? ' ' + money(state.quote.total) : '');
    $('payButton').textContent = label;
    $('mobilePayButton').textContent = label;
  }

  function setPayEnabled(enabled) {
    state.paymentReady = enabled;
    $('payButton').disabled = !enabled || state.paymentBusy;
    $('mobilePayButton').disabled = !enabled || state.paymentBusy;
  }

  function setBusy(busy) {
    state.paymentBusy = busy;
    setPayEnabled(state.paymentReady);
    updatePayLabels();
  }

  function paymentError(message) {
    $('paymentError').textContent = message || t('paymentFailed');
    $('paymentError').classList.remove('hidden');
  }

  function localeForStripe() {
    return state.lang === 'zh-Hant' ? 'zh-HK' : state.lang === 'zh-Hans' ? 'zh' : 'en';
  }

  function makeIdempotencyKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  async function initializeStripe(config) {
    if (!window.Stripe || !config.stripePublishableKey) throw new Error(t('paymentUnavailable'));
    state.idempotencyKey = makeIdempotencyKey();
    var intent = await api('/api/create-stripe-intent', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        order:state.order, discount_code:state.discountCode, customer:customer(), locale:state.lang,
        idempotency_key:state.idempotencyKey
      })
    });
    state.quote = intent.quote;
    state.stripeIntentId = intent.payment_intent_id;
    state.stripeClientSecret = intent.client_secret;
    renderQuote();
    sessionStorage.setItem('leap-stripe-payment-id', state.stripeIntentId);
    sessionStorage.setItem('leap-stripe-client-secret', state.stripeClientSecret);
    state.stripe = Stripe(config.stripePublishableKey);
    state.stripeElements = state.stripe.elements({
      clientSecret:intent.client_secret,
      locale:localeForStripe(),
      appearance:{ theme:'stripe', variables:{ colorPrimary:'#145ddb', borderRadius:'6px', fontFamily:'Inter, system-ui, sans-serif' } }
    });
    state.stripePaymentElement = state.stripeElements.create('payment', {
      layout:{ type:'tabs', defaultCollapsed:false }
    });
    $('stripePaymentElement').classList.remove('hidden');
    state.stripePaymentElement.on('ready', function () {
      $('paymentLoader').classList.add('hidden');
      setPayEnabled(true);
    });
    state.stripePaymentElement.on('loaderror', function () {
      $('paymentLoader').classList.add('hidden');
      paymentError(t('paymentUnavailable'));
    });
    state.stripePaymentElement.mount('#stripePaymentElement');
  }

  var cyberHosts = new Set(['flex.cybersource.com','testflex.cybersource.com','flex.test.cybersource.com','testup.cybersource.com','up.cybersource.com']);
  function loadCyberSourceSdk(captureContext) {
    return new Promise(function (resolve, reject) {
      try {
        var part = captureContext.split('.')[1];
        var payload = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(part.length + ((4 - part.length % 4) % 4), '=')));
        var data = payload.ctx && payload.ctx[0] && payload.ctx[0].data || {};
        var library = new URL(data.clientLibrary);
        if (library.protocol !== 'https:' || !cyberHosts.has(library.hostname)) throw new Error('Invalid CyberSource library URL');
        var script = document.createElement('script');
        script.src = library.href;
        if (data.clientLibraryIntegrity) { script.integrity = data.clientLibraryIntegrity; script.crossOrigin = 'anonymous'; }
        script.onload = resolve;
        script.onerror = function () { reject(new Error(t('paymentUnavailable'))); };
        document.head.appendChild(script);
      } catch (error) { reject(error); }
    });
  }

  async function initializeCyberSource() {
    var session = await api('/api/create-payment-intent', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ order:state.order, discount_code:state.discountCode, customer:customer(), locale:state.lang })
    });
    state.quote = session.quote;
    state.cyberCheckoutToken = session.checkout_token;
    renderQuote();
    await loadCyberSourceSdk(session.captureContext);
    if (!window.VAS) throw new Error(t('paymentUnavailable'));
    var client = await VAS.UnifiedCheckout(session.captureContext);
    state.cyberCheckout = await client.createCheckout({ autoProcessing:false });
    $('paymentLoader').classList.add('hidden');
    $('cybersourcePaymentElement').classList.remove('hidden');
    $('paymentLead').textContent = t('cybsInstruction');
    state.cyberMountStarted = true;
    state.cyberCheckout.mount('#cybersourcePaymentElement').then(completeCyberSource).catch(function (error) {
      paymentError(error.message || t('paymentFailed'));
    });
    setPayEnabled(false);
  }

  async function completeCyberSource(transientToken) {
    setBusy(true);
    try {
      var completeResponse = await state.cyberCheckout.complete(transientToken);
      var result = await api('/api/process-payment', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ completeResponse:completeResponse, checkout_token:state.cyberCheckoutToken, locale:state.lang })
      });
      routePaymentResult(result);
    } catch (error) {
      setBusy(false);
      paymentError(error.message || t('paymentFailed'));
    }
  }

  async function initializePayment() {
    $('gatewayUnavailable').classList.add('hidden');
    $('paymentError').classList.add('hidden');
    $('paymentLoader').classList.remove('hidden');
    setPayEnabled(false);
    try {
      var config = await api('/api/payment-config');
      state.gateway = config.gateway;
      if (!config.available) throw new Error(t('paymentUnavailable'));
      if (config.gateway === 'stripe') await initializeStripe(config);
      else if (config.gateway === 'cybersource') await initializeCyberSource();
      else throw new Error(t('paymentUnavailable'));
    } catch (error) {
      $('paymentLoader').classList.add('hidden');
      $('gatewayUnavailable').textContent = error.message || t('paymentUnavailable');
      $('gatewayUnavailable').classList.remove('hidden');
      setPayEnabled(false);
    }
  }

  async function confirmStripe() {
    if (!state.stripe || !state.stripeElements || !state.paymentReady || state.paymentBusy) return;
    setBusy(true);
    $('paymentError').classList.add('hidden');
    try {
      var submitted = await state.stripeElements.submit();
      if (submitted.error) throw new Error(submitted.error.message);
      var returnUrl = window.location.origin + '/pages/stripe-return.html';
      var result = await state.stripe.confirmPayment({
        elements:state.stripeElements,
        confirmParams:{ return_url:returnUrl },
        redirect:'if_required'
      });
      if (result.error) throw new Error(result.error.message);
      if (result.paymentIntent) {
        // 微信支付：confirmPayment 不重定向而是返回等待扫码的 PaymentIntent，
        // 取出二维码在页内展示并轮询结果
        var nextAction = result.paymentIntent.next_action;
        var wechatQr = nextAction && (nextAction.wechat_pay_display_qr_code ||
          (nextAction.type === 'wechat_pay_display_qr_code' ? nextAction : null));
        if (result.paymentIntent.status === 'requires_action' && wechatQr) {
          showWechatQr(wechatQr.image_data_url || wechatQr.qr_code || '',
            wechatQr.hosted_instructions_url || '', wechatQr.expires_at || null);
          pollWechatPayment();
          return;
        }
        var verified = await api('/api/confirm-stripe-payment', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ payment_intent_id:result.paymentIntent.id, payment_intent_client_secret:state.stripeClientSecret })
        });
        routePaymentResult(verified);
      }
    } catch (error) {
      setBusy(false);
      paymentError(error.message || t('paymentFailed'));
    }
  }

  // ===== 微信支付二维码：页内展示 + 状态轮询 =====
  var WECHAT_QR_TIMEOUT_MS = 15 * 60 * 1000; // 最长等待 15 分钟
  var WECHAT_POLL_INTERVAL_MS = 3000;

  function clearQrTimers() {
    if (state.qrPollTimer) { clearTimeout(state.qrPollTimer); state.qrPollTimer = null; }
    if (state.qrCountdownTimer) { clearInterval(state.qrCountdownTimer); state.qrCountdownTimer = null; }
  }

  function showWechatQr(imageUrl, hostedUrl, expiresAt) {
    var overlay = $('wechatQrOverlay');
    if (!overlay) return;
    if (imageUrl) $('wechatQrImage').src = imageUrl;
    $('qrAmount').textContent = state.quote ? money(state.quote.total) : '';
    var hostedLink = $('qrHostedLink');
    if (/^https:\/\//.test(String(hostedUrl || ''))) {
      hostedLink.href = hostedUrl;
      hostedLink.classList.remove('hidden');
    } else {
      hostedLink.classList.add('hidden');
    }
    overlay.classList.remove('hidden');
    // 倒计时：取二维码过期时间与 15 分钟上限中较早者
    var deadline = Date.now() + WECHAT_QR_TIMEOUT_MS;
    if (expiresAt && expiresAt * 1000 > Date.now() && expiresAt * 1000 < deadline) deadline = expiresAt * 1000;
    state.qrDeadline = deadline;
    var timerEl = $('qrTimer');
    var renderCountdown = function () {
      var left = Math.max(0, Math.floor((state.qrDeadline - Date.now()) / 1000));
      var mm = String(Math.floor(left / 60)).padStart(2, '0');
      var ss = String(left % 60).padStart(2, '0');
      timerEl.textContent = t('qrValidFor').replace('{t}', mm + ':' + ss);
      if (left <= 0) { expireWechatQr(); return; }
    };
    renderCountdown();
    state.qrCountdownTimer = setInterval(renderCountdown, 1000);
  }

  function hideWechatQr() {
    clearQrTimers();
    var overlay = $('wechatQrOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function cancelWechatQr() {
    hideWechatQr();
    setBusy(false);
  }

  function expireWechatQr() {
    hideWechatQr();
    setBusy(false);
    paymentError(t('qrExpired'));
  }

  function pollWechatPayment() {
    var attempts = 0;
    var maxAttempts = Math.ceil(WECHAT_QR_TIMEOUT_MS / WECHAT_POLL_INTERVAL_MS);
    var pollOnce = function () {
      api('/api/confirm-stripe-payment', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ payment_intent_id:state.stripeIntentId, payment_intent_client_secret:state.stripeClientSecret })
      }).then(function (result) {
        if (result.status === 'succeeded') { hideWechatQr(); routePaymentResult(result); return; }
        if (result.status === 'failed') {
          hideWechatQr(); setBusy(false);
          paymentError(result.failure_message || t('paymentFailed'));
          return;
        }
        // requires_action / processing：继续等待扫码
        attempts += 1;
        if (attempts < maxAttempts) state.qrPollTimer = setTimeout(pollOnce, WECHAT_POLL_INTERVAL_MS);
        else expireWechatQr();
      }).catch(function () {
        attempts += 1;
        if (attempts < 5) state.qrPollTimer = setTimeout(pollOnce, WECHAT_POLL_INTERVAL_MS);
        else expireWechatQr();
      });
    };
    pollOnce();
  }

  function routePaymentResult(result) {
    if (result.status === 'succeeded' && result.receipt_token) {
      sessionStorage.removeItem('leap-checkout-step');
      window.location.href = '/pages/confirmation.html#receipt=' + encodeURIComponent(result.receipt_token);
      return;
    }
    if (result.status === 'processing' || result.status === 'requires_action' || result.status === 'pending') {
      var statusParams = new URLSearchParams({
        payment_intent: result.payment_id || state.stripeIntentId || '',
        payment_intent_client_secret: state.stripeClientSecret || ''
      });
      window.location.href = '/pages/stripe-return.html?' + statusParams.toString();
      return;
    }
    var params = new URLSearchParams({ reason:result.failure_message || t('paymentFailed'), amount:String(state.quote.total), lang:state.lang });
    window.location.href = '/pages/payment-failed.html?' + params.toString();
  }

  function destroyPaymentForm() {
    if (state.stripePaymentElement) {
      try { state.stripePaymentElement.destroy(); } catch (error) {}
    }
    state.stripe = null;
    state.stripeElements = null;
    state.stripePaymentElement = null;
    state.stripeIntentId = null;
    state.stripeClientSecret = null;
    state.cyberCheckoutToken = null;
    state.paymentReady = false;
    state.paymentBusy = false;
    state.gateway = null;
    $('stripePaymentElement').innerHTML = '';
    $('stripePaymentElement').classList.add('hidden');
    $('cybersourcePaymentElement').innerHTML = '';
    $('cybersourcePaymentElement').classList.add('hidden');
    $('paymentLead').textContent = t('paymentLead');
    updatePayLabels();
  }

  async function applyDiscount() {
    var code = $('discountCode').value.trim().toUpperCase();
    if (!code) return;
    $('applyDiscount').disabled = true;
    $('discountMessage').className = 'discount-message';
    $('discountMessage').textContent = '';
    try {
      state.quote = await requestQuote(code);
      state.discountCode = state.quote.discountCode;
      $('discountEntry').classList.add('hidden');
      $('discountApplied').classList.remove('hidden');
      $('discountAppliedText').textContent = t('discountApplied') + ' ' + state.discountCode;
      $('discountMessage').className = 'discount-message success';
      renderQuote();
    } catch (error) {
      $('discountMessage').className = 'discount-message error';
      $('discountMessage').textContent = error.message || t('invalidDiscount');
    } finally {
      $('applyDiscount').disabled = state.step === 2;
    }
  }

  async function removeDiscount() {
    try {
      state.quote = await requestQuote('');
      state.discountCode = '';
      $('discountCode').value = '';
      $('discountEntry').classList.remove('hidden');
      $('discountApplied').classList.add('hidden');
      $('discountMessage').textContent = '';
      renderQuote();
    } catch (error) {
      $('discountMessage').className = 'discount-message error';
      $('discountMessage').textContent = t('quoteUnavailable');
    }
  }

  async function start() {
    try { state.lang = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('leap-lang') || 'en'; } catch (error) {}
    applyLanguage(state.lang);
    if (window.matchMedia('(max-width: 800px)').matches) {
      $('summaryBody').classList.add('collapsed');
      $('summaryToggle').setAttribute('aria-expanded', 'false');
      $('summaryToggle').textContent = t('show');
    }
    state.order = buildOrderFromStorage();
    var draft = readJson(sessionStorage, 'leap-checkout-customer');
    $('firstName').value = draft.firstName || '';
    $('lastName').value = draft.lastName || '';
    $('email').value = draft.email || '';
    if (!state.order) {
      showOrderError(t('orderMissing'));
      return;
    }
    try {
      state.quote = await requestQuote('');
      renderQuote();
      validateDetails(false);
      if (sessionStorage.getItem('leap-checkout-step') === '2' && validateDetails(false)) {
        updateSteps(2);
        initializePayment();
      }
    } catch (error) {
      showOrderError(error.message || t('quoteUnavailable'));
    }
  }

  $('languageSelect').addEventListener('change', function () { applyLanguage(this.value); validateDetails(false); });
  ['firstName','lastName','email'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      if (this.getAttribute('aria-invalid') === 'true') validateDetails(true); else validateDetails(false);
    });
    $(id).addEventListener('blur', function () { validateDetails(true); });
  });
  $('detailsForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!validateDetails(true)) return;
    sessionStorage.setItem('leap-checkout-customer', JSON.stringify({ firstName:$('firstName').value.trim(), lastName:$('lastName').value.trim(), email:$('email').value.trim() }));
    updateSteps(2);
    initializePayment();
  });
  $('backButton').addEventListener('click', function () { destroyPaymentForm(); updateSteps(1); $('firstName').focus(); });
  $('payButton').addEventListener('click', function () { if (state.gateway === 'stripe') confirmStripe(); });
  var qrCancelButton = $('qrCancel');
  if (qrCancelButton) qrCancelButton.addEventListener('click', cancelWechatQr);
  $('mobilePayButton').addEventListener('click', function () { if (state.gateway === 'stripe') confirmStripe(); });
  $('applyDiscount').addEventListener('click', applyDiscount);
  $('discountCode').addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); applyDiscount(); } });
  $('removeDiscount').addEventListener('click', removeDiscount);
  $('summaryToggle').addEventListener('click', function () {
    var collapsed = $('summaryBody').classList.toggle('collapsed');
    this.setAttribute('aria-expanded', String(!collapsed));
    this.textContent = collapsed ? t('show') : t('hide');
  });

  start();
})();
