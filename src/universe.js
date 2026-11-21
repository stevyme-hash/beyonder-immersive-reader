import { artifactStudies, characters, locations } from "./universe-data.js";
import { volumeCatalog } from "./volumes.js";

const routeTitles = {
  characters: "Character Codex", atlas: "World Atlas", artifacts: "Artifact Studies",
  club: "Tarot Club", journal: "Reading Journal", achievements: "Milestones"
};
const symbol = (name) => ({ right:"→", left:"←", home:"⌂" }[name] || "");
const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));

function navLinks(active, reading) {
  return `<nav class="universe-nav" aria-label="Universe navigation">
    ${[["characters","Characters"],["atlas","Atlas"],["artifacts","Museum"],["club","Tarot Club"],["journal","Journal"],["achievements","Milestones"]]
      .map(([id,label]) => `<button class="${active === id ? "active" : ""}" data-universe-route="${id}">${label}</button>`).join("")}
    <button class="universe-return" data-action="library">Return to reading ${symbol("right")}</button>
  </nav>`;
}

function charactersPage(context) {
  const latestRead = Math.max(0, ...Object.entries(context.state.progress).filter(([key,value]) => key.startsWith(`${context.state.book}:`) && value.percent >= 90).map(([key]) => Number(key.split(":")[1])));
  const unlocked = latestRead >= 1394 || context.state.allowFullSpoilers;
  return `<main class="universe-page collection-page"><header class="universe-heading"><p class="eyebrow">SPOILER-LOCKED COLLECTION</p><h1>Character Codex</h1><p>Portraits are from the locally supplied image collection. Profiles remain conservatively locked until the main story is complete, because precise first-appearance spoiler thresholds have not been independently verified.</p><label class="spoiler-toggle"><input type="checkbox" data-universe-action="spoiler-consent" ${context.state.allowFullSpoilers ? "checked" : ""}> I have finished the main story and want to reveal the full portrait index</label></header>
    <section class="character-grid">${characters.map(([file,name],index) => unlocked
      ? `<article class="character-card" style="--delay:${index % 8 * 35}ms"><img src="/assets/lotm/characters/${file}" alt="${esc(name)}" loading="lazy"><div><small>PORTRAIT INDEX</small><b>${esc(name)}</b><p>Canonical profile details require verified spoiler-safe sourcing.</p></div></article>`
      : `<article class="character-card character-locked"><div class="portrait-lock">◈</div><div><small>SEALED RECORD ${String(index + 1).padStart(2,"0")}</small><b>Details concealed</b><p>Complete the story or explicitly opt into full-story portrait spoilers.</p></div></article>`).join("")}</section>${navLinks("characters")}</main>`;
}

function atlasPage(context) {
  return `<main class="universe-page collection-page"><header class="universe-heading"><p class="eyebrow">ILLUSTRATIVE, NOT TO SCALE</p><h1>World Atlas</h1><p>Marker positions are decorative layout only and do not claim geographic accuracy. Select a place to view its included image and available reference status.</p></header>
    <section class="atlas"><img src="/assets/lotm/backgrounds/backlund_city.webp" alt="" loading="lazy"><div class="atlas-overlay"></div>${locations.map((location,index) => `<button class="map-marker" style="--x:${location.x}%;--y:${location.y}%;--marker-index:${index}" data-universe-action="select-location" data-name="${esc(location.name)}" data-image="${location.image}"><i></i><span>${esc(location.name)}</span></button>`).join("")}<div class="atlas-disclaimer">Illustrative placement · Not a geographic reference</div></section>
    <section class="location-grid">${locations.map(location => `<button class="location-card" data-universe-action="select-location" data-name="${esc(location.name)}" data-image="${location.image}"><img src="/assets/lotm/backgrounds/${location.image}" alt="" loading="lazy"><span>${esc(location.name)}</span></button>`).join("")}</section>
    <div class="universe-detail" data-universe-detail ${context.state.selectedUniverseItem?.type === "location" ? "" : "hidden"}>${renderUniverseDetail(context.state)}</div>${navLinks("atlas")}</main>`;
}

function artifactsPage(context) {
  return `<main class="universe-page collection-page"><header class="universe-heading"><p class="eyebrow">ORIGINAL EXHIBIT CONCEPTS</p><h1>Sealed Artifact Studies</h1><p>These are original fictional display concepts created for the interface. They are not LOTM/COI canon items and have no canon classification or abilities.</p></header>
    <section class="artifact-grid">${artifactStudies.map((artifact,index) => `<button class="artifact-card" style="--artifact-index:${index}" data-universe-action="inspect-artifact" data-name="${esc(artifact.name)}" data-note="${esc(artifact.note)}"><span class="artifact-object">${artifact.mark}</span><small>${esc(artifact.type)}</small><b>${esc(artifact.name)}</b><em>INSPECT STUDY →</em></button>`).join("")}</section><div class="universe-detail" data-universe-detail ${context.state.selectedUniverseItem?.type === "artifact" ? "" : "hidden"}>${renderUniverseDetail(context.state)}</div>${navLinks("artifacts")}</main>`;
}

function clubPage() {
  return `<main class="universe-page club-page"><section class="club-room"><img src="/assets/lotm/backgrounds/divination_club.webp" alt="" loading="lazy"><div class="scene-vignette"></div><div class="club-copy"><p class="eyebrow">A SYMBOLIC GATHERING</p><h1>The Tarot Club</h1><p>Enter the gathering room. This visual seating arrangement is thematic and does not assign canon identities to seats.</p><button class="primary-button" data-action="library">Return to reading →</button></div><div class="club-table"><span>THE GATHERING</span><small>Symbolic seating · no character mapping</small></div></section>${navLinks("club")}</main>`;
}

