// enrich.js — matches raw scraped movies to TMDB and saves enriched catalogue
const axios = require('axios');
const fs = require('fs');

const TMDB_API_KEY = 'b01c752519d68885f15ea1e659765824';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const DELAY_MS = 100; // be polite to TMDB API

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchTMDB(title, year) {
  try {
    const params = {
      api_key: TMDB_API_KEY,
      query: title,
      include_adult: false,
    };
    if (year) params.year = year;

    const { data } = await axios.get(`${TMDB_BASE}/search/movie`, { params });

    if (data.results && data.results.length > 0) {
      // Prefer exact year match, then closest title match
      let best = data.results[0];
      if (year) {
        const exactYear = data.results.find(r => {
          const y = r.release_date ? parseInt(r.release_date.substring(0, 4)) : null;
          return y === year;
        });
        if (exactYear) best = exactYear;
      }
      return best;
    }
    return null;
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn('  Rate limited — waiting 2s...');
      await sleep(2000);
      return searchTMDB(title, year); // retry
    }
    return null;
  }
}

async function getMovieDetails(tmdbId) {
  try {
    const { data } = await axios.get(`${TMDB_BASE}/movie/${tmdbId}`, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: 'external_ids'
      }
    });
    return data;
  } catch {
    return null;
  }
}

function buildStremioMeta(tmdbMovie, details, formats) {
  const imdbId = details?.external_ids?.imdb_id || null;
  if (!imdbId) return null; // Stremio needs imdb_id

  const year = tmdbMovie.release_date
    ? parseInt(tmdbMovie.release_date.substring(0, 4))
    : null;

  const genres = (details?.genres || []).map(g => g.name);
  // Add 3D format tags as genres so Stremio can filter
  const formatLabels = formats.map(f => {
    switch (f) {
      case 'frame-packing': return '3D: Frame Packing';
      case 'sbs': return '3D: SBS';
      case 'ou': return '3D: Over/Under';
      case 'anaglyph': return '3D: Anaglyph';
      default: return '3D';
    }
  });

  return {
    id: imdbId,
    type: 'movie',
    name: tmdbMovie.title,
    year,
    poster: tmdbMovie.poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
      : null,
    background: tmdbMovie.backdrop_path
      ? `https://image.tmdb.org/t/p/original${tmdbMovie.backdrop_path}`
      : null,
    description: tmdbMovie.overview || '',
    rating: tmdbMovie.vote_average ? tmdbMovie.vote_average.toFixed(1) : null,
    genres: [...genres, ...formatLabels],
    formats, // our own field for filtering
    tmdbId: tmdbMovie.id,
  };
}

async function main() {
  if (!fs.existsSync('./raw_movies.json')) {
    console.error('raw_movies.json not found — run `node scraper.js` first.');
    process.exit(1);
  }

  const rawMovies = JSON.parse(fs.readFileSync('./raw_movies.json', 'utf8'));
  console.log(`Enriching ${rawMovies.length} movies via TMDB...`);

  const catalogue = [];
  const failed = [];
  let i = 0;

  for (const movie of rawMovies) {
    i++;
    process.stdout.write(`\r[${i}/${rawMovies.length}] ${movie.title.substring(0, 40).padEnd(40)}`);

    const tmdbResult = await searchTMDB(movie.title, movie.year);
    if (!tmdbResult) {
      failed.push(movie);
      await sleep(DELAY_MS);
      continue;
    }

    const details = await getMovieDetails(tmdbResult.id);
    const meta = buildStremioMeta(tmdbResult, details, movie.formats);

    if (meta) {
      catalogue.push(meta);
    } else {
      failed.push(movie);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n\nSuccessfully enriched: ${catalogue.length}`);
  console.log(`Failed / no IMDB ID:  ${failed.length}`);

  // Sort by year descending, then by rating
  catalogue.sort((a, b) => {
    if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
    return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
  });

  fs.writeFileSync('./catalogue.json', JSON.stringify(catalogue, null, 2));
  fs.writeFileSync('./failed_movies.json', JSON.stringify(failed, null, 2));
  console.log(`Saved catalogue.json (${catalogue.length} movies)`);
  console.log(`Saved failed_movies.json (${failed.length} movies)`);
}

main().catch(console.error);
