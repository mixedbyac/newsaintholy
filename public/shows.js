// Tour dates. One place to edit: the site and the Dropbox reader both use this list.
// `folder` is the Dropbox folder name under Road/ and POV/ (defaults to the city).
export const SHOWS = [
  { id: "houston",     date: "2026-11-19", city: "Houston",     st: "TX", bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "fort-worth",  date: "2026-11-20", city: "Fort Worth",  st: "TX", bill: "WHATUPRG w/ aftrthght + De La Cruz" },
  { id: "san-antonio", date: "2026-11-22", city: "San Antonio", st: "TX", bill: "WHATUPRG w/ aftrthght + De La Cruz" },
];

export const folderOf = (s) => s.folder || s.city;
