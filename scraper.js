// scraper.js — scrapes Wikipedia 3D film lists and saves raw movie data
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const WIKI_URLS = [
  { url: 'https://en.wikipedia.org/wiki/List_of_3D_films_(2005%E2%80%93present)', era: 'modern' },
  { url: 'https://en.wikipedia.org/wiki/List_of_3D_films_(1950s)', era: 'classic' },
  { url: 'https://en.wikipedia.org/wiki/List_of_3D_films_(1960s%E2%80%932004)', era: 'vintage' }
];

const FORMAT_HINTS = {
  'frame pack': 'frame-packing',
  'frame-pack': 'frame-packing',
  'mvc': 'frame-packing',
  'blu-ray 3d': 'frame-packing',
  'bluray 3d': 'frame-packing',
  'side-by-side': 'sbs',
  'side by side': 'sbs',
  ' sbs': 'sbs',
  'over-under': 'ou',
  'over/under': 'ou',
  'top-bottom': 'ou',
  'top/bottom': 'ou',
  ' tab ': 'ou',
  'anaglyph': 'anaglyph',
  'red/cyan': 'anaglyph',
  'red-cyan': 'anaglyph',
};

function detectFormats(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const [keyword, format] of Object.entries(FORMAT_HINTS)) {
    if (lower.includes(keyword)) found.add(format);
  }
  return [...found];
}

function cleanTitle(title) {
  return title.replace(/\[\w+\]/g, '').replace(/\s+/g, ' ').trim();
}

function extractYear(text) {
  const match = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return match ? parseInt(match[1]) : null;
}

async function scrapeWikipediaPage(url, era) {
  console.log(`\nScraping: ${url}`);
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 3D-Stremio-Addon/1.0)' }
  });
  const $ = cheerio.load(data);
  const movies = [];
  const seen = new Set();

  $('table.wikitable').each((_, table) => {
    $(table).find('tr').each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td, th');
      if (cells.length < 1) return;

      let titleCell = $(cells[0]);
      let title = cleanTitle(titleCell.text());

      if (/^\d+$/.test(title) || title.length < 2) {
        titleCell = $(cells[1]);
        title = cleanTitle(titleCell.text());
      }

      if (!title || title.length < 2) return;

      let year = null;
      cells.each((_, cell) => {
        const txt = $(cell).text();
        const y = extractYear(txt);
        if (y && !year) year = y;
      });

      if (!year) {
        const heading = $(table).prevAll('h2, h3, h4').first().text();
        year = extractYear(heading);
      }

      const rowText = $(row).text();
      let formats = detectFormats(rowText);

      if (formats.length === 0 && (era === 'modern' || (year && year >= 2008))) {
        formats = ['frame-packing'];
      } else if (formats.length === 0) {
        formats = ['anaglyph'];
      }

      const key = `${title.toLowerCase()}|${year}`;
      if (!seen.has(key) && title.length > 1) {
        seen.add(key);
        movies.push({ title, year, formats, era });
      }
    });
  });

  // Section-based list items
  $('h3').each((_, h) => {
    const heading = $(h).text().trim();
    const year = extractYear(heading);
    if (!year) return;
    $(h).nextUntil('h2, h3').filter('ul').find('li').each((_, li) => {
      const text = $(li).text();
      const title = cleanTitle(text.split('–')[0].split('—')[0].split('(')[0].trim());
      if (!title || title.length < 2) return;
      const formats = detectFormats(text);
      const key = `${title.toLowerCase()}|${year}`;
      if (!seen.has(key)) {
        seen.add(key);
        movies.push({
          title, year,
          formats: formats.length ? formats : era === 'modern' ? ['frame-packing'] : ['anaglyph'],
          era
        });
      }
    });
  });

  console.log(`  Found ${movies.length} movies`);
  return movies;
}

async function main() {
  let allMovies = [];
  for (const { url, era } of WIKI_URLS) {
    try {
      const movies = await scrapeWikipediaPage(url, era);
      allMovies = allMovies.concat(movies);
    } catch (err) {
      console.warn(`  Warning: Failed to scrape ${url} — ${err.message}`);
    }
  }

  const seen = new Set();
  const deduped = allMovies.filter(m => {
    const key = `${m.title.toLowerCase()}|${m.year}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal unique movies scraped: ${deduped.length}`);
  fs.writeFileSync('./raw_movies.json', JSON.stringify(deduped, null, 2));
  console.log('Saved to raw_movies.json');
}

main().catch(console.error);
