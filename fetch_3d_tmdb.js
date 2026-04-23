// fetch_3d_tmdb.js — expands catalogue using multiple TMDB discovery strategies
// Merges results into existing catalogue.json rather than overwriting it.
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = 'b01c752519d68885f15ea1e659765824';
const BASE = 'https://api.themoviedb.org/3';
const CATALOGUE_PATH = path.join(__dirname, 'catalogue.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${BASE}${endpoint}`, {
      params: { api_key: API_KEY, ...params }
    });
    return data;
  } catch (e) {
    if (e.response?.status === 429) { await sleep(2000); return get(endpoint, params); }
    return null;
  }
}

async function fetchAllPages(endpoint, params = {}, label = '') {
  const first = await get(endpoint, { ...params, page: 1 });
  if (!first || !first.results) return [];
  const total = Math.min(first.total_pages || 1, 500);
  let results = [...first.results];
  process.stdout.write(`  ${label} Page 1/${total}\r`);
  for (let p = 2; p <= total; p++) {
    if (p % 10 === 0) process.stdout.write(`  ${label} Page ${p}/${total}\r`);
    const d = await get(endpoint, { ...params, page: p });
    if (d?.results) results = results.concat(d.results);
    await sleep(80);
  }
  console.log(`  ${label} Done — ${results.length} results           `);
  return results;
}

async function getDetails(id) {
  return get(`/movie/${id}`, { append_to_response: 'external_ids,keywords' });
}

const FORMAT_KEYWORD_MAP = {
  'side-by-side': 'sbs',
  'side by side': 'sbs',
  '3d sbs': 'sbs',
  'over-under': 'ou',
  'over/under': 'ou',
  'top-bottom': 'ou',
  'anaglyph': 'anaglyph',
  'frame pack': 'frame-packing',
  'blu-ray 3d': 'frame-packing',
  'imax 3d': 'frame-packing',
};

function detectFormatsFromKeywords(keywords = []) {
  const found = new Set();
  for (const kw of keywords) {
    const name = kw.name.toLowerCase();
    for (const [hint, fmt] of Object.entries(FORMAT_KEYWORD_MAP)) {
      if (name.includes(hint)) found.add(fmt);
    }
  }
  return [...found];
}

function buildMeta(movie, details, extraFormats = []) {
  const imdbId = details?.external_ids?.imdb_id;
  if (!imdbId || !imdbId.startsWith('tt')) return null;

  const kwFormats = detectFormatsFromKeywords(details?.keywords?.keywords || []);
  const formats = [...new Set([...extraFormats, ...kwFormats])];
  if (formats.length === 0) formats.push('frame-packing');

  const year = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null;
  const genres = (details?.genres || []).map(g => g.name);
  const formatLabels = formats.map(f => {
    if (f === 'frame-packing') return '3D: Frame Packing';
    if (f === 'sbs') return '3D: SBS';
    if (f === 'ou') return '3D: Over/Under';
    if (f === 'anaglyph') return '3D: Anaglyph';
    return '3D';
  });

  return {
    id: imdbId,
    type: 'movie',
    name: movie.title,
    year,
    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
    description: movie.overview || '',
    rating: movie.vote_average ? movie.vote_average.toFixed(1) : null,
    genres: [...genres, ...formatLabels],
    formats,
    tmdbId: movie.id,
  };
}

async function discoverByKeywords() {
  // Try several keyword IDs that TMDB uses for 3D content
  const keywordIds = [186269, 10084, 207317, 5552];
  const allResults = [];
  const seenTmdb = new Set();

  for (const kwId of keywordIds) {
    console.log(`  Trying keyword ID ${kwId}...`);
    const results = await fetchAllPages('/discover/movie', {
      with_keywords: kwId,
      sort_by: 'popularity.desc',
      'vote_count.gte': 5,
    }, `kw#${kwId}`);

    for (const r of results) {
      if (!seenTmdb.has(r.id)) { seenTmdb.add(r.id); allResults.push(r); }
    }
    await sleep(200);
  }
  return allResults;
}

async function discoverByCollections() {
  const collectionIds = [
    86311, 131295, 87359, 304, 121938, 2150, 10, 645,
    263, 86066, 9485, 531241, 468552, 264, 1241, 8945,
    2806, 87236, 131292, 422834, 284433, 131296, 131299,
    529892, 623911, 91361,
  ];

  const allResults = [];
  const seenTmdb = new Set();

  console.log(`  Fetching ${collectionIds.length} known 3D collections...`);
  for (const colId of collectionIds) {
    const col = await get(`/collection/${colId}`);
    if (col?.parts) {
      for (const r of col.parts) {
        if (!seenTmdb.has(r.id)) { seenTmdb.add(r.id); allResults.push(r); }
      }
    }
    await sleep(100);
  }
  console.log(`  Collections yielded ${allResults.length} movies`);
  return allResults;
}

async function main() {
  console.log('=== Expanding 3D catalogue from TMDB ===\n');

  // Load existing catalogue to merge into
  let existing = [];
  if (fs.existsSync(CATALOGUE_PATH)) {
    existing = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
    console.log(`Loaded ${existing.length} existing movies from catalogue.json\n`);
  }

  const existingIds = new Set(existing.map(m => m.id));
  const seenTmdb = new Set(existing.map(m => m.tmdbId).filter(Boolean));

  // Discovery
  console.log('Step 1: Keyword-based discovery...');
  const kwResults = await discoverByKeywords();
  console.log(`  Keyword discovery: ${kwResults.length} movies\n`);

  console.log('Step 2: Collection-based discovery...');
  const colResults = await discoverByCollections();
  console.log();

  // Merge discovered, skip already-known TMDB IDs
  const allDiscovered = [...kwResults, ...colResults];
  const toEnrich = [];
  const seenNew = new Set();
  for (const m of allDiscovered) {
    if (!seenTmdb.has(m.id) && !seenNew.has(m.id)) {
      seenNew.add(m.id);
      toEnrich.push(m);
    }
  }
  console.log(`New movies to enrich: ${toEnrich.length}`);

  if (toEnrich.length === 0) {
    console.log('Nothing new to add — catalogue is already up to date.');
    return;
  }

  // Enrich
  console.log('\nStep 3: Fetching details + IMDB IDs...');
  const newEntries = [];
  const failed = [];
  let i = 0;

  for (const movie of toEnrich) {
    i++;
    if (i % 25 === 0) process.stdout.write(`\r  [${i}/${toEnrich.length}] ${newEntries.length} new entries   `);

    const details = await getDetails(movie.id);
    const meta = buildMeta(movie, details);
    if (meta && !existingIds.has(meta.id)) {
      newEntries.push(meta);
      existingIds.add(meta.id);
    } else if (!meta) {
      failed.push({ id: movie.id, title: movie.title });
    }
    await sleep(80);
  }

  console.log(`\n\nNew entries added: ${newEntries.length}`);
  console.log(`Failed / no IMDB:  ${failed.length}`);

  // Merge, sort, save
  const merged = [...existing, ...newEntries];
  merged.sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
  });

  fs.writeFileSync(CATALOGUE_PATH, JSON.stringify(merged, null, 2));
  if (failed.length) fs.writeFileSync('./failed_movies.json', JSON.stringify(failed, null, 2));

  console.log(`\nCatalogue now has ${merged.length} movies total`);
  console.log('Saved catalogue.json');
}

main().catch(console.error);
