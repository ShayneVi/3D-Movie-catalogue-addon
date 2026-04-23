// seed_catalogue.js — seeds catalogue.json with well-known 3D movies via TMDB
// Run this FIRST on your local machine before starting the addon.
// After seeding, run fetch_3d_tmdb.js to add hundreds more.
const axios = require('axios');
const fs = require('fs');

const API_KEY = 'b01c752519d68885f15ea1e659765824';
const BASE = 'https://api.themoviedb.org/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Curated IMDB IDs of iconic 3D movies with their known formats
// Frame-packing = native Blu-ray 3D MVC encode
const SEED = [
  // Format: [imdb_id, formats[]]
  ['tt0499549', ['frame-packing']],           // Avatar
  ['tt1454468', ['frame-packing']],           // Gravity
  ['tt0816692', ['frame-packing']],           // Interstellar
  ['tt2294629', ['frame-packing']],           // Frozen
  ['tt1615147', ['frame-packing']],           // The Martian
  ['tt1462764', ['frame-packing']],           // Brave
  ['tt1979376', ['frame-packing']],           // Toy Story 4
  ['tt0435761', ['frame-packing']],           // Toy Story 3
  ['tt0892769', ['frame-packing']],           // How to Train Your Dragon
  ['tt1648115', ['frame-packing']],           // How to Train Your Dragon 2
  ['tt0449088', ['frame-packing']],           // Pirates of the Caribbean: At World's End
  ['tt1074638', ['frame-packing']],           // Skyfall
  ['tt1276104', ['frame-packing']],           // The Hobbit: An Unexpected Journey
  ['tt1170358', ['frame-packing']],           // The Hobbit: The Desolation of Smaug
  ['tt2310332', ['frame-packing']],           // The Hobbit: The Battle of the Five Armies
  ['tt0458339', ['frame-packing']],           // Captain America: The First Avenger
  ['tt0848228', ['frame-packing']],           // The Avengers
  ['tt2395427', ['frame-packing']],           // Avengers: Age of Ultron
  ['tt4154756', ['frame-packing']],           // Avengers: Infinity War
  ['tt4154796', ['frame-packing']],           // Avengers: Endgame
  ['tt3498820', ['frame-packing']],           // Captain America: Civil War
  ['tt1843866', ['frame-packing']],           // Captain America: The Winter Soldier
  ['tt1300854', ['frame-packing']],           // Iron Man 3
  ['tt0800369', ['frame-packing']],           // Thor
  ['tt1981115', ['frame-packing']],           // Thor: The Dark World
  ['tt3501632', ['frame-packing']],           // Thor: Ragnarok
  ['tt1211837', ['frame-packing']],           // Doctor Strange
  ['tt3480822', ['frame-packing']],           // Black Panther
  ['tt1825683', ['frame-packing']],           // Black Panther: Wakanda Forever
  ['tt2015381', ['frame-packing']],           // Guardians of the Galaxy
  ['tt3896198', ['frame-packing']],           // Guardians of the Galaxy Vol. 2
  ['tt0478970', ['frame-packing']],           // Ant-Man
  ['tt3779874', ['frame-packing']],           // Ant-Man and the Wasp
  ['tt2283362', ['frame-packing']],           // Jack the Giant Slayer
  ['tt1617661', ['frame-packing']],           // Transformers: Dark of the Moon
  ['tt2109248', ['frame-packing']],           // Transformers: Age of Extinction
  ['tt3371366', ['frame-packing']],           // Transformers: The Last Knight
  ['tt0796366', ['frame-packing']],           // Star Trek (2009)
  ['tt1408101', ['frame-packing']],           // Star Trek Into Darkness
  ['tt2660888', ['frame-packing']],           // Star Trek Beyond
  ['tt2488496', ['frame-packing']],           // Star Wars: The Force Awakens
  ['tt2527336', ['frame-packing']],           // Star Wars: The Last Jedi
  ['tt2527338', ['frame-packing']],           // Star Wars: The Rise of Skywalker
  ['tt1300401', ['frame-packing']],           // Despicable Me
  ['tt1690953', ['frame-packing']],           // Despicable Me 2
  ['tt3469048', ['frame-packing']],           // Despicable Me 3
  ['tt2293640', ['frame-packing']],           // Minions
  ['tt1323594', ['frame-packing']],           // The Lorax
  ['tt0993846', ['frame-packing']],           // The Wolf of Wall Street (3D release)
  ['tt1709530', ['frame-packing']],           // Puss in Boots
  ['tt1637725', ['frame-packing']],           // Madagascar 3
  ['tt0796015', ['frame-packing']],           // Kung Fu Panda 2
  ['tt1302011', ['frame-packing']],           // Kung Fu Panda 3
  ['tt1170080', ['frame-packing']],           // Prometheus
  ['tt0816711', ['frame-packing']],           // Life of Pi
  ['tt1320253', ['frame-packing']],           // The Amazing Spider-Man
  ['tt2250912', ['frame-packing']],           // Spider-Man: Homecoming
  ['tt6320628', ['frame-packing']],           // Spider-Man: Far From Home
  ['tt10872600', ['frame-packing']],          // Spider-Man: No Way Home
  ['tt1477834', ['frame-packing']],           // The Amazing Spider-Man 2
  ['tt0401792', ['frame-packing', 'sbs']],    // Sin City
  ['tt2975590', ['frame-packing']],           // Batman v Superman
  ['tt0974015', ['frame-packing']],           // Justice League
  ['tt0418279', ['frame-packing']],           // Aquaman
  ['tt1477834', ['frame-packing']],           // The Amazing Spider-Man 2
  ['tt0381681', ['frame-packing']],           // Before Sunset
  ['tt0369610', ['frame-packing']],           // Jurassic World
  ['tt4881806', ['frame-packing']],           // Jurassic World: Fallen Kingdom
  ['tt8041270', ['frame-packing']],           // Jurassic World Dominion
  ['tt0382932', ['frame-packing']],           // Ratatouille (3D re-release)
  ['tt2562232', ['frame-packing']],           // Birdman
  ['tt1951264', ['frame-packing']],           // The Hunger Games: Catching Fire
  ['tt1951265', ['frame-packing']],           // The Hunger Games: Mockingjay Part 1
  ['tt1951266', ['frame-packing']],           // The Hunger Games: Mockingjay Part 2
  ['tt2245084', ['frame-packing']],           // Big Hero 6
  ['tt2096673', ['frame-packing']],           // Inside Out
  ['tt2277860', ['frame-packing']],           // The Good Dinosaur
  ['tt1517268', ['frame-packing']],           // Barbie (3D)
  ['tt1074638', ['frame-packing']],           // Skyfall
  ['tt0109830', ['anaglyph']],               // Forrest Gump (classic re-release)
  ['tt0090605', ['anaglyph']],               // Aliens
  ['tt0103064', ['anaglyph']],               // Terminator 2
  ['tt0133093', ['anaglyph', 'sbs']],        // The Matrix
  ['tt0076759', ['anaglyph']],               // Star Wars: A New Hope (special)
  ['tt0080684', ['anaglyph']],               // The Empire Strikes Back
  ['tt2488496', ['frame-packing', 'sbs']],   // Star Wars: TFA
  ['tt0145487', ['frame-packing']],           // Spider-Man (3D re-release)
  ['tt0316654', ['frame-packing']],           // Spider-Man 2
  ['tt0413300', ['frame-packing']],           // Spider-Man 3
  ['tt0361748', ['frame-packing']],           // Inglourious Basterds (3D)
  ['tt1650554', ['sbs', 'ou']],              // Saw 3D
  ['tt0479884', ['sbs', 'ou']],              // Final Destination 3
  ['tt1282140', ['sbs', 'ou']],              // The Final Destination
  ['tt1292566', ['sbs']],                    // Piranha 3D
  ['tt1796935', ['sbs']],                    // Piranha 3DD
  ['tt2302755', ['frame-packing', 'sbs']],   // Oz the Great and Powerful
  ['tt1375666', ['frame-packing', 'sbs']],   // Inception (3D)
  ['tt1745960', ['frame-packing']],           // Top Gun: Maverick
  ['tt1160419', ['frame-packing']],           // Dune: Part One
  ['tt15239678', ['frame-packing']],          // Dune: Part Two
  ['tt1677720', ['frame-packing']],           // Ready Player One
  ['tt0816692', ['frame-packing']],           // Interstellar
  ['tt1464335', ['frame-packing']],           // Man of Steel
  ['tt2267998', ['frame-packing']],           // Gone Girl (3D)
  ['tt5463162', ['frame-packing']],           // Deadpool 2
  ['tt5108870', ['frame-packing']],           // Shazam!
  ['tt7126948', ['frame-packing']],           // Wonder Woman 1984
  ['tt0451279', ['frame-packing']],           // Wonder Woman
  ['tt1477834', ['frame-packing']],           // Amazing Spider-Man 2
  ['tt0887912', ['frame-packing']],           // Beowulf (3D)
  ['tt0385700', ['frame-packing']],           // Monster House
  ['tt0336460', ['frame-packing']],           // The Polar Express
  ['tt1049413', ['frame-packing']],           // Up (Blu-ray 3D)
  ['tt0317705', ['frame-packing']],           // The Incredibles (3D re-release)
  ['tt6105098', ['frame-packing']],           // The Lion King (2019)
  ['tt0119217', ['anaglyph']],               // Good Will Hunting
  ['tt1234721', ['frame-packing']],           // Kung Fu Panda
  ['tt0439572', ['frame-packing']],           // The Flash (3D)
  ['tt0479884', ['sbs']],                    // Final Destination 3
  ['tt1454029', ['frame-packing']],           // The Help (3D re-release)
  ['tt1843866', ['frame-packing']],           // Captain America: Winter Soldier
  ['tt3183660', ['frame-packing']],           // Finding Dory
  ['tt0266543', ['frame-packing']],           // Finding Nemo (3D re-release)
  ['tt2140479', ['frame-packing']],           // Frozen II
  ['tt0325980', ['frame-packing']],           // Pirates of the Caribbean: CoTBP
  ['tt0383574', ['frame-packing']],           // Pirates of the Caribbean: DMC
  ['tt2109248', ['frame-packing']],           // Transformers: Age of Extinction
  ['tt2488496', ['frame-packing']],           // Star Wars: Episode VII
  ['tt2798920', ['frame-packing']],           // Annihilation (3D)
  ['tt3896198', ['frame-packing']],           // Guardians Vol. 2
  ['tt0988045', ['frame-packing']],           // Journey to the Center of the Earth
  ['tt1226229', ['frame-packing']],           // Journey 2: The Mysterious Island
  ['tt1320261', ['frame-packing', 'ou']],    // Sanctum 3D
  ['tt1659337', ['frame-packing']],           // The Perks of Being a Wallflower
  ['tt0974661', ['frame-packing', 'sbs']],   // Coraline
  ['tt1630029', ['frame-packing']],           // Avatar: The Way of Water
  ['tt0289879', ['frame-packing']],           // Shrek (3D re-release)
  ['tt0298148', ['frame-packing']],           // Shrek 2
  ['tt0413267', ['frame-packing']],           // Shrek the Third
  ['tt0892782', ['frame-packing']],           // Shrek Forever After
  ['tt1250777', ['frame-packing']],           // Tangled
  ['tt1979288', ['frame-packing']],           // Wreck-It Ralph
  ['tt2948372', ['frame-packing']],           // Zootopia
  ['tt2096673', ['frame-packing']],           // Inside Out
  ['tt3606756', ['frame-packing']],           // The Good Dinosaur
  ['tt1843866', ['frame-packing']],           // Captain America: Winter Soldier
  ['tt0413300', ['frame-packing']],           // Spider-Man 3
  ['tt3783958', ['frame-packing']],           // La La Land (3D)
  ['tt1000644', ['frame-packing']],           // Fantastic Mr Fox (3D)
  ['tt0770828', ['frame-packing']],           // Man of Steel
  ['tt1477834', ['frame-packing']],           // Amazing Spider-Man 2
  ['tt1853728', ['frame-packing']],           // Django Unchained (3D)
  ['tt2084970', ['frame-packing']],           // The Imitation Game (3D)
  ['tt1201607', ['frame-packing']],           // Harry Potter and the Deathly Hallows Part 2
  ['tt0926084', ['frame-packing']],           // Harry Potter and the Deathly Hallows Part 1
  ['tt1399103', ['frame-packing']],           // Thor: The Dark World
];

