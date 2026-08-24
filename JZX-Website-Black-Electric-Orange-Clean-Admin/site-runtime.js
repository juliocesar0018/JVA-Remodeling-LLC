(() => {
  'use strict';
  const STORAGE_KEY = 'jzx-site-settings-v1';
  const DB_NAME = 'jzx-site-assets';
  const STORE_NAME = 'images';

  const deepMerge = (base, extra) => {
    if (Array.isArray(base)) return Array.isArray(extra) ? extra.map((v,i)=>deepMerge(base[i] ?? {}, v)) : base;
    if (base && typeof base === 'object') {
      const out = {...base};
      if (extra && typeof extra === 'object') Object.keys(extra).forEach(k => out[k] = deepMerge(base[k], extra[k]));
      return out;
    }
    return extra === undefined ? base : extra;
  };
  let settings = window.JZX_DEFAULTS || {};
  const loadSettings = async () => {
    let local = {};
    try { local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}

    // Local data is only a fallback if Firebase is unavailable.
    let merged = deepMerge(window.JZX_DEFAULTS || {}, local);

    try {
      if (window.JZXCloud?.enabled?.()) {
        window.JZXCloud.init();
        const remote = await window.JZXCloud.loadSettings();

        // On the PUBLIC website the cloud copy is authoritative on EVERY device.
        // This prevents an old laptop localStorage copy from overriding changes
        // that were published from the phone (and vice versa).
        if (remote) {
          merged = deepMerge(window.JZX_DEFAULTS || {}, remote);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      }
    } catch (err) {
      console.warn('Cloud settings unavailable; using local/default settings.', err);
    }
    return merged;
  };

  // Images are deployed with the site from the /images folder.
  // Firebase is used only for settings/text/visibility, not binary image storage.
  const getImage = async key => null;
  const setText = (id, value, html=false) => { const el=document.getElementById(id); if(el && value!=null) html ? el.innerHTML=value : el.textContent=value; };
  const setHref = (id, href) => { const el=document.getElementById(id); if(el) el.href=href || '#'; };
  const setImg = async (selector, key, fallback) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    const saved = await getImage(key);
    const original = el.getAttribute('src') || '';
    const src = saved || fallback || original;
    if (!src) return;
    // Keep a working local fallback. This prevents a stale setting/path from
    // making an image flash briefly and then disappear after runtime loads.
    el.onerror = () => {
      if (original && el.getAttribute('src') !== original) {
        el.onerror = null;
        el.src = original;
      }
    };
    el.src = src;
  };
  const hexToRgba=(hex,alpha)=>{
    const h=String(hex||'#070C10').replace('#','').trim();
    const full=h.length===3?h.split('').map(x=>x+x).join(''):h.padEnd(6,'0').slice(0,6);
    const n=parseInt(full,16); if(Number.isNaN(n)) return `rgba(8,8,8,${alpha})`;
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
  };

  const visibilityOn = v => String(v ?? 'yes').toLowerCase() !== 'no';
  const sectionOn = key => visibilityOn(settings?.visibility?.sections?.[key]);
  const fieldOn = key => visibilityOn(settings?.visibility?.fields?.[key]);
  const itemOn = (group,index) => {
    const src=settings?.visibility?.items?.[group];
    return visibilityOn(Array.isArray(src) ? src[index] : src?.[index]);
  };
  const itemFieldOn = (group,index,field) => visibilityOn(settings?.visibility?.itemFields?.[group]?.[`${index}.${field}`]);
  const setVisible = (target,on) => {
    const els = typeof target === 'string' ? [...document.querySelectorAll(target)] : (target ? [target] : []);
    els.forEach(el=>el.classList.toggle('jzx-hidden',!on));
  };
  const fieldValue = (path,current,fallback) => fieldOn(path) ? current : fallback;
  const hideNavFor = (hash,on) => {
    document.querySelectorAll(`a[href="${hash}"]`).forEach(a=>a.classList.toggle('jzx-hidden',!on));
  };

  const setMeta=(id,value)=>{const el=document.getElementById(id);if(el&&value!=null)el.setAttribute('content',value)};
  const applySeo = () => {
    if(!sectionOn('seo')) return;
    const rawSeo=settings.seo||{}, rawAnalytics=settings.analytics||{}, c=settings.company||{};
    const dSeo=window.JZX_DEFAULTS?.seo||{}, dAnalytics=window.JZX_DEFAULTS?.analytics||{};
    const seo={}; Object.keys({...dSeo,...rawSeo}).forEach(k=>seo[k]=fieldValue(`seo.${k}`,rawSeo[k],dSeo[k]));
    const analytics={}; Object.keys({...dAnalytics,...rawAnalytics}).forEach(k=>analytics[k]=fieldValue(`analytics.${k}`,rawAnalytics[k],dAnalytics[k]));
    if(seo.siteTitle) document.title=seo.siteTitle;
    setMeta('metaDescription',seo.description||''); setMeta('metaKeywords',seo.keywords||''); setMeta('googleSiteVerification',seo.searchConsoleVerification||'');
    setMeta('ogTitle',seo.siteTitle||seo.businessName||'JMX Remodeling LLC'); setMeta('ogDescription',seo.description||''); setMeta('ogImage',seo.socialImage||settings.images?.mainLogo||'');
    const canonical=seo.canonicalUrl||location.href.split('#')[0]; setMeta('ogUrl',canonical); const cl=document.getElementById('canonicalLink'); if(cl)cl.href=canonical;
    const sameAs=[c.facebook,c.instagram,seo.googleBusinessUrl].filter(Boolean);
    const schema={
      '@context':'https://schema.org','@type':seo.businessType||'HomeAndConstructionBusiness',
      name:seo.businessName||'JMX Remodeling LLC',url:canonical,telephone:c.phoneDisplay||'',email:c.email||'',
      areaServed:c.serviceArea||'',priceRange:seo.priceRange||'$$',sameAs
    };
    if(seo.socialImage) schema.image=seo.socialImage;
    const address={}; if(seo.streetAddress)address.streetAddress=seo.streetAddress;if(seo.addressLocality)address.addressLocality=seo.addressLocality;if(seo.addressRegion)address.addressRegion=seo.addressRegion;if(seo.postalCode)address.postalCode=seo.postalCode;if(seo.country)address.addressCountry=seo.country;
    if(Object.keys(address).length) schema.address={'@type':'PostalAddress',...address};
    const ld=document.getElementById('localBusinessSchema'); if(ld)ld.textContent=JSON.stringify(schema);
    const ga=String(analytics.measurementId||'').trim();
    if(String(analytics.enabled||'no').toLowerCase()==='yes' && /^G-[A-Z0-9]+$/i.test(ga)){
      window.dataLayer=window.dataLayer||[]; window.gtag=window.gtag||function(){dataLayer.push(arguments)};
      const sc=document.createElement('script');sc.async=true;sc.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;document.head.appendChild(sc);
      gtag('js',new Date());gtag('config',ga);
      if(String(analytics.trackClicks||'yes').toLowerCase()!=='no'){
        document.addEventListener('click',e=>{const a=e.target.closest('a,button');if(!a)return;let event='button_click';const href=a.getAttribute('href')||'';if(href.startsWith('tel:'))event='phone_click';else if(href.includes('wa.me'))event='whatsapp_click';else if(href.startsWith('mailto:'))event='email_click';else if((a.id||'').toLowerCase().includes('facebook'))event='facebook_click';else if((a.id||'').toLowerCase().includes('payment'))event='payment_click';else if((a.id||'').toLowerCase().includes('estimate'))event='estimate_click';gtag('event',event,{element_id:a.id||'',link_url:href,link_text:(a.textContent||'').trim().slice(0,80)});});
      }
    }
  };

  const applyTheme = async () => {
    const raw=settings.theme||{}, d=window.JZX_DEFAULTS?.theme||{}, root=document.documentElement;
    const t={}; Object.keys({...d,...raw}).forEach(k=>t[k]=sectionOn('theme')?fieldValue(`theme.${k}`,raw[k],d[k]):d[k]);
    const vars={
      '--gold-dark':t.accentDark||'#E84A22','--gold':t.accent||'#E84A22','--gold-bright':t.accentBright||'#FF5A2A','--gold-light':t.accentLight||'#FFFFFF','--gold-soft':t.accentSoft||'#E84A22',
      '--black':t.background||'#070C10','--black-soft':t.surface||'#0D151C','--gray':t.muted||'#D7DEE5','--theme-bg':t.background||'#070C10','--theme-surface':t.surface||'#0D151C','--theme-text':t.text||'#FFFFFF','--theme-muted':t.muted||'#D7DEE5','--theme-line':t.lineColor||t.accent||'#E84A22','--theme-glow':t.glowColor||t.accentBright||'#FF5A2A','--theme-glow-duration':`${Math.max(2,Number(t.glowDuration)||7)}s`
    };
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
    root.classList.add('theme-managed');
    const glowOn=String(t.glowEnabled??'yes').toLowerCase()!=='no';
    root.classList.toggle('theme-glow-on',glowOn); root.classList.toggle('theme-glow-off',!glowOn);
    const bgOn=String(t.backgroundImageEnabled??'no').toLowerCase()==='yes';
    const customBg=await getImage('siteBackground'); const fallback=settings.images?.siteBackground||''; const bg=customBg||fallback;
    root.classList.toggle('theme-has-bg-image',Boolean(bgOn&&bg));
    root.style.setProperty('--site-background-image',bgOn&&bg?`url("${bg}")`:'none');
    const opacity=Math.min(100,Math.max(0,Number(t.backgroundOverlay??82)))/100;
    root.style.setProperty('--theme-section-overlay',hexToRgba(t.background||'#070C10',opacity));
    root.style.setProperty('--theme-card-overlay',hexToRgba(t.surface||'#0D151C',Math.min(1,opacity+.08)));
  };

  const localMonthKey = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', year:'numeric', month:'2-digit'}).formatToParts(new Date());
      return `${parts.find(x=>x.type==='year')?.value}-${parts.find(x=>x.type==='month')?.value}`;
    } catch {
      const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
  };
  const recordTraffic = async () => {
    if(!sectionOn('traffic')) return;
    try {
      if(window.JZXCloud?.enabled?.()){
        window.JZXCloud.init();
        await window.JZXCloud.incrementTraffic();
        return;
      }
      const monthKey=localMonthKey(), globalKey='jzx-traffic-global-v1', monthlyKey=`jzx-traffic-monthly-v1:${monthKey}`;
      localStorage.setItem(globalKey, String((Number(localStorage.getItem(globalKey))||0)+1));
      localStorage.setItem(monthlyKey, String((Number(localStorage.getItem(monthlyKey))||0)+1));
    } catch(err) { console.warn('Traffic counter could not be updated.', err); }
  };


  const applyVisibility = () => {
    // Master section switches. display:none removes the element from layout, so no blank space remains.
    setVisible('.contact-top', sectionOn('company'));
    setVisible('#contact', sectionOn('company'));
    setVisible('#home', sectionOn('hero'));
    setVisible('#services', sectionOn('services'));
    setVisible('#projects', sectionOn('projects'));
    setVisible('#why-us', sectionOn('trust'));
    setVisible('#process', sectionOn('process'));
    setVisible('#testimonials', sectionOn('testimonials'));
    setVisible('#faq', sectionOn('faq'));
    setVisible('.footer', sectionOn('footer'));
    setVisible('.copyright', sectionOn('footer'));

    const catalogueOn=sectionOn('catalogue'), paymentsOn=sectionOn('payments');
    setVisible('#catalogue .finance-box', catalogueOn);
    setVisible('#catalogue .catalogue-gallery', catalogueOn);
    setVisible('#catalogue .catalogue-more-container', catalogueOn);
    setVisible('#catalogue .payment-box', paymentsOn);
    setVisible('#catalogue', catalogueOn || paymentsOn);

    hideNavFor('#home',sectionOn('hero'));
    hideNavFor('#services',sectionOn('services'));
    hideNavFor('#projects',sectionOn('projects'));
    hideNavFor('#catalogue',catalogueOn || paymentsOn);
    hideNavFor('#contact',sectionOn('company'));

    // Company/contact fields.
    const phoneOn=fieldOn('company.phoneDisplay') && fieldOn('company.phoneDigits');
    setVisible('#topPhone,#quickPhone,#footerPhone',phoneOn);
    setVisible('#topSms',phoneOn);
    const waOn=fieldOn('company.whatsappDigits'); setVisible('#quickWhatsapp,#stickyWhatsapp',waOn);
    const emailOn=fieldOn('company.email'); setVisible('#topEmail,#quickEmail,#footerEmail',emailOn);
    const fbOn=fieldOn('company.facebook'); setVisible('#topFacebook,#quickFacebook,#footerFacebook',fbOn);
    const igOn=fieldOn('company.instagram'); setVisible('#topInstagram,#footerInstagram',igOn);
    const areaOn=fieldOn('company.serviceArea'); setVisible('#quickServiceArea,#footerServiceArea',areaOn);
    const quick=document.getElementById('contact');
    if(quick && sectionOn('company')){
      const visibleQuick=[...quick.querySelectorAll('.quick-item')].filter(el=>!el.classList.contains('jzx-hidden')).length;
      if(visibleQuick>0) quick.style.gridTemplateColumns=`repeat(${Math.min(5,visibleQuick)}, minmax(0,1fr))`;
    }

    // Hero fields and images.
    setVisible('#heroSmall',fieldOn('hero.small')); setVisible('#heroMessage',fieldOn('hero.messageHtml'));
    setVisible('#heroDescription',fieldOn('hero.description')); setVisible('#heroCta',fieldOn('hero.cta'));
    const headerLogoOn=fieldOn('image:headerLogo'); setVisible('#headerLogo',headerLogoOn); setVisible('.logo-small',headerLogoOn);
    const mainLogoOn=fieldOn('image:mainLogo'); setVisible('#mainLogo',mainLogoOn); setVisible('#home .hero-right',mainLogoOn);
    document.getElementById('home')?.classList.toggle('hero-no-right',!mainLogoOn);
    const heroBgOn=fieldOn('image:heroBackground');
    setVisible('#heroLeft .hero-left-bg',true);
    document.getElementById('heroLeft')?.classList.toggle('hero-image-off',!heroBgOn);

    // Sticky CTA controls.
    const stickyMaster=sectionOn('company') && fieldOn('stickyCta.enabled') && String(settings.stickyCta?.enabled??'yes').toLowerCase()!=='no';
    setVisible('#stickyContactBar',stickyMaster);
    setVisible('#stickyEstimate',fieldOn('stickyCta.estimateLabel'));
    setVisible('#stickyCall',fieldOn('stickyCta.callLabel') && phoneOn);
    setVisible('#stickyWhatsapp',fieldOn('stickyCta.whatsappLabel') && waOn);

    // Services + their individual parts.
    document.querySelectorAll('[data-service-index]').forEach(card=>{
      const i=Number(card.dataset.serviceIndex), on=itemOn('services',i);
      setVisible(card,on);
      setVisible(card.querySelector('h3'),on && itemFieldOn('services',i,'title'));
      setVisible(card.querySelector('p'),on && itemFieldOn('services',i,'description'));
      setVisible(card.querySelector('.service-image'),on && itemFieldOn('services',i,'image'));
    });

    // Before/after project images.
    document.querySelectorAll('[data-project-image]').forEach(img=>{
      const key=img.dataset.projectImage; setVisible(img.closest('.project-photo')||img,itemOn('projects',key));
    });

    // Why Choose Us.
    setVisible('#trustEyebrow',fieldOn('trust.eyebrow')); setVisible('#trustTitle',fieldOn('trust.title'));
    setVisible('#trustIntro',fieldOn('trust.intro')); setVisible('#credentialsTitle',fieldOn('trust.credentialsTitle'));
    setVisible('#credentialsText',fieldOn('trust.credentialsText'));
    document.querySelectorAll('#trustGrid .trust-card').forEach((card,i)=>{
      const on=itemOn('trust',i);setVisible(card,on);setVisible(card.querySelector('h3'),on&&itemFieldOn('trust',i,'title'));setVisible(card.querySelector('p'),on&&itemFieldOn('trust',i,'text'));
    });

    // Process.
    setVisible('#processEyebrow',fieldOn('process.eyebrow'));setVisible('#processTitle',fieldOn('process.title'));
    document.querySelectorAll('#processGrid .process-card').forEach((card,i)=>{
      const on=itemOn('process',i);setVisible(card,on);setVisible(card.querySelector('h3'),on&&itemFieldOn('process',i,'title'));setVisible(card.querySelector('p'),on&&itemFieldOn('process',i,'text'));
    });

    // Testimonials.
    setVisible('#testimonialsEyebrow',fieldOn('testimonials.eyebrow'));setVisible('#testimonialsTitle',fieldOn('testimonials.title'));
    document.querySelectorAll('#testimonialsGrid .testimonial-card').forEach((card,i)=>{
      const on=itemOn('testimonials',i);setVisible(card,on);
      setVisible(card.querySelector('strong'),on&&itemFieldOn('testimonials',i,'name'));
      setVisible(card.querySelector('span'),on&&itemFieldOn('testimonials',i,'project'));
      setVisible(card.querySelector('.testimonial-quote'),on&&itemFieldOn('testimonials',i,'quote'));
    });

    // FAQ.
    setVisible('#faqEyebrow',fieldOn('faq.eyebrow'));setVisible('#faqTitle',fieldOn('faq.title'));
    document.querySelectorAll('#faqList .faq-item').forEach((card,i)=>{
      const on=itemOn('faq',i);setVisible(card,on);setVisible(card.querySelector('summary'),on&&itemFieldOn('faq',i,'question'));setVisible(card.querySelector('p'),on&&itemFieldOn('faq',i,'answer'));
    });

    // Catalogue slots.
    let visibleExtras=0;
    document.querySelectorAll('[data-catalogue-index]').forEach(card=>{
      const i=Number(card.dataset.catalogueIndex), on=itemOn('catalogue',i);setVisible(card,on);
      setVisible(card.querySelector('h3'),on&&itemFieldOn('catalogue',i,'title'));
      setVisible(card.querySelector('.catalogue-photo'),on&&itemFieldOn('catalogue',i,'image'));
      if(i>=3 && on)visibleExtras++;
    });
    setVisible('#catalogueMoreBtn',catalogueOn && visibleExtras>0);

    // Payment methods / details.
    const ppOn=paymentsOn && fieldOn('payments.paypalEnabled') && String(settings.payments?.paypalEnabled??'yes').toLowerCase()!=='no';
    const zeOn=paymentsOn && fieldOn('payments.zelleEnabled') && String(settings.payments?.zelleEnabled??'yes').toLowerCase()!=='no';
    const caOn=paymentsOn && fieldOn('payments.cardEnabled') && String(settings.payments?.cardEnabled??'no').toLowerCase()!=='no';
    setVisible('#paypalPayment',ppOn); setVisible('#zellePayment',zeOn); setVisible('#cardPayment',caOn);
    setVisible('#paypalPayment .payment-label',ppOn && fieldOn('payments.paypalLabel'));
    setVisible('#zellePayment .payment-label',zeOn && fieldOn('payments.zelleLabel'));
    setVisible('#cardPayment .payment-label',caOn && fieldOn('payments.cardLabel'));
    if(!fieldOn('payments.paypalUrl')){const e=document.getElementById('paypalPayment');if(e){e.href='#';e.classList.add('payment-disabled');e.setAttribute('aria-disabled','true')}}
    if(!fieldOn('payments.zelleUrl')){const e=document.getElementById('zellePayment');if(e){e.href='#';e.classList.add('payment-disabled');e.setAttribute('aria-disabled','true')}}
    if(!fieldOn('payments.cardUrl')){const e=document.getElementById('cardPayment');if(e){e.href='#';e.classList.add('payment-disabled');e.setAttribute('aria-disabled','true')}}
    const zDetailsOn=zeOn && (fieldOn('payments.zelleRecipient')||fieldOn('payments.zelleContact')) && !document.getElementById('zelleDetails')?.hidden;
    setVisible('#zelleDetails',zDetailsOn);
    setVisible('#zelleRecipient',zDetailsOn && fieldOn('payments.zelleRecipient'));
    setVisible('#zelleContact',zDetailsOn && fieldOn('payments.zelleContact'));

    // Footer text fields.
    setVisible('#footerLogoText',fieldOn('footer.brand'));setVisible('#footerCompanyName',fieldOn('footer.companyName'));setVisible('#footerTagline',fieldOn('footer.tagline'));
    setVisible('#googleBusinessLink',fieldOn('seo.googleBusinessUrl') && Boolean(settings.seo?.googleBusinessUrl));
    setVisible('#googleReviewLink',fieldOn('seo.googleReviewUrl') && Boolean(settings.seo?.googleReviewUrl));
  };

  document.addEventListener('DOMContentLoaded', async () => {
    settings = await loadSettings();
    recordTraffic();
    applySeo();
    await applyTheme();
    const c=settings.company || {}, h=settings.hero || {}, im=settings.images || {}, f=settings.footer || {}, p=settings.payments || {};
    setText('topPhone', `☎ ${c.phoneDisplay}`); setHref('topPhone', `tel:+${c.phoneDigits}`);
    setText('topSms', `✆ ${c.phoneDisplay}`); setHref('topSms', `sms:+${c.phoneDigits}`);
    setText('topEmail', `✉ ${c.email}`); setHref('topEmail', `mailto:${c.email}`);
    setHref('topFacebook', c.facebook); setHref('topInstagram', c.instagram);

    setText('heroSmall', h.small); setText('heroMessage', h.messageHtml, true); setText('heroDescription', h.description); setText('heroCta', h.cta);
    await setImg('#headerLogo','headerLogo',im.headerLogo);
    await setImg('#mainLogo','mainLogo',im.mainLogo);
    document.documentElement.style.setProperty('--hero-image', 'url("images/test-hero-background.jpg")');

    const quickPhone=document.getElementById('quickPhone'); if(quickPhone){quickPhone.href=`tel:+${c.phoneDigits}`; const q=quickPhone.querySelector('p'); if(q) q.textContent=c.phoneDisplay;}
    const quickW=document.getElementById('quickWhatsapp'); if(quickW){quickW.href=`https://wa.me/${c.whatsappDigits}`; const q=quickW.querySelector('p'); if(q) q.textContent=c.phoneDisplay;}
    const quickE=document.getElementById('quickEmail'); if(quickE){quickE.href=`mailto:${c.email}`; const q=quickE.querySelector('p'); if(q) q.textContent=c.email;}
    const quickF=document.getElementById('quickFacebook'); if(quickF){quickF.href=c.facebook||'#';}
    const quickA=document.getElementById('quickServiceArea'); if(quickA){const q=quickA.querySelector('p'); if(q) q.textContent=c.serviceArea;}

    // Images below the hero are file-managed from /images. Text and visibility
    // can still come from settings, but image paths always come from the local
    // defaults so old Firebase/localStorage paths cannot overwrite them.
    const localDefaults = window.JZX_DEFAULTS || {};
    document.querySelectorAll('[data-service-index]').forEach(async (card) => {
      const i=Number(card.dataset.serviceIndex), d=settings.services?.[i]; if(!d) return;
      const local=localDefaults.services?.[i] || {};
      const title=card.querySelector('h3'), desc=card.querySelector('p'), img=card.querySelector('.service-image img');
      if(title) title.innerHTML=d.title; if(desc) desc.textContent=d.description;
      if(img) await setImg(img,`service-${i}`,local.image || img.getAttribute('src'));
    });
    document.querySelectorAll('[data-project-image]').forEach(async img => {
      const key=img.dataset.projectImage;
      await setImg(img,`project-${key}`,localDefaults.projects?.[key] || img.getAttribute('src'));
    });
    document.querySelectorAll('[data-catalogue-index]').forEach(async card => {
      const i=Number(card.dataset.catalogueIndex), d=settings.catalogue?.[i] || {}, local=localDefaults.catalogue?.[i] || {};
      const title=card.querySelector('h3'); if(title) title.textContent=d.title || local.title || `CATALOGUE ${i+1}`;
      let photo=card.querySelector('.catalogue-photo'); if(!photo) return;
      let imgEl=photo.querySelector('img');
      const src=local.image || imgEl?.getAttribute('src') || '';
      if(src){
        if(!imgEl){ imgEl=document.createElement('img'); photo.textContent=''; photo.appendChild(imgEl); }
        const original=imgEl.getAttribute('src') || src;
        imgEl.onerror=()=>{ if(original && imgEl.getAttribute('src')!==original){ imgEl.onerror=null; imgEl.src=original; } };
        imgEl.src=src; imgEl.alt=d.title || local.title || `Catalogue ${i+1}`;
      } else if(!imgEl){ photo.textContent='PHOTO'; }
    });

    const trust=settings.trust||{}; setText('trustEyebrow',trust.eyebrow); setText('trustTitle',trust.title); setText('trustIntro',trust.intro); setText('credentialsTitle',trust.credentialsTitle); setText('credentialsText',trust.credentialsText);
    const trustGrid=document.getElementById('trustGrid'); if(trustGrid){trustGrid.innerHTML='';(trust.items||[]).forEach((x,i)=>{const el=document.createElement('article');el.className='trust-card';el.innerHTML=`<div class="feature-number">0${i+1}</div><h3></h3><p></p>`;el.querySelector('h3').textContent=x.title||'';el.querySelector('p').textContent=x.text||'';trustGrid.appendChild(el)})}
    const process=settings.process||{}; setText('processEyebrow',process.eyebrow); setText('processTitle',process.title); const processGrid=document.getElementById('processGrid'); if(processGrid){processGrid.innerHTML='';(process.steps||[]).forEach((x,i)=>{const el=document.createElement('article');el.className='process-card';el.innerHTML=`<div class="process-number">${i+1}</div><h3></h3><p></p>`;el.querySelector('h3').textContent=x.title||'';el.querySelector('p').textContent=x.text||'';processGrid.appendChild(el)})}
    const testimonials=settings.testimonials||{}; setText('testimonialsEyebrow',testimonials.eyebrow); setText('testimonialsTitle',testimonials.title); const tg=document.getElementById('testimonialsGrid'); if(tg){tg.innerHTML='';(testimonials.items||[]).forEach(x=>{const el=document.createElement('article');el.className='testimonial-card';el.innerHTML='<div class="quote-mark">“</div><p class="testimonial-quote"></p><strong></strong><span></span>';el.querySelector('.testimonial-quote').textContent=x.quote||'';el.querySelector('strong').textContent=x.name||'';el.querySelector('span').textContent=x.project||'';tg.appendChild(el)})}
    const faq=settings.faq||{}; setText('faqEyebrow',faq.eyebrow); setText('faqTitle',faq.title); const fl=document.getElementById('faqList'); if(fl){fl.innerHTML='';(faq.items||[]).forEach((x,i)=>{const d=document.createElement('details');d.className='faq-item';if(i===0)d.open=true;const q=document.createElement('summary');q.textContent=x.question||'';const a=document.createElement('p');a.textContent=x.answer||'';d.append(q,a);fl.appendChild(d)})}
    const sticky=settings.stickyCta||{}; const bar=document.getElementById('stickyContactBar'); if(bar){bar.style.display=String(sticky.enabled).toLowerCase()==='no'?'none':'';setText('stickyEstimate',sticky.estimateLabel||'FREE ESTIMATE');setText('stickyCall',sticky.callLabel||'CALL');setHref('stickyCall',`tel:+${c.phoneDigits}`);setText('stickyWhatsapp',sticky.whatsappLabel||'WHATSAPP');setHref('stickyWhatsapp',`https://wa.me/${c.whatsappDigits}`)}

    setText('footerLogoText',f.brand); setText('footerCompanyName',f.companyName); setText('footerTagline',f.tagline);
    setText('footerPhone',`☎ ${c.phoneDisplay}`); setHref('footerPhone',`tel:+${c.phoneDigits}`);
    setText('footerEmail',`✉ ${c.email}`); setHref('footerEmail',`mailto:${c.email}`);
    setText('footerServiceArea',`● ${String(c.serviceArea||'').toUpperCase()}`);
    setHref('footerFacebook',c.facebook); setHref('footerInstagram',c.instagram);
    const gb=document.getElementById('googleBusinessLink'); if(gb){gb.href=settings.seo?.googleBusinessUrl||'#';gb.hidden=!settings.seo?.googleBusinessUrl;}
    const gr=document.getElementById('googleReviewLink'); if(gr){gr.href=settings.seo?.googleReviewUrl||'#';gr.hidden=!settings.seo?.googleReviewUrl;}
    const configurePayment = (id, enabled, label, url) => {
      const el=document.getElementById(id); if(!el) return;
      const isOn=String(enabled ?? 'yes').toLowerCase() !== 'no';
      el.style.display=isOn?'inline-flex':'none';
      if(label){const labelEl=el.querySelector('.payment-label'); if(labelEl) labelEl.textContent=label; else el.textContent=label;}
      if(url){el.href=url;el.removeAttribute('aria-disabled');el.classList.remove('payment-disabled');}
      else{el.href='#';el.setAttribute('aria-disabled','true');el.classList.add('payment-disabled');}
    };
    configurePayment('paypalPayment',p.paypalEnabled,p.paypalLabel || 'PayPal',p.paypalUrl);
    configurePayment('zellePayment',p.zelleEnabled,p.zelleLabel || 'Zelle',p.zelleUrl);
    configurePayment('cardPayment',p.cardEnabled,p.cardLabel || 'Pay by Card',p.cardUrl);
    const zelleDetails=document.getElementById('zelleDetails');
    if(zelleDetails){
      const hasInfo=Boolean((p.zelleRecipient||'').trim() || (p.zelleContact||'').trim());
      const zelleOn=String(p.zelleEnabled ?? 'yes').toLowerCase() !== 'no';
      zelleDetails.hidden=!(zelleOn && hasInfo);
      setText('zelleRecipient',p.zelleRecipient || '');
      setText('zelleContact',p.zelleContact || '');
    }
    document.querySelectorAll('.payment-link.payment-disabled').forEach(el=>el.addEventListener('click',e=>e.preventDefault()));
    applyVisibility();
  });
})();
