// addon.js — Stremio addon serving the 3D movie catalogue
// Catalogue is built directly from the curated list — no TMDB seeding needed.
// Stremio's own TMDB addon will supply posters, ratings and descriptions
// automatically for any entry with a valid IMDb ID (tt...).
//
// HOW THE CATALOGUE WORKS:
//   Each movie entry only needs: id (IMDb tt-id), type, name, year, genres, formats.
//   Poster/backdrop/description are intentionally left blank — Stremio + TMDB addon
//   will fill those in automatically when a user browses the catalogue.
//   If you DO want local posters (e.g. for movies not on TMDB), add them to the
//   catalogue.json manually after running `node seed_catalogue.js`.

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fs = require('fs');
const path = require('path');

// ── Load catalogue ──────────────────────────────────────────────────────────
const CATALOGUE_PATH = path.join(__dirname, 'catalogue.json');

function loadCatalogue() {
  if (!fs.existsSync(CATALOGUE_PATH)) {
    console.error('catalogue.json not found — run `node seed_catalogue.js` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
}

let catalogue = loadCatalogue();
console.log(`Loaded ${catalogue.length} movies from catalogue.json`);

// ── Era definitions ─────────────────────────────────────────────────────────
// Each era maps to a catalog id, a display name, and a year range filter.
// Movies are assigned to an era based on their `year` field.
const ERAS = [
  { id: '3d-classic',      name: '🎞️ Classic Era 3D (1922–1984)',              minYear: 1922, maxYear: 1984 },
  { id: '3d-transition',   name: '📼 Transition Era 3D (1985–2004)',            minYear: 1985, maxYear: 2004 },
  { id: '3d-digital',      name: '💿 Digital 3D Era (2005–2009)',               minYear: 2005, maxYear: 2009 },
  { id: '3d-boom',         name: '💥 The 3D Boom (2010–2012)',                  minYear: 2010, maxYear: 2012 },
  { id: '3d-peak',         name: '🏆 Peak 3D Era (2013–2016)',                  minYear: 2013, maxYear: 2016 },
  { id: '3d-late',         name: '🌅 Late 3D Era (2017–2020)',                  minYear: 2017, maxYear: 2020 },
  { id: '3d-postpandemic', name: '🚀 Post-Pandemic Era (2021–2025)',            minYear: 2021, maxYear: 2025 },
];

// Special catalogs not based on year
const SPECIAL_CATALOG_IDS = [
  '3d-all',
  '3d-anaglyph',
  '3d-documentary',
  '3d-fan-conversions',
];

// ── Addon manifest ──────────────────────────────────────────────────────────
const COMMON_EXTRA = [
  { name: 'search', isRequired: false },
  { name: 'skip',   isRequired: false },
];

const manifest = {
  id: 'community.3d-movies',
  version: '2.0.0',
  name: '3D Movies Catalogue',
  description:
    'Browse 700+ movies available in 3D — organised by era, format, and type. ' +
    'Includes Blu-ray 3D (Frame Packing), SBS, Over/Under, Anaglyph, ' +
    'documentaries, and fan conversions from 3D-HD.CLUB.',
  logo: 'https://i.imgur.com/p9GpNaM.png',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  idPrefixes: ['tt'],
  catalogs: [
    // ── All formats ──────────────────────────────────────────────────────
    {
      type: 'movie',
      id: '3d-all',
      name: '🎬 All 3D Movies',
      extra: [
        { name: 'genre',  isRequired: false },
        { name: 'search', isRequired: false },
        { name: 'skip',   isRequired: false },
      ],
      genres: [
        '3D: Frame Packing (BD3D)',
        '3D: Side-by-Side (SBS)',
        '3D: Over/Under (OU)',
        '3D: Anaglyph',
        'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
        'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror',
        'Music', 'Science Fiction', 'Thriller', 'War',
      ],
    },

    // ── Anaglyph ─────────────────────────────────────────────────────────
    {
      type: 'movie',
      id: '3d-anaglyph',
      name: '🔴🔵 Anaglyph 3D (Red/Cyan)',
      extra: COMMON_EXTRA,
    },

    // ── Era catalogs ─────────────────────────────────────────────────────
    ...ERAS.map(era => ({
      type: 'movie',
      id: era.id,
      name: era.name,
      extra: COMMON_EXTRA,
    })),

    // ── Documentary / Special Interest ───────────────────────────────────
    {
      type: 'movie',
      id: '3d-documentary',
      name: '🔭 Special Interest & Documentary 3D',
      extra: COMMON_EXTRA,
    },

    // ── Fan Conversions ──────────────────────────────────────────────────
    {
      type: 'movie',
      id: '3d-fan-conversions',
      name: '🎨 Fan Conversions (3D-HD.CLUB)',
      extra: COMMON_EXTRA,
    },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 100;

function filterBySearch(results, search) {
  if (!search) return results;
  const q = search.toLowerCase();
  return results.filter(m => m.name && m.name.toLowerCase().includes(q));
}

function paginate(results, skip) {
  return results.slice(skip, skip + PAGE_SIZE);
}

function toMeta(m) {
  return {
    id:          m.id,
    type:        'movie',
    name:        m.name,
    poster:      m.poster   || null,
    background:  m.background || null,
    year:        m.year,
    genres:      m.genres,
    description: m.description || '',
    imdbRating:  m.rating    || null,
  };
}

// ── Catalog handler ──────────────────────────────────────────────────────────
const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(({ type, id, extra }) => {
  if (type !== 'movie') return Promise.resolve({ metas: [] });

  const skip   = parseInt(extra.skip)   || 0;
  const search = extra.search || null;
  const genre  = extra.genre  || null;

  let results = catalogue;

  // ── Route to the correct subset ─────────────────────────────────────────

  if (id === '3d-anaglyph') {
    results = results.filter(m => m.formats && m.formats.includes('anaglyph'));

  } else if (id === '3d-documentary') {
    results = results.filter(m => m.isDocumentary === true);

  } else if (id === '3d-fan-conversions') {
    results = results.filter(m => m.isFanConversion === true);

  } else if (id !== '3d-all') {
    // Era catalog
    const era = ERAS.find(e => e.id === id);
    if (era) {
      results = results.filter(
        m => m.year && m.year >= era.minYear && m.year <= era.maxYear
          && m.isDocumentary !== true
          && m.isFanConversion !== true
      );
    } else {
      return Promise.resolve({ metas: [] });
    }
  }

  // Genre filter (works on both 3D-format genres and movie genres)
  if (genre) {
    results = results.filter(m => m.genres && m.genres.includes(genre));
  }

  // Search filter
  results = filterBySearch(results, search);

  const metas = paginate(results, skip).map(toMeta);
  return Promise.resolve({ metas });
});

// ── Meta handler ─────────────────────────────────────────────────────────────
builder.defineMetaHandler(({ type, id }) => {
  if (type !== 'movie') return Promise.resolve({ meta: null });

  const movie = catalogue.find(m => m.id === id);
  if (!movie) return Promise.resolve({ meta: null });

  const FORMAT_LABELS = {
    'frame-packing': 'Blu-ray 3D (Frame Packing)',
    'sbs':           'Side-by-Side 3D (SBS)',
    'ou':            'Over/Under 3D (OU)',
    'anaglyph':      'Anaglyph 3D (Red/Cyan)',
    'bd3d':          'Blu-ray 3D',
    'fp':            'Frame Packing',
  };

  const formatBadges = (movie.formats || [])
    .map(f => FORMAT_LABELS[f] || f.toUpperCase())
    .join(' · ');

  const fanNote = movie.isFanConversion
    ? '\n\n⚠️ Fan Conversion — not an official studio release (source: 3D-HD.CLUB community).'
    : '';

  const docNote = movie.isDocumentary
    ? '\n\n🔭 Special Interest / Documentary 3D release.'
    : '';

  const description =
    (movie.description ? movie.description + '\n\n' : '') +
    (formatBadges ? `3D Formats: ${formatBadges}` : '') +
    fanNote +
    docNote;

  return Promise.resolve({
    meta: {
      id:          movie.id,
      type:        'movie',
      name:        movie.name,
      poster:      movie.poster      || null,
      background:  movie.background  || null,
      year:        movie.year,
      genres:      movie.genres,
      description: description.trim(),
      imdbRating:  movie.rating || null,
    },
  });
});

// ── Serve ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`\n3D Movies addon running at http://127.0.0.1:${PORT}`);
console.log(`Add to Stremio: http://127.0.0.1:${PORT}/manifest.json\n`);