function journalPage(context) {
  const entries = context.state.journal || [];
  const quotes = context.state.quotes || [];
  const history = context.state.history || [];
  const renderEntry = (entry,type,index) => `<article class="journal-entry"><small>${type} · ${esc(entry.book.toUpperCase())} ${String(entry.chapter).padStart(4,"0")} · ${esc(entry.date || "")}</small><p>${esc(entry.text)}</p>${entry.note ? `<p>${esc(entry.note)}</p>` : ""}<button data-universe-action="open-entry" data-book="${esc(entry.book)}" data-chapter="${entry.chapter}">RETURN TO CHAPTER →</button><button data-universe-action="delete-entry" data-type="${type}" data-index="${index}">REMOVE</button></article>`;
  return `<main class="universe-page collection-page"><header class="universe-heading"><p class="eyebrow">PRIVATE · SAVED IN THIS BROWSER</p><h1>Reading Journal</h1><p>Notes, saved excerpts, and your recent reading activity. Nothing is sent to a server.</p></header>
    <div class="journal-columns"><section><h2>Notes</h2>${entries.length ? entries.map((entry,index) => renderEntry(entry,"NOTE",index)).join("") : `<p class="empty-state">No notes yet. Add one from the reader toolbar.</p>`}</section>
    <section><h2>Highlights & quotations</h2>${quotes.length ? quotes.map((entry,index) => renderEntry(entry,entry.type || "HIGHLIGHT",index)).join("") : `<p class="empty-state">Select a passage and save it from the reader toolbar.</p>`}</section></div>
    <section class="history-section"><h2>Recent reading</h2>${history.length ? history.slice(0,30).map(entry => `<button class="history-row" data-universe-action="open-entry" data-book="${esc(entry.book)}" data-chapter="${entry.chapter}"><span>${esc(entry.book.toUpperCase())}</span><b>Chapter ${entry.chapter} · ${esc(entry.title)}</b><small>${esc(entry.date)}</small></button>`).join("") : `<p class="empty-state">Your recent chapters will appear here.</p>`}</section>${navLinks("journal")}</main>`;
}

function achievementsPage(context) {
  const read = Object.entries(context.state.progress).filter(([,value]) => value.percent >= 90).length;
  const activeDays = new Set(context.state.activityDays || []);
  let streak = 0;
  const date = new Date();
  for (;;) {
    const key = date.toISOString().slice(0, 10);
    if (!activeDays.has(key)) break;
    streak++;
    date.setDate(date.getDate() - 1);
  }
  const targets = [
    ["First Step Into the Mysteries",1,"Finish one chapter."],
    ["Seeker of Knowledge",10,"Finish ten chapters."],
    ["Beyond the Gray Fog",22,"Finish twenty-two chapters."],
    ["Witness of the Mysteries",100,"Finish one hundred chapters."],
    ["The Fool's Devotee",1394,"Finish the main LOTM story."]
  ];
  return `<main class="universe-page collection-page"><header class="universe-heading"><p class="eyebrow">EARNED THROUGH READING</p><h1>Milestones</h1><p>Chapters count as complete after reading progress reaches 90%. Opening buttons does not unlock rewards.</p></header>
    <div class="streak-card"><span>✦</span><div><small>CONSECUTIVE READING DAYS</small><b>${streak}</b></div><p>Streaks count days when you make real reading progress.</p></div>
    <section class="achievement-grid">${targets.map(([title,target,description],index) => {
      const progress = Math.min(100, Math.round(read / target * 100));
      const unlocked = read >= target;
      return `<article class="achievement-card ${unlocked ? "unlocked" : ""}" style="--achievement-index:${index}"><span>${unlocked ? "✦" : "◇"}</span><small>${unlocked ? "MILESTONE REACHED" : "IN PROGRESS"}</small><b>${esc(title)}</b><p>${esc(description)}</p><i><em style="width:${progress}%"></em></i><small>${Math.min(read,target)} / ${target} chapters</small></article>`;
    }).join("")}</section>${navLinks("achievements")}</main>`;
}

export function renderUniversePage(page, context) {
  switch (page) {
    case "characters": return charactersPage(context);
    case "atlas": return atlasPage(context);
    case "artifacts": return artifactsPage(context);
    case "club": return clubPage(context);
    case "journal": return journalPage(context);
    case "achievements": return achievementsPage(context);
    default: return `<main class="universe-page"><h1>${esc(routeTitles[page] || "Archive")}</h1>${navLinks(page)}</main>`;
  }
}

export function renderUniverseDetail(state) {
  const item = state.selectedUniverseItem;
  if (!item) return "";
  if (item.type === "location") return `<p class="eyebrow">LOCATION REFERENCE · ILLUSTRATIVE</p><h2>${esc(item.name)}</h2><img src="/assets/lotm/backgrounds/${esc(item.image)}" alt="${esc(item.name)}"><p>Image from the included local collection. Precise canon geography and chapter references are not supplied here.</p>`;
  if (item.type === "artifact") return `<p class="eyebrow">ORIGINAL CONCEPT · NOT CANON</p><h2>${esc(item.name)}</h2><p>${esc(item.note)}</p>`;
  return `<p class="eyebrow">REFERENCE NOTE</p><h2>${esc(item.name)}</h2><p>${esc(item.note || "Details withheld until a verified source is available.")}</p>`;
}

export function getUniverseContext(state) {
  return { state, locations, routeTitles };
}