async function get(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${BASE}${endpoint}`, {
      params: { api_key: API_KEY, ...params }
    });
    return data;
  } catch (e) {
    if (e.response?.status === 429) { await sleep(2000); return get(endpoint, params); }
    console.warn(`  TMDB error on ${endpoint}: ${e.response?.status}`);
    return null;
  }
}

async function main() {
  console.log('=== Seeding catalogue from curated 3D movie list ===\n');

  const catalogue = [];
  const seen = new Set();
  let i = 0;

  for (const [imdbId, formats] of SEED) {
    if (seen.has(imdbId)) continue;
    seen.add(imdbId);
    i++;
    process.stdout.write(`\r[${i}/${SEED.length}] Fetching ${imdbId}...`);

    const findResult = await get(`/find/${imdbId}`, {
      external_source: 'imdb_id'
    });
    const movieStub = findResult?.movie_results?.[0];
    if (!movieStub) { await sleep(100); continue; }

    const details = await get(`/movie/${movieStub.id}`, {
      append_to_response: 'external_ids'
    });

    if (!details) { await sleep(100); continue; }

    const year = details.release_date ? parseInt(details.release_date.substring(0, 4)) : null;
    const genres = (details.genres || []).map(g => g.name);
    const formatLabels = formats.map(f => {
      if (f === 'frame-packing') return '3D: Frame Packing';
      if (f === 'sbs') return '3D: SBS';
      if (f === 'ou') return '3D: Over/Under';
      if (f === 'anaglyph') return '3D: Anaglyph';
      return '3D';
    });

    catalogue.push({
      id: imdbId,
      type: 'movie',
      name: details.title,
      year,
      poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
      background: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
      description: details.overview || '',
      rating: details.vote_average ? details.vote_average.toFixed(1) : null,
      genres: [...genres, ...formatLabels],
      formats,
      tmdbId: details.id,
    });

    await sleep(80);
  }

  // Sort by year desc, rating desc
  catalogue.sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
  });

  // Remove duplicates by imdb id
  const deduped = [];
  const ids = new Set();
  for (const m of catalogue) {
    if (!ids.has(m.id)) { ids.add(m.id); deduped.push(m); }
  }

  console.log(`\n\nSeeded ${deduped.length} movies`);
  fs.writeFileSync('./catalogue.json', JSON.stringify(deduped, null, 2));
  console.log('Saved catalogue.json — run `node fetch_3d_tmdb.js` to expand further');
}

main().catch(console.error);
