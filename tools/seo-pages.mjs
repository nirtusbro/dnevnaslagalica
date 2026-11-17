// Static content pages, written into dist/ after `vite build` (see "build" in package.json):
//
//   /slagalica/ /moj-broj/ /skocko/ /ko-zna-zna/ /asocijacije/   one guide per game
//   /pravila/                                                    rules and scoring
//   /arhiva/ and /arhiva/NNN/                                    past challenges with solutions
//   /sitemap.xml
//
// The pages are plain HTML + public/pages.css (no React), so search engines get real text and each
// game has its own address. Only challenges that are already over (before today, Belgrade time)
// are published, so today's and future solutions never leak; the deploy workflow rebuilds the site
// every night to add the day that has just ended.
//
//   node tools/seo-pages.mjs            write into dist/
//   SEO_TODAY=40 node tools/seo-pages.mjs   pretend today is challenge #40 (testing)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, GRADES, gameMax } from '../src/engine/rules.js';
import { LAUNCH_DATE, DAYS, MONTHS, pad3 } from '../src/engine/day.js';
import { SYMBOLS } from '../src/engine/skocko.js';
import { letterCount } from '../src/engine/letters.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://dnevnaslagalica.rs';
const BRAND = 'Dnevna Slagalica';
const DISCLAIMER = 'Dnevna Slagalica je nezavisan projekat i nije povezana sa Radio-televizijom Srbije niti sa TV emisijom „Slagalica“.';

// ---------- calendar (Belgrade time, independent of the build machine's time zone) ----------

const utcOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const belgradeToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date());
const TODAY = Number(process.env.SEO_TODAY) || Math.max(1, Math.round((utcOf(belgradeToday) - utcOf(LAUNCH_DATE)) / 864e5) + 1);

