/* ══════════════════════════════════════════════════════════
   إيلوريا ستوري — مكتبة رقمية بسيطة بدون أي أدوات بناء
   البيانات: data.json (المنشور للجميع) + متصفح المؤلفة (المسودات)
   ══════════════════════════════════════════════════════════ */

/* ┌─────────────────────────────────────────────────┐
   │  🗝  كلمة سر المؤلفة — غيّريها من السطر التالي:  │
   └─────────────────────────────────────────────────┘ */
const AUTHOR_PASS = "Jana1425";
const LS_KEY = "eloria-data";

let DB = { novels: [], quotes: [], about: "" };
let editing = { novelId: null, chapterId: null };

/* ---------- تحميل البيانات ---------- */
async function loadData(){
  // مسودات المؤلفة في هذا المتصفح لها الأولوية
  const local = localStorage.getItem(LS_KEY);
  if (local) { try { DB = JSON.parse(local); return; } catch(e){} }
  // وإلا: الملف المنشور مع الموقع
  try {
    const r = await fetch("data.json", {cache:"no-store"});
    if (r.ok) { DB = await r.json(); return; }
  } catch(e){ /* الملف غير متاح (فتح مباشر من الجهاز مثلًا) */ }
  DB = DEFAULT_DATA; // محتوى تجريبي أولي حتى لا يبدو الموقع فارغًا
}
const DEFAULT_DATA = {
  novels: [{
    id:"eloria1", title:"إيلوريا", status:"مستمرة",
    tags:["فانتازيا","غموض","رومانسية"],
    desc:"حيث تُفتح الذكريات، ويتغير المصير. في أكاديمية ملكية تحيطها الأسرار، تستيقظ إيلا دون أن تتذكر من تكون.",
    cover:"", characters:[{name:"إيلا",role:"الشخصية الرئيسية",img:""},{name:"أدريان",role:"شخصية رئيسية",img:""}],
    chapters:[{id:"ch1",title:"الفصل الأول: المفتاح الفضي",
      text:"وقفت إيلا أمام البوابة الكبرى لأكاديمية إيلوريا الملكية. كان قلبها يخفق بسرعة، وشعور غريب يراودها... وكأن هذا المكان يعرفها، وكأنها كانت هنا من قبل."}]
  }],
  quotes:[{text:"بعض الحكايات لا تُروى... بل تُعاش.", source:"إيلوريا — الفصل الأول"}],
  about:"مرحبًا، أنا كاتبة إيلوريا ستوري. هنا أجمع عوالمي: رواياتي وفصولي وشخصياتي واقتباساتي."
};
function persist(){ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const esc = s => (s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- التنقل ---------- */
const views = ["home","library","novel","reader","quotes","about"];
function route(){
  const h = location.hash.replace(/^#\/?/, "");
  const [page, a, b] = h.split("/");
  let v = "home";
  if (page === "library") { v="library"; renderLibrary(); }
  else if (page === "quotes") { v="quotes"; renderQuotes(); }
  else if (page === "about") { v="about"; renderAbout(); }
  else if (page === "novel" && a) { v="novel"; renderNovel(a); }
  else if (page === "read" && a && b) { v="reader"; renderReader(a, b); }
  else { renderHome(); }
  views.forEach(x => document.getElementById("view-"+x).classList.toggle("active", x===v));
  document.querySelectorAll("nav a").forEach(l => l.classList.toggle("active", l.dataset.route===v || (v==="novel"||v==="reader") && l.dataset.route==="library"));
  window.scrollTo({top:0});
  updateProgress();
}
window.addEventListener("hashchange", route);

/* ---------- بطاقة رواية ---------- */
function bookCard(n){
  const cover = n.cover
    ? `<img src="${n.cover}" alt="${esc(n.title)}">`
    : `<div class="ph">ELORIA<br><small style="font-size:.6em; letter-spacing:.3em">STORY</small></div>`;
  return `<div class="book-card" onclick="location.hash='#/novel/${n.id}'">
    <div class="cover">${cover}</div>
    <h3>${esc(n.title)}</h3>
    <div class="meta">${(n.tags||[]).slice(0,2).map(esc).join(" · ")}</div>
    <div class="st"><span class="tag ${n.status==='مكتملة'?'':'lilac'}">${esc(n.status||"مستمرة")}</span>
    <span class="tag rose">${(n.chapters||[]).length} فصل</span></div>
  </div>`;
}

/* ---------- الرئيسية ---------- */
function renderHome(){
  const g = document.getElementById("latestGrid");
  const latest = [...DB.novels].slice(-4).reverse();
  g.innerHTML = latest.length ? latest.map(bookCard).join("")
    : `<div class="empty" style="grid-column:1/-1">لا توجد روايات بعد — الرفّ بانتظار حكايتك الأولى 🕯</div>`;
}

/* ---------- المكتبة ---------- */
let activeTag = null;
function renderLibrary(){
  const tags = [...new Set(DB.novels.flatMap(n => n.tags||[]))];
  document.getElementById("tagFilter").innerHTML = tags.length
    ? [`<button class="tag ${!activeTag?'lilac':''}" onclick="filterTag(null)">الكل</button>`,
       ...tags.map(t => `<button class="tag ${activeTag===t?'lilac':''}" onclick="filterTag('${esc(t)}')">${esc(t)}</button>`)].join("")
    : "";
  const list = activeTag ? DB.novels.filter(n => (n.tags||[]).includes(activeTag)) : DB.novels;
  document.getElementById("libraryGrid").innerHTML = list.length ? list.map(bookCard).join("")
    : `<div class="empty" style="grid-column:1/-1">المكتبة فارغة حاليًا${document.body.classList.contains("author") ? " — اضغطي «رواية جديدة» لتبدئي ✒" : ""}</div>`;
}
function filterTag(t){ activeTag = t; renderLibrary(); }

/* ---------- صفحة الرواية ---------- */
function renderNovel(id){
  const n = DB.novels.find(x => x.id === id);
  const el = document.getElementById("view-novel");
  if (!n) { el.innerHTML = `<div class="empty">لم نعثر على هذه الرواية.</div>`; return; }
  const cover = n.cover ? `<img src="${n.cover}" alt="">` : `<div class="ph">ELORIA</div>`;
  el.innerHTML = `
  <div class="novel-hero">
    <div class="cover">${cover}</div>
    <div>
      <h1>${esc(n.title)}</h1>
      <div>${(n.tags||[]).map(t=>`<span class="tag lilac">${esc(t)}</span>`).join("")}
        <span class="tag">${esc(n.status||"مستمرة")}</span></div>
      <p class="desc">${esc(n.desc||"")}</p>
      <div class="stat-row">
        <div class="stat"><b>${(n.chapters||[]).length}</b>عدد الفصول</div>
        <div class="stat"><b>${esc(n.status||"مستمرة")}</b>حالة الرواية</div>
      </div>
      ${(n.chapters||[]).length ? `<a class="btn btn-primary" href="#/read/${n.id}/${n.chapters[0].id}">ابدأ القراءة</a>` : ""}
      <span class="author-only">
        <button class="btn btn-secondary btn-sm" onclick="openNovelDialog('${n.id}')">تعديل الرواية</button>
        <button class="btn btn-danger btn-sm" onclick="deleteNovel('${n.id}')">حذف</button>
      </span>
    </div>
  </div>

  <div class="section-title"><span class="orn">✦</span><h2>الفصول</h2><div class="line"></div>
    <button class="btn btn-primary btn-sm author-only" onclick="openChapterDialog('${n.id}')">＋ فصل جديد</button>
  </div>
  <div class="author-only">
    <div class="dropzone" id="bulkDrop">🪶 أفلتي عدة ملفات <b>‎.txt / ‎.md</b> هنا لإضافتها كفصول دفعة واحدة</div>
  </div>
  <div class="chapter-list">
    ${(n.chapters||[]).map((c,i)=>`
      <div class="chapter-item" onclick="location.hash='#/read/${n.id}/${c.id}'">
        <span class="num">${i+1}</span>
        <span class="grow">${esc(c.title)}</span>
        <span class="author-only">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openChapterDialog('${n.id}','${c.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteChapter('${n.id}','${c.id}')">حذف</button>
        </span>
      </div>`).join("") || `<div class="empty">لا فصول بعد — القصة على وشك أن تبدأ ✨</div>`}
  </div>

  <div class="section-title"><span class="orn">❀</span><h2>الشخصيات الرئيسية</h2><div class="line"></div>
    <button class="btn btn-primary btn-sm author-only" onclick="openCharDialog('${n.id}')">＋ شخصية</button>
  </div>
  <div class="char-grid">
    ${(n.characters||[]).map((c,i)=>`
      <div class="char-card">
        <div class="av">${c.img ? `<img src="${c.img}">` : "🌸"}</div>
        <b>${esc(c.name)}</b><small>${esc(c.role||"")}</small>
        <div class="author-only" style="margin-top:.4rem"><button class="btn btn-danger btn-sm" onclick="deleteCharacter('${n.id}',${i})">حذف</button></div>
      </div>`).join("") || `<div class="empty" style="grid-column:1/-1">لم تُضف شخصيات بعد</div>`}
  </div>`;

  setupBulkDrop(n.id);
}

/* ---------- القراءة ---------- */
function renderReader(nid, cid){
  const n = DB.novels.find(x => x.id === nid);
  const el = document.getElementById("view-reader");
  if (!n) { el.innerHTML = `<div class="empty">لم نعثر على الرواية.</div>`; return; }
  const i = (n.chapters||[]).findIndex(c => c.id === cid);
  const c = n.chapters[i];
  if (!c) { el.innerHTML = `<div class="empty">لم نعثر على هذا الفصل.</div>`; return; }
  const prev = n.chapters[i-1], next = n.chapters[i+1];
  el.innerHTML = `
  <div class="reader-wrap">
    <div class="reader-bar">
      <a class="btn btn-ghost btn-sm" href="#/novel/${n.id}">↪ صفحة الرواية</a>
      <span class="title">${esc(c.title)}</span>
      <div class="font-ctl">
        <button onclick="fontSize(-1)" title="تصغير الخط">A-</button>
        <button onclick="fontSize(1)" title="تكبير الخط">A+</button>
      </div>
    </div>
    <div class="paper"><div class="chapter-text">${esc(c.text)}</div></div>
    <div class="reader-nav">
      ${prev ? `<a class="btn btn-secondary" href="#/read/${n.id}/${prev.id}">→ الفصل السابق</a>` : "<span></span>"}
      ${next ? `<a class="btn btn-primary" href="#/read/${n.id}/${next.id}">الفصل التالي ←</a>` : `<a class="btn btn-ghost" href="#/novel/${n.id}">نهاية الفصول المتاحة ✨</a>`}
    </div>
  </div>`;
}
let readerSize = parseFloat(localStorage.getItem("eloria-font") || "1.08");
document.documentElement.style.setProperty("--reader-size", readerSize+"rem");
function fontSize(d){
  readerSize = Math.min(1.6, Math.max(.85, readerSize + d*0.07));
  document.documentElement.style.setProperty("--reader-size", readerSize+"rem");
  localStorage.setItem("eloria-font", readerSize);
}
function updateProgress(){
  const fill = document.getElementById("progressFill");
  const onReader = document.getElementById("view-reader").classList.contains("active");
  if(!onReader){ fill.style.width="0"; return; }
  const max = document.documentElement.scrollHeight - innerHeight;
  fill.style.width = (max>0 ? (scrollY/max)*100 : 0) + "%";
}
addEventListener("scroll", updateProgress, {passive:true});

/* ---------- الاقتباسات ---------- */
function renderQuotes(){
  document.getElementById("quoteGrid").innerHTML = DB.quotes.length
    ? DB.quotes.map((q,i)=>`
      <div class="quote-card">
        <p>${esc(q.text)}</p>
        <small>— ${esc(q.source||"إيلوريا ستوري")}</small>
        <div class="author-only" style="margin-top:.5rem"><button class="btn btn-danger btn-sm" onclick="deleteQuote(${i})">حذف</button></div>
      </div>`).join("")
    : `<div class="empty" style="grid-column:1/-1">لا اقتباسات بعد</div>`;
}

/* ---------- عن الكاتبة ---------- */
function renderAbout(){
  document.getElementById("aboutText").textContent = DB.about || "اكتبي هنا نبذة عنك وعن عوالمك...";
}
function editAbout(){
  const t = prompt("نبذة عن الكاتبة:", DB.about || "");
  if (t !== null) { DB.about = t; persist(); renderAbout(); toast("تم حفظ النبذة"); }
}

/* ══════════════ وضع المؤلفة ══════════════ */
document.getElementById("authorKey").onclick = () => {
  if (document.body.classList.contains("author")) {
    document.body.classList.remove("author");
    sessionStorage.removeItem("eloria-author");
    toast("تم الخروج من وضع المؤلفة");
  } else {
    const p = prompt("🗝 كلمة سر المؤلفة:");
    if (p === AUTHOR_PASS) {
      document.body.classList.add("author");
      sessionStorage.setItem("eloria-author","1");
      toast("أهلًا بعودتك ✒ — وضع المؤلفة مفعّل");
      addAuthorToolbar();
    } else if (p !== null) toast("كلمة السر غير صحيحة");
  }
  route();
};
if (sessionStorage.getItem("eloria-author")) document.body.classList.add("author");

/* شريط أدوات المؤلفة: نشر بضغطة زر + نسخ احتياطي */
function addAuthorToolbar(){
  if (document.getElementById("authorBar")) return;
  const bar = document.createElement("div");
  bar.id = "authorBar";
  bar.className = "author-only";
  bar.style.cssText = "max-width:1180px;margin:1rem auto 0;padding:0 1.2rem";
  bar.innerHTML = `<div class="panel" style="margin:0; display:flex; gap:.7rem; flex-wrap:wrap; align-items:center">
    <b style="color:var(--plum)">✒ أدوات النشر:</b>
    <button class="btn btn-primary btn-sm" onclick="publishData()">🚀 نشر للزوار</button>
    <button class="btn btn-secondary btn-sm" onclick="openPublishSetup()">⚙ إعداد النشر</button>
    <button class="btn btn-ghost btn-sm" onclick="exportData()">⬇ نسخة احتياطية</button>
    <label class="btn btn-ghost btn-sm" style="cursor:pointer">⬆ استيراد<input type="file" accept=".json" hidden onchange="importData(this)"></label>
    <small class="muted" id="pubStatus"></small>
  </div>`;
  document.querySelector("header").after(bar);
  refreshPubStatus();
}
if (sessionStorage.getItem("eloria-author")) addAuthorToolbar();

/* ---------- النشر المباشر إلى GitHub ---------- */
const GH_KEY = "eloria-gh";
function getGH(){ try { return JSON.parse(localStorage.getItem(GH_KEY)); } catch(e){ return null; } }
function refreshPubStatus(){
  const el = document.getElementById("pubStatus");
  if (!el) return;
  const gh = getGH();
  el.textContent = gh ? `متصل بـ ${gh.owner}/${gh.repo} ✓` : "لم يُضبط النشر بعد — اضغطي «إعداد النشر»";
}
function openPublishSetup(){
  const gh = getGH();
  if (gh){ ghRepo.value = `https://github.com/${gh.owner}/${gh.repo}`; ghToken.value = gh.token; ghBranch.value = gh.branch; }
  publishDialog.showModal();
}
function savePublishSetup(){
  const m = ghRepo.value.trim().replace(/^https?:\/\/github\.com\//,"").replace(/\/+$/,"").split("/");
  if (m.length < 2 || !m[0] || !m[1]) return toast("تأكدي من رابط المستودع (مثال: github.com/username/eloria)");
  if (!ghToken.value.trim()) return toast("أدخلي مفتاح النشر");
  localStorage.setItem(GH_KEY, JSON.stringify({
    owner:m[0], repo:m[1], token:ghToken.value.trim(), branch:(ghBranch.value.trim()||"main")
  }));
  publishDialog.close(); refreshPubStatus(); toast("تم حفظ الإعداد — جرّبي زر النشر 🚀");
}
/* تحويل النص إلى base64 مع دعم العربية والملفات الكبيرة */
function b64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function publishData(){
  const gh = getGH();
  if (!gh){ toast("أولًا: إعداد النشر (مرة واحدة)"); return openPublishSetup(); }
  toast("جارٍ النشر... 🕊");
  const api = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/data.json`;
  const headers = { "Authorization":"Bearer "+gh.token, "Accept":"application/vnd.github+json" };
  try {
    let sha = null;
    const g = await fetch(`${api}?ref=${gh.branch}`, { headers });
    if (g.ok) sha = (await g.json()).sha;
    const body = { message:"تحديث المحتوى من موقع إيلوريا ✒", branch: gh.branch,
                   content: b64(JSON.stringify(DB, null, 2)) };
    if (sha) body.sha = sha;
    const r = await fetch(api, { method:"PUT", headers, body: JSON.stringify(body) });
    if (r.ok) toast("تم النشر ✨ سيظهر للزوار خلال دقيقة تقريبًا");
    else if (r.status === 401 || r.status === 403) toast("المفتاح غير صالح أو انتهت صلاحيته — أعيدي «إعداد النشر»");
    else if (r.status === 404) toast("لم نجد المستودع — تأكدي من الرابط وصلاحيات المفتاح");
    else if (r.status === 409) toast("تعارض في الحفظ — أعيدي المحاولة الآن");
    else toast("تعذر النشر (رمز "+r.status+") — أعيدي المحاولة");
  } catch(e){ toast("تعذر الاتصال بالإنترنت — أعيدي المحاولة"); }
}

function exportData(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  a.click();
  toast("تم تنزيل نسخة احتياطية — احتفظي بها في مكان آمن");
}
function importData(inp){
  const f = inp.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { DB = JSON.parse(r.result); persist(); route(); toast("تم الاستيراد بنجاح"); }
    catch(e){ toast("الملف غير صالح"); }
  };
  r.readAsText(f);
}

/* ---------- روايات: إضافة / تعديل / حذف ---------- */
function openNovelDialog(id){
  editing.novelId = id || null;
  document.getElementById("novelDlgTitle").textContent = id ? "تعديل الرواية" : "رواية جديدة";
  const n = id ? DB.novels.find(x=>x.id===id) : {};
  nvTitle.value = n.title||""; nvStatus.value = n.status||"مستمرة";
  nvTags.value = (n.tags||[]).join(", "); nvDesc.value = n.desc||""; nvCover.value = "";
  novelDialog.showModal();
}
function saveNovel(){
  if (!nvTitle.value.trim()) return toast("أدخلي عنوان الرواية");
  const done = cover => {
    if (editing.novelId){
      const n = DB.novels.find(x=>x.id===editing.novelId);
      Object.assign(n, {title:nvTitle.value.trim(), status:nvStatus.value,
        tags:nvTags.value.split(",").map(t=>t.trim()).filter(Boolean), desc:nvDesc.value});
      if (cover) n.cover = cover;
    } else {
      DB.novels.push({id:uid(), title:nvTitle.value.trim(), status:nvStatus.value,
        tags:nvTags.value.split(",").map(t=>t.trim()).filter(Boolean),
        desc:nvDesc.value, cover:cover||"", chapters:[], characters:[]});
    }
    persist(); novelDialog.close(); route(); toast("تم حفظ الرواية 🌸");
  };
  const f = nvCover.files[0];
  if (f) readImage(f, done); else done(null);
}
function deleteNovel(id){
  if (!confirm("حذف الرواية بكل فصولها؟ لا يمكن التراجع.")) return;
  DB.novels = DB.novels.filter(n=>n.id!==id);
  persist(); location.hash = "#/library"; toast("تم حذف الرواية");
}
/* ضغط الصور حتى لا تمتلئ الذاكرة */
function readImage(file, cb){
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 700, k = Math.min(1, max/Math.max(img.width,img.height));
      const cv = document.createElement("canvas");
      cv.width = img.width*k; cv.height = img.height*k;
      cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      cb(cv.toDataURL("image/jpeg",.82));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

/* ---------- فصول ---------- */
function openChapterDialog(nid, cid){
  editing.novelId = nid; editing.chapterId = cid||null;
  document.getElementById("chDlgTitle").textContent = cid ? "تعديل الفصل" : "فصل جديد";
  const n = DB.novels.find(x=>x.id===nid);
  const c = cid ? n.chapters.find(x=>x.id===cid) : {};
  chTitle.value = c.title||""; chText.value = c.text||"";
  chapterDialog.showModal();
}
function saveChapter(){
  if (!chTitle.value.trim()) return toast("أدخلي عنوان الفصل");
  const n = DB.novels.find(x=>x.id===editing.novelId);
  if (editing.chapterId){
    const c = n.chapters.find(x=>x.id===editing.chapterId);
    c.title = chTitle.value.trim(); c.text = chText.value;
  } else {
    n.chapters.push({id:uid(), title:chTitle.value.trim(), text:chText.value});
  }
  persist(); chapterDialog.close(); route(); toast("تم حفظ الفصل ✨");
}
function deleteChapter(nid, cid){
  if (!confirm("حذف هذا الفصل؟")) return;
  const n = DB.novels.find(x=>x.id===nid);
  n.chapters = n.chapters.filter(c=>c.id!==cid);
  persist(); route(); toast("تم حذف الفصل");
}

/* سحب وإفلات داخل نافذة الفصل */
const chDrop = document.getElementById("chDrop");
chDrop.onclick = () => chFile.click();
chFile.onchange = () => chFile.files[0] && readTextFile(chFile.files[0], (name, text) => {
  if (!chTitle.value) chTitle.value = name;
  chText.value = text;
});
["dragover","dragleave","drop"].forEach(ev => chDrop.addEventListener(ev, e => {
  e.preventDefault();
  chDrop.classList.toggle("drag", ev==="dragover");
  if (ev==="drop" && e.dataTransfer.files[0])
    readTextFile(e.dataTransfer.files[0], (name,text)=>{ if(!chTitle.value) chTitle.value=name; chText.value=text; });
}));
function readTextFile(f, cb){
  const r = new FileReader();
  r.onload = () => cb(f.name.replace(/\.(txt|md)$/i,""), r.result);
  r.readAsText(f);
}

/* سحب وإفلات جماعي في صفحة الرواية */
function setupBulkDrop(nid){
  const z = document.getElementById("bulkDrop");
  if (!z) return;
  ["dragover","dragleave","drop"].forEach(ev => z.addEventListener(ev, e => {
    e.preventDefault();
    z.classList.toggle("drag", ev==="dragover");
    if (ev==="drop"){
      const files = [...e.dataTransfer.files].filter(f=>/\.(txt|md)$/i.test(f.name));
      if (!files.length) return toast("الملفات المقبولة: txt أو md");
      const n = DB.novels.find(x=>x.id===nid);
      let left = files.length;
      files.forEach(f => readTextFile(f, (name, text) => {
        n.chapters.push({id:uid(), title:name, text});
        if (--left === 0){ persist(); route(); toast(`أُضيف ${files.length} فصل ✨`); }
      }));
    }
  }));
}

/* ---------- شخصيات ---------- */
function openCharDialog(nid){
  editing.novelId = nid;
  crName.value=""; crRole.value=""; crImg.value="";
  charDialog.showModal();
}
function saveCharacter(){
  if (!crName.value.trim()) return toast("أدخلي اسم الشخصية");
  const n = DB.novels.find(x=>x.id===editing.novelId);
  const done = img => {
    (n.characters ||= []).push({name:crName.value.trim(), role:crRole.value.trim(), img:img||""});
    persist(); charDialog.close(); route(); toast("أُضيفت الشخصية 🌸");
  };
  const f = crImg.files[0];
  if (f) readImage(f, done); else done(null);
}
function deleteCharacter(nid, i){
  if (!confirm("حذف الشخصية؟")) return;
  DB.novels.find(x=>x.id===nid).characters.splice(i,1);
  persist(); route();
}

/* ---------- اقتباسات ---------- */
function openQuoteDialog(){ qText.value=""; qSource.value=""; quoteDialog.showModal(); }
function saveQuote(){
  if (!qText.value.trim()) return toast("أدخلي نص الاقتباس");
  DB.quotes.push({text:qText.value.trim(), source:qSource.value.trim()});
  persist(); quoteDialog.close(); renderQuotes(); toast("أُضيف الاقتباس ❝");
}
function deleteQuote(i){
  if (!confirm("حذف الاقتباس؟")) return;
  DB.quotes.splice(i,1); persist(); renderQuotes();
}

/* ---------- تنبيه ---------- */
let toastTimer;
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 2600);
}

/* ---------- انطلاق ---------- */
loadData().then(route);
