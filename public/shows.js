// Tour dates. One place to edit: the site and the Dropbox reader both use this list.
// `folder` is the Dropbox folder name under Road/ and POV/ (defaults to the city).
// `pin` places the star on the Road map (percent across / down frames/us.png); `side` puts the label left or right.
export const SHOWS = [
  { id: "houston",     date: "2026-11-19", city: "Houston",     st: "TX", pin: { x: 52.3, y: 83.7, side: "r" }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "fort-worth",  date: "2026-11-20", city: "Fort Worth",  st: "TX", pin: { x: 48.4, y: 72.4, side: "l" }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "san-antonio", date: "2026-11-22", city: "San Antonio", st: "TX", pin: { x: 45.9, y: 84.8, side: "l" }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
];

export const folderOf = (s) => s.folder || s.city;
