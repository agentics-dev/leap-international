const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load,textNodes}=require('./helpers/site-page.cjs');
const toSimplified=require('opencc-js').Converter({from:'hk',to:'cn'});
const tick=()=>new Promise(r=>setImmediate(r));
const files=['index.html',...fs.readdirSync('pages').filter(x=>x.endsWith('.html')).map(x=>'pages/'+x)];

test('all 38 pages load in each language without leaked Chinese in English or traditional text in Simplified',async()=>{
 for(const file of files)for(const lang of ['en','zh-Hant','zh-Hans']){
  const {dom,errors}=await load(file,lang);
  try{
   assert.deepEqual(errors,[],file+'/'+lang);
   for(const node of textNodes(dom.window)){
    if(lang==='en')assert.doesNotMatch(node.text,/[\u3400-\u9fff]/,file+':'+node.at);
    if(lang==='zh-Hans')assert.equal(node.text,toSimplified(node.text),file+':'+node.at);
    if(lang==='zh-Hant')assert.doesNotMatch(node.text,/基本会计入账|协助开发票|协助开支票|支援计算薪金/,file+':'+node.at);
    if(lang!=='en')assert.doesNotMatch(node.text,/\/yr|\/mo\b|\/year|Step 0|We'll be in touch|Please reselect|Please enter actual/,file+':'+node.at);
   }
  }finally{dom.window.close()}
 }
});

test('custom quotes and booking calendar retranslate in place',async()=>{
 for(const [slug,selector,fn,priceId] of [['accounting','#accountingExpenseOptions [data-value="100k+"]','selectAccountingExpense','basicPrice'],['sales-invoice','#siExpenseOptions [data-value="100k+"]','selectSIExpense','siBasicPrice'],['bookkeeping','#bookkeepingExpenseOptions [data-value="400k+"]',null,'basicPrice']]){
  const {dom}=await load('pages/'+slug+'.html','en');const w=dom.window;
  try{
   const option=w.document.querySelector(selector);
   if(fn)w[fn](option);else w.Function(option.getAttribute('onclick')).call(option);
   for(const [lang,expected]of [['zh-Hant','定制報價'],['zh-Hans','定制报价'],['en','Custom']]){
    w.setLang(lang);await tick();assert.equal(w.document.getElementById(priceId).textContent,expected,slug);
   }
  }finally{w.close()}
 }
 for(const file of ['index.html','pages/select-checkout-option.html']){
  const {dom}=await load(file,'en');const w=dom.window;
  try{
   w.openBookingModal();
   w.selectedDate=new w.Date(2027,0,12);w.selectedSlot={h:11,m:0};
   for(const lang of ['zh-Hant','zh-Hans','en']){
    w.setLang(lang);await tick();
    const month=w.document.getElementById('calMonthLabel').textContent;
    assert.equal(/月/.test(month),lang!=='en');
    const date=w.document.getElementById('timeSlotsDateLabel').textContent;
    if(lang!=='en')assert.doesNotMatch(date,/January|Tuesday|Beijing/);
    assert.ok(w.selectedSlot);assert.equal(w.document.getElementById('bookNowBtn').classList.contains('hidden'),false);
   }
  }finally{w.close()}
 }
});

test('news has a simplified body, localized dates, and correct titles after language changes',async()=>{
 for(const file of ['pages/news.html','pages/news-detail.html']){
  const {dom,errors}=await load(file,'zh-Hans');const w=dom.window;
  try{
   assert.deepEqual(errors,[]);
   const title=w.document.querySelector(file.includes('news-detail')?'#article-title .lang-zh-Hans':'#news-container h3 .lang-zh-Hans');
   assert.equal(title.textContent,'公司注册与财务指南');
   if(file.includes('news-detail')){
    assert.equal(w.document.querySelector('#article-content .lang-zh-Hans').textContent,'公司注册与财务记录。');
    for(const [lang,title]of [['en','Company registration guide'],['zh-Hant','公司註冊與財務指南'],['zh-Hans','公司注册与财务指南']]){
     w.setLang(lang);await tick();assert.equal(w.document.title,title+' | Leap International');
     assert.equal(w.document.querySelector('meta[property="og:title"]').content,title+' | Leap International');
     assert.equal(w.document.querySelector('link[rel="canonical"]').href,'https://leapcorpser.com/pages/news-detail?slug=local-fixture');
    }
    const html=w.simplifiedArticleHtml('<p onclick="bad()">財務<a href="https://example.com/財務">記錄</a><script>bad()</script></p>');
    assert.doesNotMatch(html,/onclick|<script/);assert.match(html,/href="https:\/\/example.com\/財務"/);assert.match(html,/>记录</);
   }
  }finally{w.close()}
 }
});

test('bank buttons and checkout errors follow live language changes',async()=>{
 const bank=await load('pages/select-bank-partner.html','zh-Hans');
 try{bank.dom.window.selectBank('aspire');assert.equal(bank.dom.window.document.querySelector('#nextBtn .lang-zh-Hans').textContent,'选择 Aspire')}finally{bank.dom.window.close()}
 const {dom}=await load('pages/payment.html','en',{fetch:async()=>Response.json({error:'English server error',code:'UNKNOWN_ORDER_FLOW'},{status:400})});const w=dom.window;
 try{
  for(const lang of ['zh-Hant','zh-Hans','en']){
   const select=w.document.getElementById('languageSelect');select.value=lang;select.dispatchEvent(new w.Event('change'));await tick();
   const text=w.document.getElementById('orderError').textContent;assert.doesNotMatch(text,/English server error/);
   if(lang==='en')assert.match(text,/verify/);else assert.match(text,/訂單|订单/);
  }
 }finally{w.close()}
});

test('delayed payment verification errors stay localized after retries',async()=>{
 for(const lang of ['en','zh-Hant','zh-Hans']){
  const {dom}=await load('pages/stripe-return.html',lang,{sessionStorage:{'leap-stripe-payment-id':'pi_local_mock','leap-stripe-client-secret':'local_mock'},fastTimers:true,fetch:async()=>Response.json({error:'Internal English gateway error'},{status:503})});
  try{
   await tick();await tick();
   const text=dom.window.document.getElementById('message').textContent;
   assert.doesNotMatch(text,/Internal English/);
   assert.match(text,lang==='en'?/checkout/:/結賬|结账/);
   assert.equal(dom.window.document.getElementById('actions').classList.contains('hidden'),false);
  }finally{dom.window.close()}
 }
});