const dateOf = (n) => new Date(utcOf(LAUNCH_DATE) + (n - 1) * 864e5);
const isoDate = (n) => dateOf(n).toISOString().slice(0, 10);
/** "17. novembar 2026." */
const longDate = (n) => { const d = dateOf(n); return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}.`; };
const weekday = (n) => DAYS[dateOf(n).getUTCDay()];

const dayFile = (n) => join(ROOT, 'src', 'puzzles', 'days', pad3(n) + '.json');
const loadDay = (n) => JSON.parse(readFileSync(dayFile(n), 'utf8'));
const complete = (p) => p.slagalica && p.mojBroj && p.skocko && Array.isArray(p.koZnaZna) && p.asocijacije;

/** Finished challenges that have a complete day file, oldest first. */
const pastDays = [];
for (let n = 1; n < TODAY; n++) {
  if (!existsSync(dayFile(n))) break;
  const p = loadDay(n);
  if (complete(p)) pastDays.push({ n, p });
}
const latest = pastDays[pastDays.length - 1] || null;

// ---------- HTML helpers ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tiles = (items, cls = '') => `<div class="pg-tiles${cls ? ' ' + cls : ''}">${items.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
const list = (items, tag = 'ul') => `<${tag}>${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>`;
const table = (head, rows) => `<div class="pg-scroll"><table class="pg-table"><thead><tr>${head.map((h, i) => `<th${i ? ' class="pg-num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="pg-num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const spoiler = (label, html) => `<details class="pg-spoiler"><summary>${label}</summary>${html}</details>`;

const NAV = [
  ['/slagalica/', 'Slagalica'], ['/moj-broj/', 'Moj broj'], ['/skocko/', 'Skočko'],
  ['/ko-zna-zna/', 'Ko zna zna'], ['/asocijacije/', 'Asocijacije'], ['/pravila/', 'Pravila'], ['/arhiva/', 'Arhiva'],
];

const written = [];

/**
 * Write one page. `path` ends with a slash; `crumbs` is [[href, label], …] after the home page;
 * `nav` is the header entry to highlight; `lastmod` (ISO date) goes to the sitemap.
 */
function page({ path, title, description, crumbs, nav, body, lastmod }) {
  const url = SITE + path;
  const trail = [['/', BRAND], ...crumbs];
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href })),
  };
  const html = `<!doctype html>
<html lang="sr-Latn">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#141b6e">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:locale" content="sr_RS">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/archivo-italic-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/pages.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script defer src="https://cloud.umami.is/script.js" data-website-id="31a99482-d088-4e31-a468-4fb9070d9819" data-domains="dnevnaslagalica.rs,www.dnevnaslagalica.rs"></script>
</head>
<body class="pg-body">
<header class="pg-hdr">
<a class="pg-logo" href="/" aria-label="${BRAND} – početna"><span class="pg-logo-top">DNEVNA</span><span class="pg-logo-tiles">${'SLAGALICA'.split('').map((l) => `<span>${l}</span>`).join('')}</span></a>
<nav class="pg-nav" aria-label="Igre i stranice">${NAV.map(([href, label]) => `<a href="${href}"${href === nav ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
</header>
<main class="pg-wrap pg-main">
<ol class="pg-crumbs">${trail.map(([href, name], i) => `<li>${i < trail.length - 1 ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</li>`).join('')}</ol>
${body}
</main>
<footer class="pg-wrap pg-foot">
<nav aria-label="Stranice"><a href="/">Današnji izazov</a>${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
<p>${DISCLAIMER}</p>
</footer>
</body>
</html>
`;
  const dir = join(DIST, ...path.split('/').filter(Boolean));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  written.push({ path, lastmod });
}

const card = (html) => `<section class="pg-card">${html}</section>`;
const cta = (href, label, aside) => `<div class="pg-actions"><a class="pg-cta" href="${href}">${label}</a>${aside ? `<span class="pg-note">${aside}</span>` : ''}</div>`;

// ---------- puzzle fragments (shared by the archive and the "yesterday's example" boxes) ----------

const bestOf = (sl) => sl.best || sl.words.reduce((a, w) => (letterCount(w) > letterCount(a) ? w : a), '');
const symbolName = (i) => (i === 0 ? SYMBOLS[i].name : SYMBOLS[i].name.toLowerCase());
const symbolTile = (i) => SYMBOLS[i].glyph ? SYMBOLS[i].glyph.replace(/︎/g, '') : '☺';

const skockoHtml = (sk) => `${tiles(sk.secret.map(symbolTile))}<p>Kombinacija: <span class="pg-answer">${sk.secret.map(symbolName).join(', ')}</span>.</p>`;
const mojBrojTask = (mb) => `<p>Ponuđeni brojevi:</p>${tiles(mb.numbers)}<p>Traženi broj:</p>${tiles([mb.target], 'pg-gold')}`;
const mojBrojSolution = (mb) => mb.solution ? `<p>Jedno od rešenja: <span class="pg-answer">${esc(mb.solution)} = ${mb.target}</span></p>` : '';
const asocGrid = (as, withSolutions) => `<div class="pg-asoc">${as.cols.map((c) => `<div><b>Kolona ${esc(c.L)}</b>${list(c.f.map(esc))}${withSolutions ? `<span class="pg-answer">${esc(c.s)}</span>` : ''}</div>`).join('')}</div>`;

// ---------- game guides ----------

const dayLink = (d) => `<a href="/arhiva/${pad3(d.n)}/">izazova #${pad3(d.n)}</a>`;

/** One row per game: address, texts and the long-form body. `example(d)` uses the latest finished day. */
const GUIDES = [
  {
    gi: 0, path: '/slagalica/', play: '/?igra=slagalica',
    title: 'Slagalica online – najduža reč od 12 slova | ' + BRAND,
    description: 'Igraj Slagalicu online besplatno: od 12 slova složi najdužu reč za 60 sekundi. Pravila, bodovanje, saveti i novi zadatak svakog dana.',
    h1: 'Slagalica online – složi najdužu reč',
    lead: 'Slagalica je prva i najpoznatija igra kviza: dobijaš 12 slova i 60 sekundi da od njih složiš što dužu reč. Na Dnevnoj Slagalici svakog dana te čeka novi zadatak, isti za sve igrače.',
    cta: 'Igraj Slagalicu',
    how: [
      'Na tabli je 12 slova. Klikni na slova onim redom kojim želiš da ih složiš; na računaru možeš i da kucaš na tastaturi.',
      'Svako ponuđeno slovo možeš da upotrebiš samo jednom.',
      'Svako od slova LJ, NJ i DŽ je jedno polje i jedno slovo: polja L i J ne mogu da se spoje u LJ.',
      'Kada si zadovoljan rečju, potvrdi je. Ako istekne 60 sekundi, računa se reč koja je u tom trenutku složena.',
    ],
    extra: `<h2>Koje reči se priznaju</h2>
<p>Priznaje se svaka reč srpskog jezika u bilo kom obliku: padeži, množina, rod i glagolski oblici. Ne priznaju se vlastita imena i skraćenice. Rečnik sadrži više stotina hiljada oblika, pa će ti retko biti odbijena reč koju zaista znaš.</p>`,
    scoring: [
      ['Svako slovo u reči', '1 poen'],
      ['Tvoja reč je baš ona koju je zadao računar', '+5 poena'],
      ['Druga reč iste dužine kao računarova', '+10 poena'],
      ['Reč duža od računarove', '+15 poena'],
    ],
    scoringNote: 'Računar za svaki dan zadaje jednu dugu reč. Ko pronađe nju, osvaja pun broj poena za taj dan, a druga jednako duga ili duža reč donosi još veći bonus.',
    tips: [
      'Prvo potraži česte završetke: -ANJE, -ENJE, -OST, -NIK, -ICA, -AC. Oko njih se duga reč lakše sklapa.',
      'Padeži i glagolski oblici se priznaju, pa kratku reč često možeš da produžiš nastavkom: RAD, RADOVI, RADOVIMA.',
      'Ne čekaj savršenu reč. Zapamti prvu pristojnu, pa traži dužu dok vreme teče.',
      'Obrati pažnju na LJ, NJ i DŽ: to su posebna polja i svako vredi kao jedno slovo.',
    ],
    example: (d) => {
      const best = bestOf(d.p.slagalica);
      return `<p>Slova iz ${dayLink(d)}:</p>${tiles(d.p.slagalica.letters)}${spoiler('Prikaži zadatu reč', `<p>Računar je zadao reč <span class="pg-answer">${esc(best)}</span> (${letterCount(best)} slova).</p>`)}`;
    },
  },
  {
    gi: 1, path: '/moj-broj/', play: '/?igra=mojbroj',
    title: 'Moj broj online – igra sa brojevima | ' + BRAND,
    description: 'Igraj Moj broj online besplatno: pomoću šest brojeva i četiri računske operacije dođi do traženog broja za 90 sekundi. Pravila, bodovanje i saveti.',
    h1: 'Moj broj online – dođi do traženog broja',
    lead: 'Moj broj je računska igra iz kviza: od šest ponuđenih brojeva, uz sabiranje, oduzimanje, množenje i deljenje, treba da dobiješ traženi trocifreni broj. Imaš 90 sekundi.',
    cta: 'Igraj Moj broj',
    how: [
      'Dobijaš šest brojeva: četiri jednocifrena, jedan srednji (10, 15 ili 20) i jedan veliki (25, 50, 75 ili 100).',
      'Traženi broj je između 100 i 999.',
      'Sastavi izraz od brojeva, operacija + − × ÷ i zagrada. Svaki broj možeš da upotrebiš najviše jednom, a ne moraš da iskoristiš sve.',
      'Potvrdi izraz kada si zadovoljan. Ako istekne 90 sekundi, računa se izraz koji je u tom trenutku upisan.',
    ],
    extra: '',
    scoring: [
      ['Tačan broj', '10 poena'],
      ['Razlika 1–2', '8 poena'],
      ['Razlika 3–5', '6 poena'],
      ['Razlika 6–10', '4 poena'],
      ['Razlika 11–20', '2 poena'],
    ],
    scoringNote: '',
    tips: [
      'Kreni od velikog broja: pomnoži ga tako da priđeš što bliže traženom broju, pa razliku nadoknadi malim brojevima.',
      'Proveri da li je traženi broj deljiv nekim od ponuđenih brojeva. Tada je često lakše doći do količnika nego do celog broja.',
      'Zagrade daju slobodu: (a + b) × c često vodi do cilja brže nego množenje pa sabiranje.',
      'Ako ne vidiš tačno rešenje, potvrdi najbliži broj. I razlika do 20 donosi poene.',
    ],
    example: (d) => `<p>Zadatak iz ${dayLink(d)}:</p>${mojBrojTask(d.p.mojBroj)}${spoiler('Prikaži rešenje', mojBrojSolution(d.p.mojBroj))}`,
  },
  {
    gi: 2, path: '/skocko/', play: '/?igra=skocko',
    title: 'Skočko online – igraj besplatno | ' + BRAND,
    description: 'Igraj Skočko online besplatno: otkrij tajnu kombinaciju od četiri znaka u šest pokušaja. Pravila, bodovanje, saveti i nova kombinacija svakog dana.',
    h1: 'Skočko online – otkrij tajnu kombinaciju',
    lead: 'Skočko je logička igra iz kviza: računar zamisli kombinaciju od četiri znaka, a ti imaš šest pokušaja i 120 sekundi da je pogodiš.',
    cta: 'Igraj Skočko',
    how: [
      'U igri je šest znakova: Skočko, tref, pik, srce, karo i zvezda.',
      'Tajna kombinacija ima četiri znaka, a isti znak može da se ponovi.',
      'Posle svakog pokušaja dobijaš tačke. Crvena znači da je jedan znak na pravom mestu, žuta da znak postoji u kombinaciji, ali na drugom mestu.',
      'Tačke ne pokazuju na koji se znak odnose. To moraš da zaključiš sam.',
    ],
    extra: '',
    scoring: [
      ['Pogodak iz 1. ili 2. pokušaja', '20 poena'],
      ['Pogodak iz 3. ili 4. pokušaja', '15 poena'],
      ['Pogodak iz 5. ili 6. pokušaja', '10 poena'],
      ['Kombinacija nije pogođena', '0 poena'],
    ],
    scoringNote: '',
    tips: [
      'U prvom pokušaju isprobaj dva para istih znakova. Tako brzo saznaješ koji znakovi postoje u kombinaciji.',
      'Znak koji nije dobio nijednu tačku izbaci iz daljih pokušaja, ili ga koristi kao popunu kada proveravaš mesta ostalih znakova.',
      'Ne zaboravi da se znakovi ponavljaju: kombinacija može da ima i tri ili četiri ista znaka.',
      'Svaki novi pokušaj treba da se slaže sa tačkama iz svih prethodnih pokušaja.',
    ],
    example: (d) => `<p>Kombinacija iz ${dayLink(d)}:</p>${spoiler('Prikaži kombinaciju', skockoHtml(d.p.skocko))}`,
  },
  {
    gi: 3, path: '/ko-zna-zna/', play: '/?igra=koznazna',
    title: 'Ko zna zna – kviz opšteg znanja online | ' + BRAND,
    description: 'Igraj Ko zna zna online besplatno: deset pitanja opšteg znanja, po deset sekundi za svako. Nova pitanja svakog dana, pravila i bodovanje.',
    h1: 'Ko zna zna – kviz opšteg znanja online',
    lead: 'Ko zna zna je kviz opšteg znanja: deset pitanja, tri ponuđena odgovora i samo deset sekundi za svako pitanje. Svakog dana stiže deset novih pitanja.',
    cta: 'Igraj Ko zna zna',
    how: [
      'Pitanja idu jedno za drugim, a za svako imaš 10 sekundi.',
      'Izaberi jedan od tri ponuđena odgovora ili „Ne znam“.',
      'Tačan odgovor donosi poene, a netačan ih oduzima. Ako vreme istekne, pitanje se računa kao „Ne znam“.',
    ],
    extra: `<h2>Oblasti</h2>
<p>Pitanja pokrivaju deset oblasti: jezik, književnost, istoriju, geografiju, nauku, umetnost, muziku i film, prirodu, opštu kulturu i sport. Težina je kao u kvizu: većina pitanja je srednje teška ili teška.</p>`,
    scoring: [
      ['Tačan odgovor', '+10 poena'],
      ['Netačan odgovor', '−5 poena'],
      ['„Ne znam“ ili isteklo vreme', '0 poena'],
    ],
    scoringNote: 'Najviše 100 poena. Zbog negativnih poena zbir može da ode i u minus.',
    tips: [
      'Kada možeš da isključiš makar jedan ponuđeni odgovor, pogađanje se u proseku isplati.',
      'Kada o pitanju ne znaš ništa, „Ne znam“ te ne košta ništa, a pogrešan odgovor nosi minus.',
      'Pročitaj pitanje do kraja pre nego što pogledaš odgovore: deset sekundi je dovoljno i za jedno i za drugo.',
    ],
    example: (d) => `<p>Tri pitanja iz ${dayLink(d)}:</p>${list(d.p.koZnaZna.slice(0, 3).map((q) => `${esc(q.q)}<br><span class="pg-note">${q.o.map(esc).join(' · ')}</span>`), 'ol')}${spoiler('Prikaži tačne odgovore', list(d.p.koZnaZna.slice(0, 3).map((q) => `<span class="pg-answer">${esc(q.o[q.a])}</span>`), 'ol'))}`,
  },
  {
    gi: 4, path: '/asocijacije/', play: '/?igra=asocijacije',
    title: 'Asocijacije online – igra asocijacija | ' + BRAND,
    description: 'Igraj Asocijacije online besplatno: četiri kolone pojmova, četiri rešenja i jedno konačno. Nova asocijacija svakog dana, pravila, bodovanje i saveti.',
    h1: 'Asocijacije online – četiri kolone, jedno rešenje',
    lead: 'Asocijacije su završna igra kviza: iza 16 polja kriju se pojmovi raspoređeni u četiri kolone. Svaka kolona ima svoje rešenje, a četiri rešenja zajedno vode do konačnog.',
    cta: 'Igraj Asocijacije',
    how: [
      'Otvaraj polja jedno po jedno. Svako otvoreno polje otkriva jedan pojam.',
      'Kada naslutiš rešenje kolone ili konačno rešenje, klikni na to polje, upiši odgovor i potvrdi.',
      'Posle pogrešnog odgovora moraš da otvoriš novo polje pre sledećeg pokušaja, osim kada su sva polja već otvorena.',
      'Za celu igru imaš 120 sekundi.',
    ],
    extra: '',
    scoring: [
      ['Rešena kolona', '3 poena + 1 za svako neotvoreno polje u njoj'],
      ['Konačno rešenje', '7 poena + vrednost svih kolona koje još nisu rešene'],
    ],
    scoringNote: 'Najviše 34 poena.',
    tips: [
      'Ne otvaraj celu kolonu ako ne moraš: svako neotvoreno polje vredi poen.',
      'Rešenja kolona su i sama tragovi za konačno rešenje. Ponekad se konačno vidi već posle dve rešene kolone.',
      'Pojmovi su često povezani izrazima i složenicama, a ne samo značenjem. Probaj da svaki pojam izgovoriš uz moguće rešenje.',
      'Ko pogodi konačno rešenje rano, dobija i poene za sve kolone koje nije rešio.',
    ],
    example: (d) => `<p>Polja iz ${dayLink(d)}:</p>${asocGrid(d.p.asocijacije, false)}${spoiler('Prikaži rešenja', `<p>${d.p.asocijacije.cols.map((c) => `${esc(c.L)}: <span class="pg-answer">${esc(c.s)}</span>`).join(' · ')} · Konačno: <span class="pg-answer">${esc(d.p.asocijacije.final.s)}</span></p>`)}`,
  },
];

for (const g of GUIDES) {
  const game = GAMES[g.gi];
  const others = GUIDES.filter((x) => x !== g);
  page({
    path: g.path, title: g.title, description: g.description, nav: g.path,
    crumbs: [[g.path, game.name]],
    lastmod: latest ? isoDate(latest.n + 1) : undefined,
    body: card(`<h1>${g.h1}</h1>
<p class="pg-lead">${g.lead}</p>
${cta(g.play, g.cta, `Vežba na jednom od prethodnih zadataka. <a href="/">Današnji izazov</a> ima svih pet igara.`)}`)
      + card(`<h2>Kako se igra</h2>
${list(g.how, 'ol')}
${g.extra}
<h2>Bodovanje</h2>
${table(['Ishod', 'Poeni'], g.scoring)}
${g.scoringNote ? `<p class="pg-note">${g.scoringNote}</p>` : ''}
<h2>Saveti</h2>
${list(g.tips)}`)
      + (latest ? card(`<h2>Primer: jučerašnji zadatak</h2>${g.example(latest)}`) : '')
      + card(`<h2>Ostale igre</h2>
<ul class="pg-games">${others.map((o) => `<li><a href="${o.path}">${GAMES[o.gi].name}</a><span>${GAMES[o.gi].desc}</span></li>`).join('')}</ul>
<p>Sve igre zajedno čine dnevni izazov. Pogledaj <a href="/pravila/">pravila i bodovanje</a> ili <a href="/arhiva/">arhivu sa rešenjima</a>.</p>`),
  });
}

// ---------- rules ----------

page({
  path: '/pravila/', nav: '/pravila/', crumbs: [['/pravila/', 'Pravila']],
  title: 'Pravila i bodovanje – kako se igra slagalica | ' + BRAND,
  description: 'Pravila Dnevne Slagalice: kako se igraju Slagalica, Moj broj, Skočko, Ko zna zna i Asocijacije, koliko traje svaka igra i kako se boduje.',
  body: card(`<h1>Pravila i bodovanje</h1>
<p class="pg-lead">Svakog dana svi igrači dobijaju istih pet igara. Igraju se redom i svaka samo jednom, uz ograničeno vreme.</p>
${cta('/', 'Igraj današnji izazov')}`)
    + card(`<h2>Dnevni izazov</h2>
${list([
    'Novi izazov stiže svakog dana u ponoć i isti je za sve.',
    'Igre idu ovim redom: ' + GAMES.map((g) => g.name).join(', ') + '.',
    'Započeta igra može da se prekine i nastavi, ali ne može da se ponovi.',
    'Na kraju dobijaš ukupan broj poena i rezultat koji možeš da podeliš bez otkrivanja rešenja.',
    'Ko igra svakog dana, gradi niz uzastopnih dana. Stari izazovi iz <a href="/arhiva/">arhive</a> igraju se kao vežba i ne utiču na niz.',
  ])}
<h2>Ocene</h2>
<p>Posle svake igre kvadrat u boji pokazuje koji si deo mogućih poena osvojio:</p>
${table(['Ocena', 'Deo mogućih poena'], GRADES.map((g) => [g.emoji, g.label]))}`)
    + GAMES.map((g, i) => card(`<h2>${i + 1}. ${g.name}</h2>
<p class="pg-meta">${g.timeL.replace(' s', ' sekundi')} · ${i === 0 ? 'poeni zavise od dužine reči' : 'do ' + g.max + ' poena'}</p>
<p>${esc(g.rule)}</p>
<p><a href="${GUIDES[i].path}">${g.name}: saveti i primer zadatka</a></p>`)).join('')
    + card(`<h2>Prečice na tastaturi</h2>
${list([
    'Slagalica: slova i Enter. LJ, NJ i DŽ se biraju klikom.',
    'Moj broj: brojevi 1–6 biraju ponuđena polja, uz + − * / ( ) i Enter.',
    'Skočko: tasteri 1–6 za znakove, Enter za potvrdu.',
    'Ko zna zna: A, B, C ili 1, 2, 3 za odgovor i N za „Ne znam“.',
  ])}`),
});

// ---------- archive ----------

function dayBody(d) {
  const { n, p } = d;
  const best = bestOf(p.slagalica);
  const longest = [...new Set(p.slagalica.words)].filter((w) => w !== best)
    .sort((a, b) => letterCount(b) - letterCount(a) || a.localeCompare(b, 'sr')).slice(0, 8);
  const prev = pastDays.find((x) => x.n === n - 1), next = pastDays.find((x) => x.n === n + 1);
  return card(`<h1>Rešenja izazova #${pad3(n)}</h1>
<p class="pg-meta">${weekday(n)[0].toUpperCase() + weekday(n).slice(1)}, ${longDate(n)}</p>
<p class="pg-lead">Svi zadaci i rešenja Dnevne Slagalice za ovaj dan. Ako izazov još nisi igrao, odigraj ga prvo kao vežbu: rešenja su odmah ispod.</p>
${cta('/?dan=' + n, 'Odigraj izazov #' + pad3(n), 'Vežba ne utiče na niz ni na današnji izazov.')}`)
    + card(`<h2>Slagalica</h2>
<p>Ponuđena slova:</p>${tiles(p.slagalica.letters)}
<p>Reč koju je zadao računar: <span class="pg-answer">${esc(best)}</span> (${letterCount(best)} slova, vredi ${gameMax(0, p)} poena).</p>
${longest.length ? `<p>Priznavale su se i ove reči (neke su i duže od zadate):</p><ul class="pg-words">${longest.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`)
    + card(`<h2>Moj broj</h2>${mojBrojTask(p.mojBroj)}${mojBrojSolution(p.mojBroj)}`)
    + card(`<h2>Skočko</h2>${skockoHtml(p.skocko)}`)
    + card(`<h2>Ko zna zna</h2>
${list(p.koZnaZna.map((q) => `${esc(q.q)} <span class="pg-answer">${esc(q.o[q.a])}</span>`), 'ol')}`)
    + card(`<h2>Asocijacije</h2>
${asocGrid(p.asocijacije, true)}
<p>Konačno rešenje: <span class="pg-answer">${esc(p.asocijacije.final.s)}</span></p>`)
    + card(`<p class="pg-pager">${prev ? `<a href="/arhiva/${pad3(prev.n)}/">← Izazov #${pad3(prev.n)}</a>` : '<span></span>'}<a href="/arhiva/">Svi izazovi</a>${next ? `<a href="/arhiva/${pad3(next.n)}/">Izazov #${pad3(next.n)} →</a>` : '<span></span>'}</p>`);
}

for (const d of pastDays) {
  const best = bestOf(d.p.slagalica);
  page({
    path: `/arhiva/${pad3(d.n)}/`, nav: '/arhiva/',
    crumbs: [['/arhiva/', 'Arhiva'], [`/arhiva/${pad3(d.n)}/`, 'Izazov #' + pad3(d.n)]],
    title: `Rešenja izazova #${pad3(d.n)} – ${longDate(d.n).slice(0, -1)} | ${BRAND}`,
    description: `Rešenja Dnevne Slagalice #${pad3(d.n)} (${longDate(d.n)}): zadata reč ${best}, Moj broj ${d.p.mojBroj.target}, Skočkova kombinacija, odgovori iz kviza Ko zna zna i asocijacije.`,
    lastmod: isoDate(d.n + 1),
    body: dayBody(d),
  });
}

page({
  path: '/arhiva/', nav: '/arhiva/', crumbs: [['/arhiva/', 'Arhiva']],
  title: 'Arhiva izazova i rešenja | ' + BRAND,
  description: 'Svi prethodni izazovi Dnevne Slagalice sa rešenjima: zadate reči, Moj broj, Skočko, odgovori iz kviza Ko zna zna i asocijacije. Odigraj ih kao vežbu.',
  lastmod: latest ? isoDate(latest.n + 1) : undefined,
  body: card(`<h1>Arhiva izazova i rešenja</h1>
<p class="pg-lead">Ovde su svi završeni izazovi Dnevne Slagalice. Za svaki dan možeš da pogledaš zadatke i rešenja svih pet igara ili da ga odigraš kao vežbu.</p>
<p class="pg-note">Rešenja današnjeg izazova stižu sutra, kada se izazov završi.</p>
${cta('/', 'Igraj današnji izazov')}`)
    + card(pastDays.length
      ? `<h2>Prethodni izazovi</h2><ul class="pg-days">${[...pastDays].reverse().map((d) => `<li><a href="/arhiva/${pad3(d.n)}/">Izazov #${pad3(d.n)} <span>${longDate(d.n)}</span></a></li>`).join('')}</ul>`
      : '<p>Arhiva počinje sutra, kada se završi prvi izazov.</p>'),
});

// ---------- sitemap ----------

const urls = [{ path: '/', lastmod: isoDate(TODAY) }, ...written];
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${SITE}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);

console.log(`seo-pages: ${written.length} pages + sitemap.xml (today is #${pad3(TODAY)}, archive #001–#${latest ? pad3(latest.n) : '—'})`);
