const fs=require('fs'),{JSDOM,VirtualConsole}=require('jsdom');
const {quoteOrder}=require('../../functions/_order-validation');
const tick=()=>new Promise(r=>setImmediate(r));
const fixture={id:'local-fixture',slug:'local-fixture',title_en:'Company registration guide',title_zh:'公司註冊與財務指南',excerpt_en:'Accounting services and records.',excerpt_zh:'會計服務與財務記錄。',content_en:'<p>Company registration guide.</p>',content_zh:'<p>公司註冊與財務記錄。</p>',publish_time:'2026-11-04T01:00:00Z'};
async function load(file,lang,options={}){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/navigation to another Document/.test(e.message))errors.push(e.message)});
 const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url:`http://localhost:3001/${file}?lang=${lang}&slug=local-fixture#receipt=mock`,runScripts:'outside-only',virtualConsole:vc});const w=dom.window;
 w.tailwind={};w.matchMedia=()=>({matches:false});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.scrollTo=()=>{};w.alert=m=>errors.push('ALERT:'+m);
 w.localStorage.setItem('leap-package-inc',JSON.stringify({incorporationPlan:'Starter',incorporationSource:'incorporation-foreigners',secretaryPlan:'premium',shareholderCount:4}));
 w.localStorage.setItem('leap-package-cs',JSON.stringify({csCompanyName:'Local Test',csPlan:'premium',csShareholders:4,csAnnualReturnsHelp:'yes',csAnnualReturnsYears:'5',csAccountingExpense:'0-10k',csEmployerReturns:'yes',csAuditPlan:'revenue',csAuditRevenueBand:'500k_to_2m'}));
 if(options.sessionStorage)for(const [key,value] of Object.entries(options.sessionStorage))w.sessionStorage.setItem(key,value);
 if(options.fastTimers)w.setTimeout=fn=>{Promise.resolve().then(fn);return 0};
 w.fetch=options.fetch || (async(url,opts)=>{
  if(url.startsWith('/api/news-detail'))return Response.json({item:fixture,...fixture});
  if(url.startsWith('/api/news'))return Response.json({data:[fixture],count:1});
  if(url==='/api/quote-order')return Response.json(quoteOrder(JSON.parse(opts.body).order));
  if(url==='/api/payment-config')return Response.json({available:false,gateway:'stripe'});
  if(url==='/api/verify-payment-receipt')return Response.json({verified:true,receipt:{amount:6500,currency:'USD',customerName:'Local Test',method:'card'}});
  return Response.json({error:'Local audit: unavailable',verified:false},{status:503});
 });
 for(const script of [...w.document.scripts]){
  if(script.type && script.type!=='text/javascript')continue;
  const src=script.getAttribute('src');
  try{
   if(src?.startsWith('/js/'))w.eval(fs.readFileSync(src.startsWith('/js/opencc')?'node_modules/opencc-js/dist/umd/t2cn.js':src.split('?')[0].slice(1),'utf8'));
   else if(!src)w.eval(script.textContent);
  }catch(e){errors.push(e.stack)}
 }
 await tick();await tick();
 return {dom,errors};
}
function textNodes(w){const found=[];const walker=w.document.createTreeWalker(w.document.body,4);let n;
 while(n=walker.nextNode()){
  const p=n.parentElement;if(!p||p.closest('script,style,svg,.material-symbols-outlined,#langDropdown,#languageSelect,#langLabel,#langFlag'))continue;
  let el=p,visible=true;const lang=w.document.documentElement.dataset.lang||new URL(w.location.href).searchParams.get('lang');
  while(el){if(el.classList?.contains('lang-en')&&lang!=='en'||el.classList?.contains('lang-zh')&&lang!=='zh-Hant'||el.classList?.contains('lang-zh-Hans')&&lang!=='zh-Hans'||el.style.display==='none'||el.classList?.contains('hidden')){visible=false;break}el=el.parentElement;}
  if(!visible)continue;const value=n.textContent.replace(/\s+/g,' ').trim();if(value)found.push({text:value,at:p.tagName+(p.id?'#'+p.id:'')});
 }return found;
}
module.exports={load,textNodes,fixture};
