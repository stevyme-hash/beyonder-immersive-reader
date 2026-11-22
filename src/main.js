import "./styles.css";
import { siteConfig } from "./config.js";
import { volumeCatalog, volumeProgress } from "./volumes.js";
import { getUniverseContext, renderUniverseDetail, renderUniversePage } from "./universe.js";

const app = document.querySelector("#app");
const environmentOptions = ["fog", "backlund", "tingen", "spirit"];
const savedEnvironment = localStorage.getItem("beyonder-environment");

let state = {
  route: "home",
  menuOpen: false,
  book: "lotm",
  chapter: Number(location.hash.match(/(?:lotm|coi)-(\d+)/)?.[1] || JSON.parse(localStorage.getItem("beyonder-last-read") || '{"chapter":1}').chapter || 1),
  lastRead: JSON.parse(localStorage.getItem("beyonder-last-read") || '{"book":"lotm","chapter":1}'),
  selectedVolume: null,
  sideStories: false,
  query: "",
  panel: null,
  theme: localStorage.getItem("beyonder-theme") || "nocturne",
  fontSize: Number(localStorage.getItem("beyonder-font-size") || 18),
  lineHeight: Number(localStorage.getItem("beyonder-line-height") || 1.82),
  width: Number(localStorage.getItem("beyonder-width") || 720),
  progress: JSON.parse(localStorage.getItem("beyonder-progress") || "{}"),
  bookmarks: JSON.parse(localStorage.getItem("beyonder-bookmarks") || "{}"),
  journal: JSON.parse(localStorage.getItem("beyonder-journal") || "[]"),
  quotes: JSON.parse(localStorage.getItem("beyonder-quotes") || "[]"),
  history: JSON.parse(localStorage.getItem("beyonder-history") || "[]"),
  activityDays: JSON.parse(localStorage.getItem("beyonder-activity-days") || "[]"),
  selectedUniverseItem: null,
  allowFullSpoilers: localStorage.getItem("beyonder-full-spoilers") === "true",
  environment: environmentOptions.includes(savedEnvironment) ? savedEnvironment : "fog",
  reducedEffects: localStorage.getItem("beyonder-reduced-effects") === "true",
  ambienceOn: false,
  narration: false,
  chapterHtml: "",
  loading: false,
  loadError: ""
};

const manifests = {};
let motionObserver;
const icon = name => ({
  search:"⌕", bookmark:"♡", bookmarkFilled:"♥", close:"×", settings:"⚙",
  left:"←", right:"→", home:"⌂", chapters:"▤", audio:"◉", menu:"☰"
}[name] || "");

async function loadManifest(bookId) {
  if (manifests[bookId]) return manifests[bookId];
  const response = await fetch(`/content/${bookId}/manifest.json`);
  if (!response.ok) throw new Error(`Could not load ${bookId} manifest`);
  manifests[bookId] = await response.json();
  return manifests[bookId];
}

