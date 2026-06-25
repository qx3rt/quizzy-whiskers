import { getAllQuery, runQuery } from '../db/database.js'

const TOPIC_RULES = [
  { topic: 'shakespeare',  display: 'Shakespeare',        keywords: ['SHAKESPEARE'] },
  { topic: 'dickens',      display: 'Dickens',            keywords: ['DICKENS'] },
  { topic: 'twain',        display: 'Mark Twain',         keywords: ['MARK TWAIN', 'TWAIN'] },
  { topic: 'austen',       display: 'Jane Austen',        keywords: ['JANE AUSTEN', 'AUSTEN'] },
  { topic: 'hemingway',    display: 'Hemingway',          keywords: ['HEMINGWAY'] },
  { topic: 'poe',          display: 'Edgar Allan Poe',    keywords: [' POE '] },
  { topic: 'poetry',       display: 'Poetry',             keywords: ['POETRY', ' POEMS', 'POEM '] },
  { topic: 'literature',   display: 'Literature',         keywords: ['LITERATURE', 'NOVELS', ' NOVEL ', 'AUTHORS', ' AUTHOR ', 'FICTION', 'LITERARY'] },
  { topic: 'broadway',     display: 'Broadway',           keywords: ['BROADWAY', 'MUSICAL', 'MUSICALS', 'TONY AWARD', 'TONY AWARDS'] },
  { topic: 'opera',        display: 'Opera',              keywords: ['OPERA', 'OPERAS'] },
  { topic: 'ballet',       display: 'Ballet',             keywords: ['BALLET'] },
  { topic: 'classical',    display: 'Classical Music',    keywords: ['CLASSICAL MUSIC', 'SYMPHONY', 'SYMPHONIES', 'COMPOSER', 'COMPOSERS', 'BEETHOVEN', 'MOZART', 'BACH'] },
  { topic: 'movies',       display: 'Movies',             keywords: ['MOVIE', 'MOVIES', 'FILM', 'FILMS', 'CINEMA', 'OSCAR', 'OSCARS', 'DIRECTOR', 'DIRECTORS', 'ACTOR', 'ACTRESS', 'ANIMATED FILM', 'BOX OFFICE'] },
  { topic: 'television',   display: 'Television',         keywords: ['TELEVISION', ' TV ', 'SITCOM', 'SITCOMS', 'EMMY', 'EMMYS', 'GAME SHOW', 'TALK SHOW', 'TV SHOW', 'SOAP OPERA'] },
  { topic: 'disney',       display: 'Disney',             keywords: ['DISNEY'] },
  { topic: 'music',        display: 'Music',              keywords: ['MUSIC', 'SONGS', ' SONG ', 'SINGER', 'SINGERS', 'BAND ', 'BANDS', 'ALBUM', 'ALBUMS', 'ROCK AND ROLL', "ROCK 'N' ROLL", 'JAZZ', 'BLUES', 'COUNTRY MUSIC', 'HIP HOP', 'RAP ', 'POP MUSIC'] },
  { topic: 'art',          display: 'Art',                keywords: ['PAINTING', 'PAINTINGS', 'SCULPTURE', 'SCULPTOR', 'MUSEUM', 'MUSEUMS', 'ARTIST', 'ARTISTS', 'FINE ART', 'MASTERPIECE'] },
  { topic: 'architecture', display: 'Architecture',       keywords: ['ARCHITECTURE', 'ARCHITECT', 'BUILDING', 'BUILDINGS', 'LANDMARK', 'LANDMARKS'] },
  { topic: 'presidents',   display: 'Presidents',         keywords: ['PRESIDENT', 'PRESIDENTS', 'WHITE HOUSE', 'COMMANDER IN CHIEF'] },
  { topic: 'royalty',      display: 'Royalty',            keywords: ['KING ', 'QUEEN ', 'KINGS ', 'QUEENS ', 'ROYALTY', 'MONARCHY', 'CROWN'] },
  { topic: 'war',          display: 'War & Military',     keywords: ['WAR ', ' WAR', 'WARS', 'BATTLE', 'BATTLES', 'MILITARY', 'WWII', 'WWI', 'CIVIL WAR', 'REVOLUTION'] },
  { topic: 'history',      display: 'History',            keywords: ['HISTORY', 'HISTORICAL', 'ANCIENT', 'MEDIEVAL', 'CENTURY', 'EMPIRE', 'CIVILIZATION'] },
  { topic: 'politics',     display: 'Politics',           keywords: ['POLITICS', 'POLITICAL', 'CONGRESS', 'SENATE', 'SUPREME COURT', 'ELECTION', 'CONSTITUTION'] },
  { topic: 'mythology',    display: 'Mythology',          keywords: ['MYTHOLOGY', 'MYTH', 'GODS', 'GODDESSES', 'GREEK GODS', 'ROMAN GODS', 'NORSE', 'GREEK HEROES', 'OLYMPUS'] },
  { topic: 'bible',        display: 'The Bible',          keywords: ['BIBLE', 'BIBLICAL', 'TESTAMENT', 'SCRIPTURE', 'GOSPEL', 'APOSTLE', 'PROPHET'] },
  { topic: 'religion',     display: 'Religion',           keywords: ['RELIGION', 'RELIGIOUS', 'CHURCH', 'CHRISTIANITY', 'ISLAM', 'JUDAISM', 'BUDDHISM', 'HINDUISM'] },
  { topic: 'philosophy',   display: 'Philosophy',         keywords: ['PHILOSOPHY', 'PHILOSOPHER', 'PHILOSOPHERS', 'ETHICS'] },
  { topic: 'astronomy',    display: 'Astronomy',          keywords: ['ASTRONOMY', 'ASTRONOMERS', 'PLANET', 'PLANETS', 'STARS', 'GALAXY', 'SPACE', 'NASA', 'CONSTELLATION', 'COMET', 'TELESCOPE'] },
  { topic: 'biology',      display: 'Biology',            keywords: ['BIOLOGY', 'ANIMAL', 'ANIMALS', 'MAMMAL', 'MAMMALS', 'BIRDS', 'INSECTS', 'PLANTS', 'BOTANY', 'SPECIES', 'EVOLUTION', 'DNA'] },
  { topic: 'chemistry',    display: 'Chemistry',          keywords: ['CHEMISTRY', 'ELEMENTS', 'CHEMICAL', 'PERIODIC TABLE', 'MOLECULE', 'COMPOUND'] },
  { topic: 'physics',      display: 'Physics',            keywords: ['PHYSICS', 'PHYSICISTS', 'QUANTUM', 'RELATIVITY', 'GRAVITY', 'ENERGY'] },
  { topic: 'science',      display: 'Science',            keywords: ['SCIENCE', 'SCIENTIST', 'SCIENTISTS', 'INVENTION', 'INVENTIONS', 'INVENTOR', 'INVENTORS', 'DISCOVERY', 'DISCOVERIES', 'LABORATORY', 'EXPERIMENT', 'NOBEL PRIZE'] },
  { topic: 'medicine',     display: 'Medicine',           keywords: ['MEDICINE', 'MEDICAL', 'DOCTOR', 'ANATOMY', 'DISEASE', 'SURGERY', 'PHARMACY'] },
  { topic: 'geography',    display: 'Geography',          keywords: ['GEOGRAPHY', 'GEOGRAPHICAL', 'CONTINENT', 'CONTINENTS', 'OCEAN', 'OCEANS', 'RIVER', 'RIVERS', 'MOUNTAIN', 'MOUNTAINS', 'LAKE', 'LAKES', 'DESERT', 'ISLAND', 'ISLANDS', 'PENINSULA'] },
  { topic: 'capitals',     display: 'World Capitals',     keywords: ['CAPITAL', 'CAPITALS', 'CAPITAL CITY', 'CAPITAL CITIES'] },
  { topic: 'countries',    display: 'Countries',          keywords: ['COUNTRY', 'COUNTRIES', 'NATION', 'NATIONS', 'FLAG', 'FLAGS'] },
  { topic: 'us-states',    display: 'U.S. States',        keywords: ['U.S. STATE', 'U.S. STATES', 'AMERICAN STATE', 'STATE CAPITAL', 'THE GREAT STATE'] },
  { topic: 'cities',       display: 'Cities',             keywords: ['CITY', 'CITIES'] },
  { topic: 'baseball',     display: 'Baseball',           keywords: ['BASEBALL', 'WORLD SERIES', 'MLB'] },
  { topic: 'football',     display: 'Football',           keywords: ['FOOTBALL', 'NFL', 'SUPER BOWL', 'QUARTERBACK'] },
  { topic: 'basketball',   display: 'Basketball',         keywords: ['BASKETBALL', 'NBA', 'MARCH MADNESS'] },
  { topic: 'hockey',       display: 'Hockey',             keywords: ['HOCKEY', 'NHL', 'STANLEY CUP'] },
  { topic: 'soccer',       display: 'Soccer',             keywords: ['SOCCER', 'WORLD CUP', 'FIFA', 'FOOTBALL CLUB'] },
  { topic: 'olympics',     display: 'Olympics',           keywords: ['OLYMPICS', 'OLYMPIC', 'OLYMPIAN', 'OLYMPIANS'] },
  { topic: 'golf',         display: 'Golf',               keywords: ['GOLF', 'GOLFER', 'GOLFERS', 'THE MASTERS', 'PGA'] },
  { topic: 'boxing',       display: 'Boxing',             keywords: ['BOXING', 'BOXER', 'BOXERS', 'HEAVYWEIGHT'] },
  { topic: 'tennis',       display: 'Tennis',             keywords: ['TENNIS', 'WIMBLEDON', 'US OPEN'] },
  { topic: 'sports',       display: 'Sports',             keywords: ['SPORTS', 'ATHLETE', 'ATHLETES', 'CHAMPION', 'CHAMPIONSHIP', 'HALL OF FAME', 'TROPHY', 'RACING', 'MARATHON'] },
  { topic: 'food',         display: 'Food & Drink',       keywords: ['FOOD', 'COOKING', 'CUISINE', 'CHEF', 'RECIPE', 'RESTAURANT', 'DISH', 'INGREDIENT', 'VEGETABLE', 'FRUIT', 'BREAD', 'CHEESE', 'SPICE', 'DESSERT', 'CAKE', 'WINE', 'BEER', 'COCKTAIL', 'BEVERAGE', 'POTENT POTABLE'] },
  { topic: 'business',     display: 'Business',           keywords: ['BUSINESS', 'COMPANY', 'COMPANIES', 'CORPORATION', 'STOCK MARKET', 'ECONOMY', 'ECONOMICS', 'FINANCE', 'BRAND', 'BRANDS', 'ENTREPRENEUR', 'CEO'] },
  { topic: 'technology',   display: 'Technology',         keywords: ['TECHNOLOGY', 'COMPUTER', 'COMPUTERS', 'INTERNET', 'SOFTWARE', 'APP', 'SILICON VALLEY', 'DIGITAL', 'ARTIFICIAL INTELLIGENCE'] },
  { topic: 'language',     display: 'Language & Words',   keywords: ['LANGUAGE', 'LANGUAGES', 'WORD ', 'WORDS', 'VOCABULARY', 'GRAMMAR', 'LATIN ', 'ETYMOLOGY', 'SLANG', 'IDIOM'] },
  { topic: 'biography',    display: 'Biography',          keywords: ['BIOGRAPHY', 'LIFE OF ', 'BORN IN', 'FAMOUS '] },
]

