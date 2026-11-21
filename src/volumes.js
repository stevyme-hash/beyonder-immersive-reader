export const volumeCatalog = {
  lotm: [
    { number: 1, title: "Clown", start: 1, end: 213 },
    { number: 2, title: "Faceless", start: 214, end: 482 },
    { number: 3, title: "Traveler", start: 483, end: 732 },
    { number: 4, title: "Undying", start: 733, end: 946 },
    { number: 5, title: "Red Priest", start: 947, end: 1150 },
    { number: 6, title: "Lightseeker", start: 1151, end: 1266 },
    { number: 7, title: "The Hanged Man", start: 1267, end: 1353 },
    { number: 8, title: "The Fool", start: 1354, end: 1394 }
  ],
  coi: [
    { number: 1, title: "Nightmare", start: 1, end: 109 },
    { number: 2, title: "Lightseeker", start: 110, end: 263 },
    { number: 3, title: "Conspirer", start: 264, end: 494 },
    { number: 4, title: "Sinner", start: 495, end: 735 },
    { number: 5, title: "Demoness", start: 736, end: 884 },
    { number: 6, title: "Dream Weaver", start: 885, end: 1034 },
    { number: 7, title: "Second Law", start: 1035, end: 1115 },
    { number: 8, title: "Eternal Aeon", start: 1116, end: 1179 }
  ]
};

export function volumeProgress(book, chapters, volume, progress) {
  const contents = chapters.filter(chapter => chapter.number >= volume.start && chapter.number <= volume.end);
  if (!contents.length) return 0;
  const total = contents.reduce((sum, chapter) => {
    return sum + (progress[`${book}:${chapter.number}`]?.percent || 0);
  }, 0);
  return Math.round(total / contents.length);
}