function persist() {
  localStorage.setItem("beyonder-theme", state.theme);
  localStorage.setItem("beyonder-font-size", state.fontSize);
  localStorage.setItem("beyonder-line-height", state.lineHeight);
  localStorage.setItem("beyonder-width", state.width);
  localStorage.setItem("beyonder-bookmarks", JSON.stringify(state.bookmarks));
  localStorage.setItem("beyonder-progress", JSON.stringify(state.progress));
  localStorage.setItem("beyonder-journal", JSON.stringify(state.journal));
  localStorage.setItem("beyonder-quotes", JSON.stringify(state.quotes));
  localStorage.setItem("beyonder-history", JSON.stringify(state.history.slice(0, 100)));
  localStorage.setItem("beyonder-activity-days", JSON.stringify(state.activityDays.slice(-365)));
  localStorage.setItem("beyonder-environment", state.environment);
  localStorage.setItem("beyonder-reduced-effects", String(state.reducedEffects));
  localStorage.setItem("beyonder-full-spoilers", String(state.allowFullSpoilers));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdownToHtml(markdown) {
  let text = markdown.replace(/^---[\s\S]*?^---\s*/m, "");
  text = text.replace(/^#(?:#)?\s+Chapter\s+\d+\s*:\s*.+$/gm, "");
  text = text.replace(/\r/g, "");
  const lines = text.split("\n");
  let html = "";
  let paragraph = [];
  let afterAuthorsNotes = false;
  const flush = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(" ").trim();
    if (joined) html += `<p>${inlineMarkdown(joined)}</p>`;
    paragraph = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (/^Author(?:'s|’s)\s+Notes:\s*$/i.test(trimmed)) afterAuthorsNotes = true;
    if (/^---+$/.test(trimmed)) { flush(); continue; }
    const image = trimmed.match(/^!\[(.*?)\]\(([^)]+)\)/);
    if (image) {
      flush();
      let src = image[2].split("{")[0].trim();
      src = src.replace(/^(\.\.\/)+images\//, "/assets/");
      src = src.replace(/^images\//, "/assets/");
      const appendixClass = afterAuthorsNotes ? " chapter-art-appendix" : "";
      html += `<figure class="chapter-art${appendixClass}"><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" loading="lazy"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      flush();
      const level = trimmed.match(/^#+/)?.[0].length || 2;
      const heading = trimmed.replace(/^#{1,6}\s*/, "").replace(/\s*\{epub:type=[^}]*\}\s*$/i, "");
      html += `<h${level}>${inlineMarkdown(heading)}</h${level}>`;
      continue;
    }
    if (/^[-*]\s/.test(trimmed)) {
      flush();
      html += `<li>${inlineMarkdown(trimmed.replace(/^[-*]\s*/, ""))}</li>`;
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return html;
}

async function loadChapter(bookId, number) {
  const manifest = await loadManifest(bookId);
  const item = manifest.chapters.find(c => c.number === Number(number));
  if (!item) {
    state.book = bookId;
    state.route = "library";
    state.selectedVolume = null;
    state.sideStories = false;
    state.query = "";
    await render(true);
    return;
  }
  state.chapter = Number(number);
  state.loading = true;
  state.loadError = "";
  await render(true);
  try {
    const response = await fetch(`/content/${bookId}/${item.file}`);
    if (!response.ok) throw new Error(`Chapter file could not be loaded (HTTP ${response.status}).`);
    state.chapterHtml = markdownToHtml(await response.text());
    state.loading = false;
  } catch (error) {
    state.loading = false;
    state.loadError = error instanceof Error ? error.message : "The chapter could not be loaded.";
    await render();
    return;
  }
  state.progress[`${bookId}:${number}`] = { percent: state.progress[`${bookId}:${number}`]?.percent || 0 };
  state.lastRead = { book: bookId, chapter: Number(number) };
  localStorage.setItem("beyonder-last-read", JSON.stringify(state.lastRead));
  const historyEntry = {
    book: bookId,
    chapter: Number(number),
    title: item.title,
    date: new Date().toLocaleDateString()
  };
  state.history = [historyEntry, ...state.history.filter(entry => !(entry.book === bookId && entry.chapter === Number(number)))].slice(0, 100);
  persist();
  await render(true);
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function shell(content) {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.reduceEffects = String(state.reducedEffects);
  return `<div class="page-shell" data-environment="${state.environment}">
    <header class="topbar">
      <button class="brand" data-action="home" aria-label="Go home"><span class="brand-mark">B</span><span>Beyonder<small>THE IMMERSIVE READER</small></span></button>
      <nav id="primary-navigation" class="main-nav ${state.menuOpen ? "open" : ""}" aria-label="Primary navigation">
        <button data-action="library">Library</button>
        <button data-action="gallery">Gallery</button>
        <button data-action="universe-route" data-route="journal">Journal</button>
      </nav>
      <div class="top-actions">
        <button class="icon-button" data-action="search" aria-label="Search chapters">${icon("search")}</button>
        <button class="icon-button menu-button" data-action="mobile-menu" aria-label="${state.menuOpen ? "Close" : "Open"} navigation" aria-expanded="${state.menuOpen}" aria-controls="primary-navigation">${icon("menu")}</button>
      </div>
    </header>
    ${content}
    ${state.ambienceOn ? `<button class="ambience-indicator" data-action="ambience" title="Turn ambience off">AMBIENCE ON · TURN OFF</button>` : ""}
  </div>`;
}

async function homeView() {
  const lotm = await loadManifest("lotm");
  const coi = await loadManifest("coi");
  const latest = lotm.chapters.filter(chapter => chapter.number <= 1394).slice(-4).reverse();
  const savedBook = state.lastRead?.book === "coi" ? coi : lotm;
  const savedChapter = savedBook.chapters.find(chapter => chapter.number === state.lastRead?.chapter) || savedBook.chapters[0] || null;
  const savedPercent = savedChapter ? state.progress[`${savedBook.id}:${savedChapter.number}`]?.percent || 0 : 0;
  return shell(`
    <main>
      <section class="hero">
        <div class="hero-art">${lotm.chapters.length ? `<img src="/assets/lotm/backgrounds/spirit_world.webp" alt="A view of the Spirit World">` : ""}</div>
        <div class="hero-shade"></div>
        <div class="hero-content reveal">
          <p class="eyebrow">THE IMMERSIVE CHRONICLE</p>
          <h1>Lord of the<br><em>Mysteries</em></h1>
          <p class="hero-deck">Step beyond the gray fog, through secret societies and ancient mysteries.</p>
          <div class="hero-actions">
            <button class="primary-button" data-action="continue" ${savedChapter ? "" : "disabled"}>${savedChapter ? `Continue reading <span>${icon("right")}</span>` : "Add chapter content to begin"}</button>
            <button class="text-button" data-action="library">Explore the library</button>
          </div>
          ${savedChapter ? `<div class="continue-note"><span>RETURN TO YOUR PLACE</span><b>${escapeHtml(savedBook.title)} · ${String(savedChapter.number).padStart(4,"0")}</b><small>${escapeHtml(savedChapter.title)}${savedPercent ? ` · ${savedPercent}%` : ""}</small></div>` : `<div class="continue-note"><span>YOUR CHRONICLE AWAITS</span><small>Add chapter files you are authorized to use. See README for setup.</small></div>`}
        </div>
        ${state.reducedEffects ? "" : `<div class="hero-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>`}
      </section>
      <section class="bookshelf-section">
        <div class="section-heading"><div><p class="eyebrow">TWO CHRONICLES</p><h2>Choose your book</h2></div></div>
        <div class="book-shelf">
          ${[
            { id:"lotm", book:lotm, subtitle:"The Fool's journey begins", image:"/assets/lotm/cover.webp", label:"BOOK ONE" },
            { id:"coi", book:coi, subtitle:"A new fate stirs in Trier", image:"/assets/coi/cover.webp", label:"BOOK TWO" }
          ].map((item, index) => `<button class="book-object reveal" style="--delay:${index*120}ms" data-action="open-book" data-book="${item.id}">
            <span class="book-cover">${item.book.chapters.length ? `<img src="${item.image}" alt="" loading="lazy">` : `<span class="cover-placeholder">✧</span>`}<span class="cover-emblem">✧</span></span>
            <span class="book-details"><small>${item.label} · ${item.book.chapters.length.toLocaleString()} CHAPTERS</small><b>${escapeHtml(item.book.title)}</b><span>${item.subtitle}</span><em>ENTER THE CHRONICLE ${icon("right")}</em></span>
          </button>`).join("")}
        </div>
      </section>
      <section class="content-section">
        <div class="section-heading"><div><p class="eyebrow">THE CHRONICLE</p><h2>Latest chapters</h2></div><button class="text-button" data-action="library">View all ${icon("right")}</button></div>
        <div class="chapter-grid">${latest.length ? latest.map((c,i) => `
          <button class="chapter-card reveal" style="--delay:${i*70}ms" data-action="chapter" data-number="${c.number}">
            <span class="chapter-no">${String(c.number).padStart(4,"0")}</span>
            <span class="chapter-card-copy"><small>${c.category || "Lord of the Mysteries"}</small><b>${c.title}</b></span>
            <span class="arrow">${icon("right")}</span>
          </button>`).join("") : `<p class="empty-state">No recent chapters are available.</p>`}</div>
      </section>
      <section class="feature-section">
        <div class="feature-image">${lotm.chapters.length ? `<img src="/assets/lotm/backgrounds/backlund_city.webp" alt="A view of Backlund" loading="lazy">` : ""}</div>
        <div class="feature-copy"><p class="eyebrow">FROM THE COLLECTION</p><h2>Worlds within the chronicle</h2><p>Explore chapter-specific illustrations, character studies, and settings from the included collection.</p><button class="text-button" data-action="gallery">Open artwork gallery ${icon("right")}</button></div>
      </section>
    </main>${footer()}`);
}

async function libraryView() {
  const manifest = await loadManifest(state.book);
  const q = state.query.trim().toLowerCase();
  const volumes = volumeCatalog[state.book];
  const queryResults = q ? manifest.chapters.filter(chapter => `${chapter.number} ${chapter.title} ${chapter.category}`.toLowerCase().includes(q)) : null;
  const selected = volumes.find(volume => volume.number === state.selectedVolume);
  const selectedChapters = selected
    ? manifest.chapters.filter(chapter => chapter.number >= selected.start && chapter.number <= selected.end)
    : state.sideStories
      ? manifest.chapters.filter(chapter => chapter.number > volumes[volumes.length - 1].end)
      : [];
  const visibleChapters = queryResults || selectedChapters;
  const showChapterList = queryResults !== null || Boolean(selected) || state.sideStories;
  const progressPercent = selected ? volumeProgress(state.book, manifest.chapters, selected, state.progress) : 0;
  const volumeCards = volumes.map(volume => {
    const chapters = manifest.chapters.filter(chapter => chapter.number >= volume.start && chapter.number <= volume.end);
    const percent = volumeProgress(state.book, manifest.chapters, volume, state.progress);
    const cover = state.book === "lotm"
      ? `/assets/lotm/book/${String(volume.number).padStart(4,"0")}.webp`
      : "/assets/coi/cover.webp";
    return `<button class="volume-card reveal" data-action="select-volume" data-volume="${volume.number}">
      <span class="volume-card-cover"><img src="${cover}" alt="" loading="lazy"><span class="volume-seal">${String(volume.number).padStart(2,"0")}</span></span>
      <span class="volume-card-info"><small>VOLUME ${String(volume.number).padStart(2,"0")}</small><b>${escapeHtml(volume.title)}</b><span>Chapters ${volume.start}–${volume.end}</span><span>${chapters.length} chapters <i>${percent}% read</i></span>
      <span class="volume-progress"><i style="width:${percent}%"></i></span><em>OPEN VOLUME ${icon("right")}</em></span>
    </button>`;
  }).join("");
  return shell(`<main class="library-page ${state.book === "coi" ? "coi-library" : "lotm-library"}">
    <section class="page-intro"><p class="eyebrow">${manifest.title}</p><h1>Chapter Library</h1>
      <div class="series-tabs"><button class="${state.book === "lotm" ? "active" : ""}" data-action="switch-book" data-book="lotm">Lord of the Mysteries</button><button class="${state.book === "coi" ? "active" : ""}" data-action="switch-book" data-book="coi">Circle of Inevitability</button></div>
      <div class="search-box">${icon("search")}<input id="chapter-search" type="search" placeholder="Search all ${manifest.chapters.length.toLocaleString()} chapters..." value="${escapeHtml(state.query)}" aria-label="Search chapters"><kbd>⌘ K</kbd></div>
    </section>
    ${showChapterList ? `<section class="chapter-results">
      <div class="volume-heading results-heading"><button class="back-volumes" data-action="back-volumes">${icon("left")} ${queryResults ? "CLEAR SEARCH" : "ALL VOLUMES"}</button><div><p>${queryResults ? `${visibleChapters.length} MATCHING CHAPTERS` : selected ? `VOLUME ${selected.number} · CHAPTERS ${selected.start}–${selected.end} · ${progressPercent}% READ` : "BONUS CONTENT"}</p><h2>${queryResults ? "Search results" : selected ? escapeHtml(selected.title) : "Side Stories & Bonus Content"}</h2></div></div>
      <div class="library-list">${visibleChapters.map(c => {
      const key = `${state.book}:${c.number}`;
      const saved = state.progress[key]?.percent || 0;
      const bookmarked = state.bookmarks[key];
      return `<button class="library-row" data-action="chapter" data-number="${c.number}"><span>${String(c.number).padStart(4,"0")}</span><div><h3>${escapeHtml(c.title)}</h3><small>${saved ? `${saved}% read` : "Unstarted"}</small></div><span class="bookmark-state">${bookmarked ? icon("bookmarkFilled") : icon("bookmark")}</span></button>`;
    }).join("") || `<p class="empty-state">No chapters match that search.</p>`}</div></section>`
    : `<section class="volume-catalog"><div class="section-heading"><div><p class="eyebrow">THE NARRATIVE ARC</p><h2>Volumes</h2></div><span class="catalog-count">${volumes.length} VOLUMES</span></div><div class="volume-grid">${volumeCards}</div>
      <button class="bonus-card" data-action="select-side-stories"><span>✦</span><span><small>BEYOND THE MAIN VOLUMES</small><b>Side Stories & Bonus Content</b><em>Browse the extras collection ${icon("right")}</em></span><strong>${manifest.chapters.filter(chapter => chapter.number > volumes[volumes.length-1].end).length} CHAPTERS</strong></button>
    </section>`}
  </main>${footer()}`);
}

async function galleryView() {
  const categories = [
    ["Characters","lotm/characters"],
    ["World","lotm/backgrounds"],
    ["Volume art","lotm/vol_1"],
    ["Volume covers","lotm/book"]
  ];
  const candidates = {
    "Characters":["klein_moretti_nighthawk.webp","the_fool.webp","zhou_mingrui.webp","audrey_hall.webp","leonard_mitchell.webp","dunn_smith.webp"],
    "World":["city_of_silver.webp","tingen_city.webp","backlund_city.webp","mind_world.webp","spirit_world.webp","divination_club.webp"],
    "Volume art":["0001_the_dark_ink_wrote_the_fo.webp","0001_the_sound_asleep_zhou_min.webp","0005_alright_which_card_would.webp","0017_you_don_t_know_leonard_di.webp","Miscellaneous/nighthawks.webp","Miscellaneous/luck_enhancement_ritual.webp"],
    "Volume covers":["0001.webp","0002.webp","0003.webp","0004.webp","0005.webp","0006.webp"]
  };
  return shell(`<main class="gallery-page"><section class="page-intro"><p class="eyebrow">THE COLLECTION</p><h1>Illustration Gallery</h1></section>${categories.map(([title,prefix]) => `<section class="gallery-section"><h2>${title}</h2><div class="gallery-grid">${candidates[title].map((file,i) => `<button class="art-card reveal" style="--delay:${i*50}ms" data-action="lightbox" data-src="/assets/${prefix}/${file}" data-name="${title}"><img src="/assets/${prefix}/${file}" alt="${title} artwork" loading="lazy"><div><p>${file.replace(/_/g," ").replace(/\.(webp|jpg)$/,"")}</p><small>Included collection artwork</small></div></button>`).join("")}</div></section>`).join("")}</main>${footer()}`);
}

async function readerView() {
  const manifest = await loadManifest(state.book);
  const index = manifest.chapters.findIndex(c => c.number === state.chapter);
  const chapter = manifest.chapters[index];
  if (!chapter) return;
  const prev = manifest.chapters[index-1], next = manifest.chapters[index+1];
  const key = `${state.book}:${state.chapter}`;
  const bookmarked = state.bookmarks[key];
  return shell(`<main class="reader-page">
    <aside class="reader-rail">
      <button data-action="home" title="Home">${icon("home")}</button>
      <button data-action="library" title="Chapter list">${icon("chapters")}</button>
      <button data-action="bookmark" title="Bookmark">${bookmarked ? icon("bookmarkFilled") : icon("bookmark")}</button>
      <button data-action="save-highlight" title="Save selected highlight">❝</button>
      <button data-action="add-note" title="Add a note">✎</button>
      <button data-action="journal" title="Reading journal">▧</button>
      <button data-action="settings" title="Reader settings">${icon("settings")}</button>
    </aside>
    <div class="reading-progress" id="reading-progress"></div>
    <article class="reading-column" style="--reader-width:${state.width}px;--font-size:${state.fontSize}px;--line-height:${state.lineHeight}">
      <header class="chapter-header"><p class="eyebrow">${escapeHtml(chapter.category)} · Chapter ${String(chapter.number).padStart(4,"0")}</p><h1>${escapeHtml(chapter.title)}</h1></header>
      ${state.loading ? `<div class="chapter-loader"><span></span><p>Opening chapter</p></div>` : state.loadError ? `<div class="chapter-error"><p>${escapeHtml(state.loadError)}</p><button class="text-button" data-action="chapter" data-number="${chapter.number}">Try again ${icon("right")}</button></div>` : `<div class="chapter-body">${state.chapterHtml}</div>`}
      <nav class="chapter-navigation">
        ${prev ? `<button class="previous" data-action="chapter" data-number="${prev.number}"><small>${icon("left")} PREVIOUS</small><b>${escapeHtml(prev.title)}</b></button>` : `<span></span>`}
        ${next ? `<button class="next" data-action="chapter" data-number="${next.number}"><small>NEXT ${icon("right")}</small><b>${escapeHtml(next.title)}</b></button>` : `<button class="next" data-action="library"><small>END OF AVAILABLE CONTENT</small><b>Return to library</b></button>`}
      </nav>
    </article>
    ${settingsPanel()}
    <button class="settings-scrim ${state.panel === "settings" ? "visible" : ""}" data-action="close-panel" aria-label="Close reader settings"></button>
    ${narrationBar(chapter)}
  </main>`);
}

function settingsPanel() {
  return `<aside class="settings-panel ${state.panel === "settings" ? "open" : ""}" aria-label="Reader settings">
    <div class="panel-heading"><h2>Reader settings</h2><button data-action="close-panel" aria-label="Close">${icon("close")}</button></div>
    <label>Theme<div class="theme-options"><button class="${state.theme==="nocturne"?"active":""}" data-theme="nocturne">Night</button><button class="${state.theme==="sepia"?"active":""}" data-theme="sepia">Sepia</button><button class="${state.theme==="paper"?"active":""}" data-theme="paper">Light</button></div></label>
    <label>Text size<div class="range-row"><button data-setting="font-down">A−</button><input id="font-size" type="range" min="15" max="24" value="${state.fontSize}"><button data-setting="font-up">A+</button></div></label>
    <label>Line spacing<input id="line-height" type="range" min="1.5" max="2.2" step=".05" value="${state.lineHeight}"></label>
    <label>Reading width<input id="reader-width" type="range" min="580" max="860" step="20" value="${state.width}"></label>
    <label>Reading environment<select id="reader-environment">
      ${[["fog","Gray Fog"],["backlund","Backlund"],["tingen","Tingen"],["spirit","Spirit World"]].map(([id,label]) => `<option value="${id}" ${state.environment === id ? "selected" : ""}>${label}</option>`).join("")}
    </select></label>
    <label class="effects-toggle"><input id="reduced-effects" type="checkbox" ${state.reducedEffects ? "checked" : ""}> Reduce atmospheric effects</label>
    <button class="ambience-toggle" data-action="ambience">${state.ambienceOn ? "Stop" : "Start"} subtle ambience <small>Never autoplay</small></button>
  </aside>`;
}

function narrationBar(chapter) {
  return `<div class="narration-bar ${state.narration ? "playing" : ""}">
    <button class="narration-main" data-action="narrate" aria-label="Narrate chapter">${state.narration ? "Ⅱ" : "▶"}</button>
    <div class="narration-meta"><small>NARRATION</small><b>${escapeHtml(chapter.title)}</b></div>
    <label><span>Speed</span><select id="speed"><option>0.75×</option><option selected>1×</option><option>1.25×</option><option>1.5×</option></select></label>
  </div>`;
}

function footer() {
  return `<footer><button data-action="home" class="footer-brand">Beyonder</button><p class="legal-disclaimer">Beyonder is an unofficial, non-commercial fan project. It is not affiliated with or endorsed by the author, Webnovel, or Yen Press, and it earns no money. All names and works belong to their respective owners.</p><div><button data-action="about">About</button></div></footer>`;
}

async function render(transition = false) {
  const update = async () => {
    if (["characters","atlas","artifacts","club","journal","achievements"].includes(state.route)) {
      app.innerHTML = shell(renderUniversePage(state.route, {
        ...getUniverseContext(state),
        detailHtml: renderUniverseDetail(state)
      }) + footer());
    } else if (state.route === "reader") app.innerHTML = await readerView();
    else if (state.route === "library") app.innerHTML = await libraryView();
    else if (state.route === "gallery") app.innerHTML = await galleryView();
    else app.innerHTML = await homeView();
    bind();
    app.querySelectorAll("img").forEach(image => {
      image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    });
    persist();
    setupMotion();
    setupReadingProgress();
    setupAtmosphere();
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (transition && typeof document.startViewTransition === "function" && !reducedMotion) {
    const navigation = document.startViewTransition(update);
    await navigation.updateCallbackDone;
  } else {
    await update();
  }
}

function setupMotion() {
  motionObserver?.disconnect();
  const targets = app.querySelectorAll([
    ".reveal", ".topbar", "footer", "main > section:not(.chapter-results)", ".section-heading",
    ".book-object", ".chapter-card", ".volume-card", ".bonus-card",
    ".library-row", ".art-card", ".chapter-art", ".chapter-header",
    ".chapter-navigation", ".gallery-section", ".universe-heading",
    ".character-card", ".location-card", ".artifact-card",
    ".universe-detail:not([hidden])", ".journal-columns > section",
    ".history-section", ".history-row", ".streak-card", ".achievement-card",
    ".universe-nav", ".club-copy", ".club-table", ".narration-bar"
  ].join(","));
  const showAll = () => targets.forEach(element => element.classList.add("is-visible"));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    showAll();
    return;
  }
  const siblingCounts = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: .06, rootMargin: "0px 0px -6% 0px" });
  motionObserver = observer;
  targets.forEach(element => {
    if (!element.classList.contains("reveal")) element.classList.add("motion-reveal");
    if (!element.style.getPropertyValue("--delay")) {
      const parent = element.parentElement;
      const index = siblingCounts.get(parent) || 0;
      siblingCounts.set(parent, index + 1);
      element.style.setProperty("--delay", `${Math.min(index, 7) * 55}ms`);
    }
    observer.observe(element);
  });
}

function setupReadingProgress() {
  const bar = document.querySelector("#reading-progress");
  if (!bar) return;
  let savedPercent = -1;
  const update = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const percent = total > 0 ? Math.min(100, Math.max(0, Math.round(window.scrollY / total * 100))) : 0;
    bar.style.width = `${percent}%`;
    if (percent !== savedPercent) {
      const progressKey = `${state.book}:${state.chapter}`;
      const previousPercent = state.progress[progressKey]?.percent || 0;
      const actualPercent = Math.max(previousPercent, percent);
      state.progress[progressKey] = { percent: actualPercent };
      savedPercent = percent;
      if (percent > 0) recordReadingActivity();
      if (actualPercent >= 90) completeChapter();
      persist();
    }
  };
  window.onscroll = update;
  update();
}

function setupAtmosphere() {
  const hero = document.querySelector(".hero");
  if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
  hero.addEventListener("pointermove", event => {
    const bounds = hero.getBoundingClientRect();
    const x = Math.max(-18, Math.min(18, ((event.clientX - bounds.left) / bounds.width - .5) * 36));
    const y = Math.max(-12, Math.min(12, ((event.clientY - bounds.top) / bounds.height - .5) * 24));
    hero.style.setProperty("--pointer-x", `${x}px`);
    hero.style.setProperty("--pointer-y", `${y}px`);
  }, { passive: true });
  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--pointer-x", "0px");
    hero.style.setProperty("--pointer-y", "0px");
  }, { passive: true });
}

function recordReadingActivity() {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.activityDays.includes(today)) state.activityDays.push(today);
}

function completeChapter() {
  const key = `${state.book}:${state.chapter}`;
  const completed = JSON.parse(localStorage.getItem("beyonder-completed") || "[]");
  if (!completed.includes(key)) {
    completed.push(key);
    localStorage.setItem("beyonder-completed", JSON.stringify(completed));
    state.completedCount = completed.length;
    showToast("Chapter completed", `Chapter ${state.chapter} added to your reading milestones.`);
  }
}

function showToast(title, message) {
  const toast = document.createElement("div");
  toast.className = "reader-toast";
  toast.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

let ambienceContext;
let ambienceGain;
function toggleAmbience() {
  if (state.ambienceOn) {
    ambienceGain?.gain.setTargetAtTime(0, ambienceContext.currentTime, .15);
    state.ambienceOn = false;
    const closingContext = ambienceContext;
    setTimeout(() => {
      closingContext?.close();
      if (ambienceContext === closingContext) {
        ambienceContext = undefined;
        ambienceGain = undefined;
      }
    }, 800);
    return;
  }
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) {
    alert("This browser does not support optional audio ambience.");
    return;
  }
  ambienceContext = new AudioContextType();
  const sampleCount = ambienceContext.sampleRate;
  const buffer = ambienceContext.createBuffer(1, sampleCount, ambienceContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index++) channel[index] = (Math.random() * 2 - 1) * .15;
  const source = ambienceContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ambienceContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 180;
  ambienceGain = ambienceContext.createGain();
  ambienceGain.gain.value = 0;
  source.connect(filter).connect(ambienceGain).connect(ambienceContext.destination);
  source.start();
  ambienceGain.gain.setTargetAtTime(.035, ambienceContext.currentTime, .7);
  state.ambienceOn = true;
}

function bind() {
  app.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", async () => {
    const action = el.dataset.action;
    if (action === "home") { state.route = "home"; state.menuOpen = false; history.pushState({}, "", location.pathname); await render(true); window.scrollTo(0, 0); }
    if (action === "library") { state.route = "library"; state.menuOpen = false; state.selectedVolume = null; state.sideStories = false; await render(true); window.scrollTo(0, 0); }
    if (action === "gallery") { state.route = "gallery"; state.menuOpen = false; await render(true); window.scrollTo(0, 0); }
    if (action === "universe-route") { state.route = el.dataset.route; state.menuOpen = false; state.selectedUniverseItem = null; await render(true); window.scrollTo(0, 0); }
    if (action === "mobile-menu") { state.menuOpen = !state.menuOpen; await render(); }
    if (action === "journal") { state.route = "journal"; await render(true); window.scrollTo(0, 0); }
    if (action === "ambience") { toggleAmbience(); await render(); }
    if (action === "save-highlight") {
      const selectedText = window.getSelection()?.toString().trim();
      if (!selectedText) {
        alert("Select a passage in the chapter first, then save the highlight.");
      } else {
        state.quotes.unshift({ book: state.book, chapter: state.chapter, date: new Date().toLocaleDateString(), text: selectedText, type: "HIGHLIGHT" });
        persist();
        showToast("Highlight saved", "The selected passage was added to your private journal.");
      }
    }
    if (action === "add-note") {
      const note = prompt("Add a private note to this chapter:");
      if (note?.trim()) {
        state.journal.unshift({ book: state.book, chapter: state.chapter, date: new Date().toLocaleDateString(), text: note.trim() });
        persist();
        showToast("Note saved", "Your note is stored in this browser.");
      }
    }
    if (action === "universe-nav") { state.route = el.dataset.page; await render(true); }
    if (action === "switch-book" || action === "open-book") {
      state.book = el.dataset.book; state.query = ""; state.selectedVolume = null; state.sideStories = false; state.route = "library"; await render(true); window.scrollTo(0, 0);
    }
    if (action === "select-volume") {
      state.selectedVolume = Number(el.dataset.volume); state.sideStories = false; state.query = ""; await render(true); window.scrollTo(0, 0);
    }
    if (action === "select-side-stories") {
      state.selectedVolume = null; state.sideStories = true; state.query = ""; await render(true); window.scrollTo(0, 0);
    }
    if (action === "back-volumes") {
      state.selectedVolume = null; state.sideStories = false; state.query = ""; await render(true); window.scrollTo(0, 0);
    }
    if (action === "continue") {
      state.book = state.lastRead?.book || "lotm";
      state.chapter = Number(state.lastRead?.chapter || 1);
      state.route = "reader";
      await loadChapter(state.book, state.chapter);
      history.pushState({}, "", `#${state.book}-${state.chapter}`);
    }
    if (action === "chapter") {
      state.route = "reader";
      await loadChapter(state.book, Number(el.dataset.number));
      history.pushState({}, "", `#${state.book}-${state.chapter}`);
    }
    if (action === "settings") { state.panel = "settings"; await render(); }
    if (action === "close-panel") { state.panel = null; await render(); }
    if (action === "bookmark") {
      const key = `${state.book}:${state.chapter}`;
      state.bookmarks[key] ? delete state.bookmarks[key] : state.bookmarks[key] = true;
      persist(); await render();
    }
    if (action === "search") { state.route = "library"; state.selectedVolume = null; state.sideStories = false; await render(true); setTimeout(() => document.querySelector("#chapter-search")?.focus(), 50); }
    if (action === "about") alert("Beyonder is an unofficial, non-commercial fan project. It is not affiliated with or endorsed by the author, Webnovel, or Yen Press, and it earns no money. All names and works belong to their respective owners.");
    if (action === "narrate") {
      if (!("speechSynthesis" in window)) return alert("Text-to-speech is unavailable in this browser.");
      if (state.narration) { speechSynthesis.cancel(); state.narration = false; await render(); return; }
      const text = document.querySelector(".chapter-body")?.innerText || "";
      const utterance = new SpeechSynthesisUtterance(text);
      const speed = document.querySelector("#speed")?.value || "1×";
      utterance.rate = Number(speed.replace("×",""));
      utterance.onend = () => { state.narration = false; render(); };
      speechSynthesis.cancel(); speechSynthesis.speak(utterance); state.narration = true; await render();
    }
    if (action === "lightbox") {
      const modal = document.createElement("dialog");
      modal.className = "lightbox";
      modal.innerHTML = `<button class="lightbox-close" aria-label="Close">×</button><img src="${el.dataset.src}" alt="${el.dataset.name}"><div><p>${el.dataset.name}</p><small>Included collection artwork</small></div>`;
      document.body.append(modal); modal.showModal();
      modal.querySelector("button").addEventListener("click", () => modal.close());
      modal.addEventListener("click", event => { if (event.target === modal) modal.close(); });
    }
  }));

  app.querySelectorAll("[data-universe-route]").forEach(el => el.addEventListener("click", async () => {
    state.route = el.dataset.universeRoute;
    state.selectedUniverseItem = null;
    await render(true);
    window.scrollTo(0, 0);
  }));
  app.querySelectorAll("[data-universe-action]").forEach(el => el.addEventListener("click", async () => {
    const action = el.dataset.universeAction;
    if (action === "select-location") {
      state.selectedUniverseItem = { type: "location", name: el.dataset.name, image: el.dataset.image };
      await render();
      document.querySelector(".universe-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    if (action === "inspect-artifact") {
      state.selectedUniverseItem = { type: "artifact", name: el.dataset.name, note: el.dataset.note };
      await render();
      document.querySelector(".universe-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    if (action === "spoiler-consent") {
      state.allowFullSpoilers = el.checked;
      persist();
      await render();
    }
    if (action === "open-entry") {
      state.book = el.dataset.book;
      state.route = "reader";
      await loadChapter(state.book, Number(el.dataset.chapter));
      history.pushState({}, "", `#${state.book}-${state.chapter}`);
    }
    if (action === "delete-entry") {
      const list = el.dataset.type === "NOTE" ? state.journal : state.quotes;
      list.splice(Number(el.dataset.index), 1);
      persist();
      await render();
    }
  }));

  app.querySelectorAll("[data-theme]").forEach(el => el.addEventListener("click", async () => { state.theme = el.dataset.theme; persist(); await render(); }));
  app.querySelectorAll("[data-setting]").forEach(el => el.addEventListener("click", async () => {
    if (el.dataset.setting === "font-up") state.fontSize = Math.min(24, state.fontSize + 1);
    if (el.dataset.setting === "font-down") state.fontSize = Math.max(15, state.fontSize - 1);
    persist(); await render();
  }));
  app.querySelector("#chapter-search")?.addEventListener("input", e => { state.query = e.target.value; render(); setTimeout(() => { const input = document.querySelector("#chapter-search"); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }, 0); });
  app.querySelector("#font-size")?.addEventListener("input", e => { state.fontSize = Number(e.target.value); persist(); document.querySelector(".reading-column")?.style.setProperty("--font-size", `${state.fontSize}px`); });
  app.querySelector("#line-height")?.addEventListener("input", e => { state.lineHeight = Number(e.target.value); persist(); document.querySelector(".reading-column")?.style.setProperty("--line-height", state.lineHeight); });
  app.querySelector("#reader-width")?.addEventListener("input", e => { state.width = Number(e.target.value); persist(); document.querySelector(".reading-column")?.style.setProperty("--reader-width", `${state.width}px`); });
  app.querySelector("#reader-environment")?.addEventListener("change", e => { state.environment = e.target.value; persist(); document.querySelector(".page-shell").dataset.environment = state.environment; });
  app.querySelector("#reduced-effects")?.addEventListener("change", e => { state.reducedEffects = e.target.checked; persist(); document.querySelector(".hero-atmosphere")?.toggleAttribute("hidden", state.reducedEffects); document.documentElement.dataset.reduceEffects = String(state.reducedEffects); });
}

async function initialize() {
  const match = location.hash.match(/(lotm|coi)-(\d+)/);
  if (match) {
    state.book = match[1]; state.chapter = Number(match[2]); state.route = "reader";
    await loadChapter(state.book, state.chapter);
  } else {
    await render();
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.panel) {
      state.panel = null;
      render();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); state.route = "library"; state.selectedVolume = null; state.sideStories = false; state.query = ""; render(true);
      setTimeout(() => document.querySelector("#chapter-search")?.focus(), 50);
    }
    if (state.route === "reader" && event.altKey && event.key === "ArrowLeft") {
      loadManifest(state.book).then(m => { const i=m.chapters.findIndex(c=>c.number===state.chapter); if(i>0) { const chapter=m.chapters[i-1].number; loadChapter(state.book,chapter).then(()=>history.pushState({}, "", `#${state.book}-${chapter}`)); } });
    }
    if (state.route === "reader" && event.altKey && event.key === "ArrowRight") {
      loadManifest(state.book).then(m => { const i=m.chapters.findIndex(c=>c.number===state.chapter); if(i<m.chapters.length-1) { const chapter=m.chapters[i+1].number; loadChapter(state.book,chapter).then(()=>history.pushState({}, "", `#${state.book}-${chapter}`)); } });
    }
  });
  window.addEventListener("popstate", async () => {
    const chapter = location.hash.match(/(lotm|coi)-(\d+)/);
    if (chapter) {
      state.book = chapter[1];
      state.route = "reader";
      await loadChapter(state.book, Number(chapter[2]));
    } else {
      state.route = "home";
      await render(true);
      window.scrollTo(0, 0);
    }
  });
}

initialize();