function matchTopic(categoryUpper) {
  for (const rule of TOPIC_RULES) {
    for (const kw of rule.keywords) {
      if (categoryUpper.includes(kw)) return rule
    }
  }
  return null
}

// Seeds category_groups and category_group_mappings if empty. Safe to call on every startup.
export async function syncCategoryGroups() {
  // Always upsert group rows (fast, idempotent)
  for (const rule of TOPIC_RULES) {
    await runQuery(
      'INSERT INTO category_groups (slug, display_name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
      [rule.topic, rule.display]
    )
  }

  // Only rebuild mappings when the table is empty (the expensive part)
  const [{ count }] = await getAllQuery('SELECT COUNT(*)::int AS count FROM category_group_mappings')
  if (count > 0) return

  console.log('Building category_group_mappings from Cluebase data...')
  const categories = await getAllQuery(
    "SELECT DISTINCT category FROM clues WHERE category IS NOT NULL AND category != ''"
  )
  const groups = await getAllQuery('SELECT id, slug FROM category_groups')
  const groupBySlug = Object.fromEntries(groups.map((g) => [g.slug, g.id]))

  let mapped = 0
  for (const { category } of categories) {
    const rule = matchTopic(' ' + category.toUpperCase() + ' ')
    if (!rule) continue
    const groupId = groupBySlug[rule.topic]
    if (!groupId) continue
    await runQuery(
      'INSERT INTO category_group_mappings (category_group_id, cluebase_category) VALUES ($1, $2) ON CONFLICT (cluebase_category) DO NOTHING',
      [groupId, category]
    )
    mapped++
  }
  console.log(`Category sync: mapped ${mapped} of ${categories.length} Cluebase categories`)
}

// Returns topic areas with the count of Cluebase categories mapped to each group.
export async function getTopicAreas() {
  return getAllQuery(`
    SELECT cg.slug AS id,
           cg.slug AS slug,
           COUNT(cgm.id)::int AS category_count
    FROM category_groups cg
    JOIN category_group_mappings cgm ON cgm.category_group_id = cg.id
    GROUP BY cg.slug
    ORDER BY cg.slug
  `)
}
