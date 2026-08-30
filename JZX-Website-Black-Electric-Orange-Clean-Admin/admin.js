(() => {
'use strict';
const STORAGE_KEY='jzx-site-settings-v1', SESSION_KEY='jzx-admin-session-v1', DB_NAME='jzx-site-assets', STORE='images';
const defaults=window.JZX_DEFAULTS||{}, cfg=window.JZX_ADMIN_CONFIG||{};
const clone=o=>JSON.parse(JSON.stringify(o));
const deepMerge=(a,b)=>{if(Array.isArray(a))return Array.isArray(b)?b.map((v,i)=>deepMerge(a[i]??{},v)):clone(a);if(a&&typeof a==='object'){const o={...a};if(b&&typeof b==='object')Object.keys(b).forEach(k=>o[k]=deepMerge(a[k],b[k]));return o}return b===undefined?a:b};
let data=(()=>{try{return deepMerge(defaults,JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}catch{return clone(defaults)}})();
const cloudOn=()=>Boolean(window.JZXCloud?.enabled?.());
let cloudTimer=null, rendered=false;
const status=t=>{const st=document.querySelector('#saveStatus');if(st)st.textContent=t};
const queueCloudSave=()=>{
  if(!cloudOn())return;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(async()=>{
    try{
      data.__meta=data.__meta||{};
      data.__meta.publishedAt=Date.now();
      await window.JZXCloud.saveSettings(data);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      status('Changes published to Cloud Firestore.');
    }catch(e){
      console.warn(e);
      status('Cloud publication failed. A local backup was kept; use Publish Changes to retry.');
    }
  },900);
};
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const openDb=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbPut=async(k,v)=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})};
const dbGet=async k=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(k);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})};
const dbDel=async k=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})};
const dbKeys=async()=>{const db=await openDb();return new Promise((res,rej)=>{const store=db.transaction(STORE,'readonly').objectStore(STORE);const r=store.getAllKeys();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})};
const dataUrlToFile=(dataUrl,key)=>{
  const m=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);
  if(!m)return null;
  const mime=m[1]||'image/jpeg', bin=atob(m[2]), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const ext=(mime.split('/')[1]||'jpg').replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'')||'jpg';
  return new File([bytes],`${key}.${ext}`,{type:mime});
};
const getPath=(o,p)=>p.split('.').reduce((x,k)=>x?.[k],o);
const setPath=(o,p,v)=>{const ks=p.split('.');let x=o;ks.slice(0,-1).forEach(k=>x=x[k]??=(/^\d+$/.test(ks[ks.indexOf(k)+1]||'')?[]:{}));x[ks.at(-1)]=v};
const save=()=>{
  data.__meta=data.__meta||{};
  data.__meta.localUpdatedAt=Date.now();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  const st=$('#saveStatus');
  if(st){
    st.textContent=cloudOn()?'Change cached locally; publishing to Cloud Firestore…':'Saved on this device — refresh the website to see changes.';
    st.classList.add('save-flash');
    setTimeout(()=>st.classList.remove('save-flash'),800);
  }
  queueCloudSave();
};
const fileToData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)});
let adminCloudLoaded=false;
const showAdmin=async()=>{
  if(cloudOn() && !window.JZXCloud.isAuthorizedUser(window.JZXCloud.currentUser())) return;
  $('#loginView').classList.add('hidden');
  $('#adminView').classList.remove('hidden');
  if(!cloudOn()) sessionStorage.setItem(SESSION_KEY,'1');

  if(cloudOn() && !adminCloudLoaded){
    adminCloudLoaded=true;
    try{
      const remote=await window.JZXCloud.loadSettings();
      if(remote){
        let local={};
        try{local=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{}
        const localEdited=Number(local?.__meta?.localUpdatedAt||0);
        const remotePublished=Number(remote?.__meta?.publishedAt||0);

        // In the ADMIN only, preserve a newer unpublished edit from this device.
        data=deepMerge(defaults,remote);
        if(localEdited>remotePublished) data=deepMerge(data,local);

        localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
        status(localEdited>remotePublished
          ? 'Loaded cloud settings; newer edits on this device are still pending publication.'
          : 'Loaded latest settings from cloud.');
      }else{
        status('No cloud settings exist yet. Publish Changes to create the shared configuration.');
      }
    }catch(e){
      console.warn(e);
      status('Cloud settings could not be loaded. A local cached copy is being used temporarily.');
    }
  }

  if(!rendered){
    render();
    rendered=true;
  }
};
const logout=async()=>{sessionStorage.removeItem(SESSION_KEY);try{if(cloudOn())await window.JZXCloud.signOut()}catch{}location.reload()};

function initLogin(){
  const preview=$('#previewLogin');
  $('#logoutBtn')?.addEventListener('click',logout);
  const host=$('#googleButton');
  const note=$('#loginNote');

  if(cloudOn()){
    try{
      window.JZXCloud.init();
      if(host) host.innerHTML=`<p class="small">Authorized administrator: <strong>${cfg.allowedGoogleEmail||''}</strong></p>`;
      if(note) note.textContent='Sign in with the authorized Google account to load and publish the shared Cloud Firestore configuration.';
      if(preview){
        preview.style.display='inline-flex';
        preview.textContent='Sign in with Google';
        preview.addEventListener('click',async()=>{
          preview.disabled=true;
          if(note) note.textContent='Opening secure Google sign-in…';
          try{await window.JZXCloud.signIn()}
          catch(e){console.warn(e);if(note)note.textContent=e.message||'Google sign-in failed.'}
          finally{preview.disabled=false}
        });
      }
      window.JZXCloud.onAuthStateChanged(async user=>{
        if(window.JZXCloud.isAuthorizedUser(user)){
          if(note) note.textContent=`Signed in as ${user.email}.`;
          await showAdmin();
        }else{
          $('#adminView')?.classList.add('hidden');
          $('#loginView')?.classList.remove('hidden');
        }
      });
      return;
    }catch(e){
      console.error(e);
      if(note) note.textContent=`Firebase could not start: ${e.message}`;
      if(preview) preview.style.display='none';
      return;
    }
  }

  if(cfg.productionMode){
    if(note) note.textContent='Cloud mode is required in production, but Firebase is not fully configured.';
    if(preview) preview.style.display='none';
    return;
  }

  if(host) host.innerHTML='<p class="small">Local development mode</p>';
  if(note) note.textContent='Changes in local development mode stay in this browser.';
  if(preview){
    preview.style.display='inline-flex';
    preview.textContent='Open Local Admin';
    preview.addEventListener('click',showAdmin);
  }
  if(sessionStorage.getItem(SESSION_KEY)==='1') showAdmin();
}


const visibilityOn=v=>String(v??'yes').toLowerCase()!=='no';
function ensureVisibility(){
  data.visibility=data.visibility||{};
  data.visibility.sections=data.visibility.sections||{};
  data.visibility.fields=data.visibility.fields||{};
  data.visibility.items=data.visibility.items||{};
  data.visibility.itemFields=data.visibility.itemFields||{};
}
function makeVisibilitySwitch(checked,onChange,labelText='Visible'){
  const wrap=document.createElement('span');
  wrap.className='visibility-switch';
  wrap.title='Show or hide this item on the public website';
  wrap.setAttribute('role','switch');
  wrap.setAttribute('tabindex','0');

  const input=document.createElement('input');
  input.type='checkbox';
  input.checked=Boolean(checked);
  input.setAttribute('aria-label',labelText||'Visibility');

  const slider=document.createElement('span');
  slider.className='visibility-slider';
  const label=document.createElement('span');
  label.className='visibility-switch-text';
  label.textContent=labelText;

  const syncAria=()=>wrap.setAttribute('aria-checked',input.checked?'true':'false');
  const commit=()=>{
    syncAria();
    onChange(input.checked);
  };
  const toggle=()=>{
    input.checked=!input.checked;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };

  wrap.append(input,slider,label);
  syncAria();

  input.addEventListener('change',commit);

  // The real checkbox is visually hidden. Make the entire rendered switch
  // (track, knob and text) clickable/touchable instead of relying on the
  // hidden input to receive pointer events.
  wrap.addEventListener('click',e=>{
    e.preventDefault();
    toggle();
  });
  wrap.addEventListener('keydown',e=>{
    if(e.key===' ' || e.key==='Enter'){
      e.preventDefault();
      toggle();
    }
  });

  return wrap;
}
function sectionVisible(key){ensureVisibility();return visibilityOn(data.visibility.sections[key]);}
function fieldVisible(key){ensureVisibility();return visibilityOn(data.visibility.fields[key]);}
function itemVisible(group,index){ensureVisibility();const src=data.visibility.items[group];return visibilityOn(Array.isArray(src)?src[index]:src?.[index]);}
function setSectionVisible(key,on){ensureVisibility();data.visibility.sections[key]=on?'yes':'no';save();}
function setFieldVisible(key,on){ensureVisibility();data.visibility.fields[key]=on?'yes':'no';save();}
function setItemVisible(group,index,on){
  ensureVisibility();
  if(Array.isArray(data.visibility.items[group])) data.visibility.items[group][index]=on?'yes':'no';
  else {data.visibility.items[group]=data.visibility.items[group]||{};data.visibility.items[group][index]=on?'yes':'no';}
  save();
}
function itemFieldVisible(group,index,field){
  ensureVisibility();const g=data.visibility.itemFields[group]||{};return visibilityOn(g[`${index}.${field}`]);
}
function setItemFieldVisible(group,index,field,on){
  ensureVisibility();data.visibility.itemFields[group]=data.visibility.itemFields[group]||{};
  data.visibility.itemFields[group][`${index}.${field}`]=on?'yes':'no';save();
}
function addItemVisibilityControls(card,group,index,fields=[]){
  if(card.querySelector('.item-visibility-controls'))return;
  const row=document.createElement('div');row.className='item-visibility-controls';
  row.appendChild(makeVisibilitySwitch(itemVisible(group,index),on=>setItemVisible(group,index,on),'Whole item'));
  fields.forEach(([field,label])=>row.appendChild(makeVisibilitySwitch(itemFieldVisible(group,index,field),on=>setItemFieldVisible(group,index,field,on),label)));
  card.insertBefore(row,card.children[1]||null);
}
function bindVisibilityUI(){
  ensureVisibility();
  const nav=$('#adminNav');
  [...nav.querySelectorAll(':scope > button')].forEach(button=>{
    const key=button.dataset.target;
    const row=document.createElement('div');row.className='nav-visibility-row';
    button.parentNode.insertBefore(row,button);row.appendChild(button);
    const sw=makeVisibilitySwitch(sectionVisible(key),on=>setSectionVisible(key,on),'');
    sw.classList.add('nav-switch');row.appendChild(sw);
  });
  $$('.panel').forEach(panel=>{
    const key=panel.dataset.panel;
    const bar=document.createElement('div');bar.className='panel-visibility-bar';
    const txt=document.createElement('div');txt.innerHTML='<strong>Public visibility</strong><span>Turn this section off to remove it from the public site without leaving blank space.</span>';
    const sw=makeVisibilitySwitch(sectionVisible(key),on=>{
      setSectionVisible(key,on);
      $$('.nav-visibility-row').forEach(r=>{const b=r.querySelector('button');if(b?.dataset.target===key){const i=r.querySelector('input');if(i)i.checked=on;}});
    },'Section on');
    bar.append(txt,sw);panel.insertBefore(bar,panel.firstChild);
  });
  $$('[data-path]').forEach(el=>{
    const label=el.closest('label'); if(!label||label.querySelector('.field-visibility-control'))return;
    const key=el.dataset.path;
    const holder=document.createElement('div');holder.className='field-visibility-control';
    holder.appendChild(makeVisibilitySwitch(fieldVisible(key),on=>setFieldVisible(key,on),'Show'));
    label.appendChild(holder);
  });
  $$('.image-editor[data-image-key]').forEach(editor=>{
    if(editor.querySelector('.field-visibility-control'))return;
    const key=`image:${editor.dataset.imageKey}`;
    const holder=document.createElement('div');holder.className='field-visibility-control';
    holder.appendChild(makeVisibilitySwitch(fieldVisible(key),on=>setFieldVisible(key,on),'Show image'));
    editor.insertBefore(holder,editor.querySelector('img'));
  });
}

function bindNav(){
  $$('#adminNav button').forEach(b=>b.addEventListener('click',()=>{
    $$('#adminNav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===b.dataset.target));
    if(b.dataset.target==='traffic') loadTrafficCounters();
  }));
}
function bindSimpleFields(){
  $$('[data-path]').forEach(el=>{el.value=getPath(data,el.dataset.path)??'';el.addEventListener('change',()=>{setPath(data,el.dataset.path,el.value);save()})});
}
const THEME_PRESETS={
  original:{background:'#080808',surface:'#101010',text:'#ffffff',muted:'#b8b8b8',accentDark:'#8a5a00',accent:'#d69b00',accentBright:'#ffd700',accentLight:'#fff4a3',accentSoft:'#ffbf00',lineColor:'#d69b00',glowColor:'#ffd700'},
  champagne:{background:'#090806',surface:'#15120d',text:'#fffaf0',muted:'#c9c0ae',accentDark:'#7d5d24',accent:'#c9a45b',accentBright:'#f1d38a',accentLight:'#fff0bd',accentSoft:'#d9b769',lineColor:'#c9a45b',glowColor:'#ffe09a'},
  copper:{background:'#0b0807',surface:'#17100d',text:'#fff8f3',muted:'#c4b2a8',accentDark:'#6f321d',accent:'#b7663b',accentBright:'#e89563',accentLight:'#ffc59f',accentSoft:'#cc7848',lineColor:'#b7663b',glowColor:'#ffad78'},
  silver:{background:'#08090a',surface:'#111315',text:'#f8f9fa',muted:'#aeb4ba',accentDark:'#555d64',accent:'#89939c',accentBright:'#d8dde2',accentLight:'#f3f5f7',accentSoft:'#b5bdc5',lineColor:'#89939c',glowColor:'#eef5ff'},
  blue:{background:'#05090d',surface:'#0c141c',text:'#f4f9ff',muted:'#a8b9c8',accentDark:'#174b70',accent:'#2f83bd',accentBright:'#65c8ff',accentLight:'#bcecff',accentSoft:'#3da6df',lineColor:'#2f83bd',glowColor:'#7bd5ff'},
  emerald:{background:'#050a08',surface:'#0d1713',text:'#f4fff9',muted:'#a9c0b5',accentDark:'#17603d',accent:'#299866',accentBright:'#4de39b',accentLight:'#b5ffd9',accentSoft:'#36ba7b',lineColor:'#299866',glowColor:'#67f0ad'},
  burgundy:{background:'#0b0507',surface:'#190d12',text:'#fff7f9',muted:'#c4aeb5',accentDark:'#661d34',accent:'#a7375d',accentBright:'#ef7099',accentLight:'#ffc0d4',accentSoft:'#c94b73',lineColor:'#a7375d',glowColor:'#ff88ad'}
};
function bindThemePreset(){
  const sel=$('#themePreset'); if(!sel) return;
  sel.addEventListener('change',()=>{
    if(sel.value==='custom') return;
    const preset=THEME_PRESETS[sel.value]; if(!preset) return;
    data.theme={...(data.theme||{}),...preset,preset:sel.value};
    Object.entries(preset).forEach(([k,v])=>{const el=document.querySelector(`[data-path="theme.${k}"]`);if(el)el.value=v});
    save();
  });
  $$('[data-path^="theme."]').filter(el=>el!==sel).forEach(el=>el.addEventListener('input',()=>{if(sel.value!=='custom'){sel.value='custom';setPath(data,'theme.preset','custom')}}));
}
const cacheBustImage=(src)=>{
  if(!src)return '';
  if(/^data:|^blob:|^https?:\/\//i.test(src)) return src;
  const sep=src.includes('?')?'&':'?';
  return `${src}${sep}v=${Date.now()}`;
};
const getAsset=async(key,fallback)=>cacheBustImage(fallback||'');
async function previewFor(key,img,fallback){
  if(!img)return;
  img.src=await getAsset(key,fallback);
  img.style.display=img.src?'block':'none';
  img.onerror=()=>{img.style.display='none'};
}
function makeImageEditor(key,title,fallback){
  const w=document.createElement('div');
  w.className='image-editor image-preview-only';
  w.dataset.imageKey=key;
  w.innerHTML=`<h3>${title}</h3><img alt="${title}"><p class="small image-folder-note">Image is managed directly from the <code>images</code> folder. Replace the project image using the same filename, then refresh this admin page.</p>`;
  previewFor(key,$('img',w),fallback);
  return w;
}
function bindStaticImageEditors(){
  $$('.image-editor[data-image-key]').forEach(w=>{
    const key=w.dataset.imageKey;
    const fallback=getPath(data,'images.'+key);
    previewFor(key,$('img',w),fallback);
    w.querySelectorAll('input[type=file],.remove-image').forEach(el=>el.remove());
    if(!w.querySelector('.image-folder-note')){
      const note=document.createElement('p');
      note.className='small image-folder-note';
      note.innerHTML='Image is managed directly from the <code>images</code> folder. Replace the file using the same filename, then refresh this page.';
      w.appendChild(note);
    }
  });
}
function renderServices(){
  const host=$('#servicesEditor');host.innerHTML='';
  (data.services||[]).forEach((s,i)=>{
    const c=document.createElement('div');
    c.className='repeat-card';
    c.innerHTML=`<h3>Service ${i+1}</h3><img><p class="small image-folder-note">Image preview from the <code>images</code> folder. Replace the matching file in GitHub to change it.</p><label>Title<input value="${(s.title||'').replace(/"/g,'&quot;')}"></label><label>Description<textarea rows="3">${s.description||''}</textarea></label>`;
    const [title,desc]=c.querySelectorAll('input,textarea'),img=$('img',c);
    previewFor(`service-${i}`,img,s.image);
    title.addEventListener('change',()=>{data.services[i].title=title.value;save()});
    desc.addEventListener('change',()=>{data.services[i].description=desc.value;save()});
    addItemVisibilityControls(c,'services',i,[['title','Title'],['description','Text'],['image','Image']]);
    host.appendChild(c);
  });
}
function renderProjects(){const host=$('#projectsEditor');host.innerHTML='';['before1','after1','before2','after2','before3','after3','before4','after4'].forEach(k=>{const ed=makeImageEditor(`project-${k}`,k.toUpperCase(),data.projects?.[k]);const row=document.createElement('div');row.className='item-visibility-controls';row.appendChild(makeVisibilitySwitch(itemVisible('projects',k),on=>setItemVisible('projects',k,on),'Show image'));ed.insertBefore(row,ed.querySelector('img'));host.appendChild(ed)})}
function renderTextPairs(hostId,items,pathPrefix,labels){const host=$(hostId);if(!host)return;host.innerHTML='';(items||[]).forEach((d,i)=>{const c=document.createElement('div');c.className='repeat-card';c.innerHTML=`<h3>${labels.card} ${i+1}</h3><label>${labels.a}<input></label><label>${labels.b}<textarea rows="3"></textarea></label>`;const input=$('input',c),ta=$('textarea',c);input.value=d[labels.ak]||'';ta.value=d[labels.bk]||'';input.addEventListener('change',()=>{getPath(data,pathPrefix)[i][labels.ak]=input.value;save()});ta.addEventListener('change',()=>{getPath(data,pathPrefix)[i][labels.bk]=ta.value;save()});const group=pathPrefix.split('.')[0];addItemVisibilityControls(c,group,i,[[labels.ak,labels.a],[labels.bk,labels.b]]);host.appendChild(c)})}
function renderTrust(){renderTextPairs('#trustEditor',data.trust?.items,'trust.items',{card:'Reason',a:'Title',b:'Description',ak:'title',bk:'text'})}
function renderProcess(){renderTextPairs('#processEditor',data.process?.steps,'process.steps',{card:'Step',a:'Title',b:'Description',ak:'title',bk:'text'})}
function renderTestimonials(){const host=$('#testimonialsEditor');if(!host)return;host.innerHTML='';(data.testimonials?.items||[]).forEach((d,i)=>{const c=document.createElement('div');c.className='repeat-card';c.innerHTML=`<h3>Testimonial ${i+1}</h3><label>Customer name<input></label><label>Project / service<input></label><label>Review<textarea rows="4"></textarea></label>`;const ins=c.querySelectorAll('input'),ta=$('textarea',c);ins[0].value=d.name||'';ins[1].value=d.project||'';ta.value=d.quote||'';ins[0].addEventListener('change',()=>{data.testimonials.items[i].name=ins[0].value;save()});ins[1].addEventListener('change',()=>{data.testimonials.items[i].project=ins[1].value;save()});ta.addEventListener('change',()=>{data.testimonials.items[i].quote=ta.value;save()});addItemVisibilityControls(c,'testimonials',i,[['name','Name'],['project','Project'],['quote','Review']]);host.appendChild(c)})}
function renderFaq(){renderTextPairs('#faqEditor',data.faq?.items,'faq.items',{card:'FAQ',a:'Question',b:'Answer',ak:'question',bk:'answer'})}
function renderCatalogue(){
  const host=$('#catalogueEditor');host.innerHTML='';
  (data.catalogue||[]).forEach((d,i)=>{
    const c=document.createElement('div');
    c.className='repeat-card';
    c.innerHTML=`<h3>Slot ${i+1}${i<3?' — visible':''}</h3><img><p class="small image-folder-note">Image preview from the <code>images</code> folder. Replace the matching file in GitHub to change it.</p><label>Title<input value="${(d.title||'').replace(/"/g,'&quot;')}"></label>`;
    const img=$('img',c),title=$('input',c);
    previewFor(`catalogue-${i}`,img,d.image);
    title.addEventListener('change',()=>{data.catalogue[i].title=title.value;save()});
    addItemVisibilityControls(c,'catalogue',i,[['title','Title'],['image','Image']]);
    host.appendChild(c);
  });
}
const localTrafficMonthKey=()=>{
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    return `${parts.find(x=>x.type==='year')?.value}-${parts.find(x=>x.type==='month')?.value}`;
  }catch{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
};
const formatMonthLabel=(key)=>{
  const [y,m]=String(key||'').split('-').map(Number);
  if(!y||!m)return 'Current month';
  try{return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'America/Chicago'}).format(new Date(Date.UTC(y,m-1,15)))}catch{return key}
};
async function loadTrafficCounters(){
  const monthly=$('#monthlyTrafficCount'), global=$('#globalTrafficCount'), label=$('#monthlyTrafficLabel'), note=$('#trafficModeNote');
  if(!monthly||!global)return;
  monthly.textContent='…';global.textContent='…';
  try{
    if(cloudOn()){
      const stats=await window.JZXCloud.loadTrafficStats();
      monthly.textContent=Number(stats?.monthly||0).toLocaleString();
      global.textContent=Number(stats?.global||0).toLocaleString();
      label.textContent=formatMonthLabel(stats?.monthKey);
      if(note)note.textContent='Shared Cloud Firestore counters.';
    }else{
      const key=localTrafficMonthKey();
      monthly.textContent=(Number(localStorage.getItem(`jzx-traffic-monthly-v1:${key}`))||0).toLocaleString();
      global.textContent=(Number(localStorage.getItem('jzx-traffic-global-v1'))||0).toLocaleString();
      label.textContent=`${formatMonthLabel(key)} — local preview`;
      if(note)note.textContent='Local browser counters only.';
    }
  }catch(e){
    console.warn(e);monthly.textContent='—';global.textContent='—';
    if(note)note.textContent=e.message||'Could not load traffic counters.';
  }
}
$('#refreshTrafficBtn')?.addEventListener('click',loadTrafficCounters);

function render(){bindNav();bindSimpleFields();bindThemePreset();bindStaticImageEditors();renderServices();renderProjects();renderTrust();renderProcess();renderTestimonials();renderFaq();renderCatalogue();bindVisibilityUI();const cs=$('#cloudStatus');if(cs)cs.textContent=cloudOn()?'Connected to Cloud Firestore. Published changes are shared with the public website and other devices.':'Local preview mode — configure Firebase in admin-config.js for production cloud sync.';}

const publishNow=async()=>{
  clearTimeout(cloudTimer);
  data.__meta=data.__meta||{};
  const now=Date.now();
  data.__meta.localUpdatedAt=now;
  data.__meta.publishedAt=now;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  if(!cloudOn()){
    status('Saved locally in this browser. Use Export Settings for a backup.');
    return;
  }
  const buttons=[$('#publishBtn'),$('#publishCloudBtn')].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);
  status('Publishing changes to Cloud Firestore…');
  try{
    await window.JZXCloud.saveSettings(data);
    status('Changes published to Cloud Firestore.');
  }catch(e){
    console.error(e);
    status(`Cloud publication failed: ${e.message||'unknown error'}. A local backup was kept.`);
  }finally{
    buttons.forEach(button=>button.disabled=false);
  }
};
$('#publishBtn')?.addEventListener('click',publishNow);$('#publishCloudBtn')?.addEventListener('click',publishNow);
$('#syncCloudBtn')?.addEventListener('click',async()=>{
  if(!cloudOn())return;
  status('Loading latest settings from Cloud Firestore…');
  try{
    const remote=await window.JZXCloud.loadSettings();
    if(!remote){status('No shared configuration exists in Cloud Firestore yet.');return}
    data=deepMerge(defaults,remote);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    location.reload();
  }catch(e){console.error(e);status(`Cloud settings could not be loaded: ${e.message||'unknown error'}.`)}
});

$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jva-site-settings.json';a.click();URL.revokeObjectURL(a.href)});
$('#importInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{data=deepMerge(defaults,JSON.parse(await f.text()));await publishNow();location.reload()}catch{alert('Invalid settings file.')}});
$('#resetBtn').addEventListener('click',async()=>{if(!confirm('Reset all editable settings to the original website defaults? Images in the project images folder will not be deleted.'))return;data=clone(defaults);data.__meta={localUpdatedAt:Date.now(),publishedAt:Date.now()};localStorage.setItem(STORAGE_KEY,JSON.stringify(data));const db=await openDb();await new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});await publishNow();location.reload()});
initLogin();
})();
