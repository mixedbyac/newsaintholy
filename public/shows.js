// Tour dates. One place to edit: the site and the Dropbox reader both use this list.
// `folder` is the Dropbox folder name under Road/ and POV/ (defaults to the city).
// `pin` places the star on the Road map (percent across / down the Texas outline in frames/texas.png).
export const SHOWS = [
  { id: "houston",     date: "2026-11-19", city: "Houston",     st: "TX", pin: { x: 89.9, y: 58.2 }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "fort-worth",  date: "2026-11-20", city: "Fort Worth",  st: "TX", pin: { x: 82.7, y: 34.4 }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "san-antonio", date: "2026-11-22", city: "San Antonio", st: "TX", pin: { x: 67.1, y: 69.1 }, bill: "WHATUPRG w/ aftrthght + De La Cruz" },
];

export const folderOf = (s) => s.folder || s.city;
