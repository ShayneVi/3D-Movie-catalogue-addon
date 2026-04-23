// addon.js — Stremio addon serving the 3D movie catalogue
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fs = require('fs');
const path = require('path');

// ── Load catalogue ──────────────────────────────────────────────────────────
const CATALOGUE_PATH = path.join(__dirname, 'catalogue.json');

function loadCatalogue() {
  if (!fs.existsSync(CATALOGUE_PATH)) {
    console.error('catalogue.json not found — run `node scraper.js && node enrich.js` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
}

let catalogue = loadCatalogue();
console.log(`Loaded ${catalogue.length} movies from catalogue.json`);

// ── Addon manifest ──────────────────────────────────────────────────────────
const manifest = {
  id: 'community.3d-movies',
  version: '1.0.0',
  name: '3D Movies Catalogue',
  description: 'Browse movies available in 3D formats: Frame Packing (Blu-ray 3D), SBS, Over/Under and Anaglyph.',
  logo: 'https://i.imgur.com/p9GpNaM.png',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  idPrefixes: ['tt'],
  catalogs: [
    {
      type: 'movie',
      id: '3d-all',
      name: '3D Movies — All Formats',
      extra: [
        { name: 'genre', isRequired: false },
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
      genres: [
        '3D: Frame Packing',
        '3D: SBS',
        '3D: Over/Under',
        '3D: Anaglyph',
        'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
        'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
        'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
        'Thriller', 'War', 'Western'
      ]
    },
    {
      type: 'movie',
      id: '3d-frame-packing',
      name: '3D Frame Packing (Blu-ray 3D)',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      type: 'movie',
      id: '3d-sbs',
      name: '3D Side-by-Side (SBS)',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      type: 'movie',
      id: '3d-ou',
      name: '3D Over/Under (OU)',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      type: 'movie',
      id: '3d-anaglyph',
      name: '3D Anaglyph (Red/Cyan)',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
  ],
};

// ── Format filter map ───────────────────────────────────────────────────────
const CATALOG_FORMAT_MAP = {
  '3d-frame-packing': 'frame-packing',
  '3d-sbs': 'sbs',
  '3d-ou': 'ou',
  '3d-anaglyph': 'anaglyph',
};

const PAGE_SIZE = 100;

// ── Builder ─────────────────────────────────────────────────────────────────
const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(({ type, id, extra }) => {
  if (type !== 'movie') return Promise.resolve({ metas: [] });

  const skip = parseInt(extra.skip) || 0;
  const search = extra.search ? extra.search.toLowerCase() : null;
  const genre = extra.genre || null;

  let results = catalogue;

  // Filter by format based on catalog id
  const formatFilter = CATALOG_FORMAT_MAP[id];
  if (formatFilter) {
    results = results.filter(m => m.formats && m.formats.includes(formatFilter));
  }

  // Filter by genre (works for both 3D format genres and regular movie genres)
  if (genre) {
    results = results.filter(m => m.genres && m.genres.includes(genre));
  }

  // Filter by search term
  if (search) {
    results = results.filter(m => m.name && m.name.toLowerCase().includes(search));
  }

  // Remove entries without a poster (cleaner experience)
  results = results.filter(m => m.poster);

  const page = results.slice(skip, skip + PAGE_SIZE);

  const metas = page.map(m => ({
    id: m.id,
    type: 'movie',
    name: m.name,
    poster: m.poster,
    year: m.year,
    genres: m.genres,
    description: m.description,
    background: m.background,
    imdbRating: m.rating,
  }));

  return Promise.resolve({ metas });
});

builder.defineMetaHandler(({ type, id }) => {
  if (type !== 'movie') return Promise.resolve({ meta: null });

  const movie = catalogue.find(m => m.id === id);
  if (!movie) return Promise.resolve({ meta: null });

  const formatBadges = (movie.formats || []).map(f => {
    switch (f) {
      case 'frame-packing': return 'Blu-ray 3D (Frame Packing)';
      case 'sbs': return 'Side-by-Side 3D';
      case 'ou': return 'Over/Under 3D';
      case 'anaglyph': return 'Anaglyph 3D (Red/Cyan)';
      default: return '3D';
    }
  }).join(' · ');

  const meta = {
    id: movie.id,
    type: 'movie',
    name: movie.name,
    poster: movie.poster,
    background: movie.background,
    year: movie.year,
    genres: movie.genres,
    description: movie.description
      ? `${movie.description}\n\n3D Formats: ${formatBadges}`
      : `3D Formats: ${formatBadges}`,
    imdbRating: movie.rating,
  };

  return Promise.resolve({ meta });
});

// ── Serve ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`\n3D Movies addon running at http://127.0.0.1:${PORT}`);
console.log(`Add to Stremio: http://127.0.0.1:${PORT}/manifest.json\n`);
