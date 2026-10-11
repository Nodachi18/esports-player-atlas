// THROWAWAY PROTOTYPE — see admin-layout.html. Fixtures only; nothing here calls the API
// and nothing here mutates anything.
//
// Three layouts for the admin page once a player form lives in it:
//
//   A  Roster rail      picker and form side by side; the page is a workspace
//   B  One column       the form is the page; the picker is an overlay on the header search
//   C  Mode tabs        Edit / New / Overview, and the form opens inside the roster row
//
// Each renders three states: no Selection (Create), a Selection (Save + Delete), and the
// delete guard. ?variant=A&screen=selected&tile=1

import { header, footer, esc } from '/app/views.js';
import { navigation } from '/app/nav.js';
import { DEFAULT_STATE } from '/app/state.js';

// ---------------------------------------------------------------- fixtures

const GAME = 'StarCraft: Brood War';

const ROSTER = [
  ['flash', 'Flash', 'Lee Young Ho', 'Terran'],
  ['jaedong', 'Jaedong', 'Lee Jae Dong', 'Zerg'],
  ['bisu', 'Bisu', 'Kim Taek Yong', 'Protoss'],
  ['stork', 'Stork', 'Song Byung Goo', 'Protoss'],
  ['boxer', 'BoxeR', 'Lim Yo Hwan', 'Terran'],
  ['nada', 'NaDa', 'Lee Yoon Yeol', 'Terran'],
  ['savior', 'sAviOr', 'Ma Jae Yoon', 'Zerg'],
  ['july', 'July', 'Park Sung Joon', 'Zerg'],
  ['fantasy', 'Fantasy', 'Jung Myung Hoon', 'Terran'],
  ['rain', 'Rain', 'Jung Yoon Jong', 'Protoss'],
  ['light', 'Light', 'Lee Jae Ho', 'Terran'],
  ['snow', 'SnOw', 'Jang Yoon Chul', 'Protoss'],
  ['soulkey', 'Soulkey', 'Kim Min Chul', 'Zerg'],
  ['sea', 'Sea', 'Yum Bo Sung', 'Terran'],
  ['effort', 'effOrt', 'Kim Jung Woo', 'Zerg'],
  ['calm', 'Calm', 'Kim Yoon Hwan', 'Zerg'],
  ['horang2', 'Horang2', 'Lee Kyung Min', 'Protoss'],
  ['mini', 'Mini', 'Byun Hyun Je', 'Protoss'],
  ['best', 'Best', 'Doh Jae Wook', 'Protoss'],
  ['shuttle', 'Shuttle', 'Kim Yoon Joong', 'Protoss'],
  ['sharp', 'Sharp', 'Jo Ki Seok', 'Terran'],
  ['larva', 'Larva', 'Lim Hong Gyu', 'Zerg'],
  ['action', 'Action', 'Kim Seong Dae', 'Zerg'],
  ['free', 'free', 'Yoon Yong Tae', 'Protoss'],
  ['hiya', 'HiyA', 'Ku Sung Hoon', 'Terran'],
  ['bbyong', 'Bbyong', 'Jung Woo Yong', 'Terran'],
  ['barracks', 'BarrackS', 'Hwang Byung Yung', 'Terran'],
  ['last', 'Last', 'Kim Sung Hyun', 'Terran'],
  ['queen', 'Queen', 'Kim Myung Woon', 'Zerg'],
  ['mind', 'Mind', 'Park Sung Gyoon', 'Terran'],
  ['movie', 'Movie', 'Jin Young Hwa', 'Protoss'],
  ['pusan', 'Pusan', 'Park Ji Ho', 'Protoss'],
  ['nal-ra', 'Nal_rA', 'Kang Min', 'Protoss'],
  ['iris', 'Iris', 'Byun Hyung Tae', 'Terran'],
  ['killer', 'Killer', 'Park Joon Oh', 'Zerg'],
  ['hero', 'herO', 'Jo Il Jang', 'Zerg'],
  ['modesty', 'Modesty', 'Kim Hyun Woo', 'Zerg'],
  ['jaehoon', 'Jaehoon', 'Kim Jae Hoon', 'Protoss'],
].map(([slug, name, real_name, faction]) => ({ slug, name, real_name, faction, game: GAME }));

// Deliberately lopsided, and deliberately larger than today's three rows: the guard has
// to be judged at the scale where it matters, not at the scale where nothing is at stake.
const RATINGS = { boxer: 12, flash: 9, jaedong: 7, bisu: 5, savior: 3, free: 2, jaehoon: 1 };
const ratingsFor = slug => RATINGS[slug] || 0;
const TOTALS = { players: ROSTER.length, ratings: 39, flagged: 2 };

// Four of thirty-eight have any editorial text. That is the real density of this table —
// the seed migration left style and notes empty — and the form should look right empty.
const EDITORIAL = {
  boxer: {
    style: 'Mind games and expensive, beautiful risks. Built the Terran highlight reel.',
    form: 'Retired from competition; exhibition appearances only.',
    notes: 'The Emperor. First household name in Brood War, and his fan club outlived his career.',
  },
  flash: {
    style: 'Mechanically flawless, refuses to gamble. Wins by never being wrong.',
    form: 'Top 3 on the ASL ladder, still ruthless.',
    notes: '',
  },
  jaedong: { style: 'Relentless aggression, never off the front foot.', form: 'Top 10, streaky.', notes: '' },
  bisu: { style: 'Opened up what Protoss could do against Zerg.', form: 'Top 10.', notes: '' },
};
const editorialFor = slug => EDITORIAL[slug] || { style: '', form: '', notes: '' };

const RECENT_RATINGS = [
  ['BoxeR', 'community', '2026-10-09', '88 / 91 / 74 / 80 / 93', false],
  ['Flash', 'professional', '2026-10-09', '97 / 95 / 98 / 96 / 94', false],
  ['Jaehoon', 'community', '2026-10-08', '100 / 100 / 100 / 100 / 100', true],
  ['free', 'community', '2026-10-08', '71 / 68 / 74 / 70 / 66', false],
  ['Jaedong', 'community', '2026-10-07', '90 / 88 / 95 / 82 / 86', false],
];

const GAMES = [GAME, 'StarCraft II', 'Dota 2'];

/** Mirrors src/worker.js:261 so the create preview tells the truth about the slug. */
const slugify = s =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'player';

/** Mirrors uniqueSlug(): a taken slug is silently suffixed, which is the point. */
function previewSlug(handle) {
  const base = slugify(handle);
  const taken = s => ROSTER.some(p => p.slug === s);
  if (!taken(base)) return { slug: base, collided: false, base };
  for (let n = 2; ; n++) if (!taken(`${base}-${n}`)) return { slug: `${base}-${n}`, collided: true, base };
}

// ---------------------------------------------------------------- prototype state

const VARIANTS = [
  ['A', 'Roster rail'],
  ['B', 'One column'],
  ['C', 'Mode tabs'],
];
const SCREENS = [
  ['empty', 'No Selection', 'The create form, and what tells you that is what you are looking at.'],
  ['selected', 'A Selection', 'The same form holding a Player. Save and Delete present, slug read-only.'],
  ['delete', 'The delete guard', 'Names the Player, counts the Ratings, refuses until the slug is typed.'],
];

/**
 * Where the answer from the server lands. Ticket 03 is blocked on this one being a
 * question about the page rather than about the contract, so each variant has to put it
 * somewhere and be judged on it. The expired case is the ugly one: the token lives 8
 * hours, signOutAdmin() currently throws the page back to Players, and a filled form
 * would go with it.
 */
const MESSAGES = {
  none: null,
  ok: { tone: 'ok', text: 'Saved. The public profile changed straight away.' },
  expired: {
    tone: 'bad',
    text: 'Your admin session expired, so nothing was saved. Sign in again in the footer — everything you typed is still here.',
  },
};

const params = new URLSearchParams(location.search);
const pt = {
  variant: VARIANTS.some(([k]) => k === params.get('variant')) ? params.get('variant') : 'A',
  screen: SCREENS.some(([k]) => k === params.get('screen')) ? params.get('screen') : 'selected',
  tile: params.get('tile') !== '0',
  query: params.get('q') || '',
  slug: 'boxer',
  typed: '',          // what has been typed into the delete guard
  msg: MESSAGES[params.get('msg')] !== undefined ? params.get('msg') : 'none',
};

const flash = () => {
  const m = MESSAGES[pt.msg];
  return m ? `<p class="result ${m.tone}" role="status">${esc(m.text)}</p>` : '';
};

const selected = () => ROSTER.find(p => p.slug === pt.slug) || ROSTER[0];
const matches = () => {
  const q = pt.query.trim().toLowerCase();
  if (!q) return ROSTER;
  return ROSTER.filter(p =>
    p.name.toLowerCase().includes(q) || p.real_name.toLowerCase().includes(q) || p.game.toLowerCase().includes(q));
};

// ---------------------------------------------------------------- form atoms

const field = (label, value, o = {}) => `
  <label class="pt-f${o.wide ? ' wide' : ''}">
    <span class="pt-fl">${esc(label)}</span>
    ${o.area
      ? `<textarea rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(value || '')}</textarea>`
      : `<input type="text" value="${esc(value || '')}" placeholder="${esc(o.ph || '')}"
               ${o.list ? `list="${o.list}"` : ''} ${o.handle ? 'data-handle="1"' : ''}>`}
    ${o.hint ? `<span class="pt-hint">${o.hint}</span>` : ''}
  </label>`;

const GAMES_LIST = `<datalist id="pt-games">${GAMES.map(g => `<option value="${esc(g)}"></option>`).join('')}</datalist>`;

/**
 * The seven editable fields, in one place, so the variants argue about arrangement
 * rather than about content. `form` is the column this map adds.
 */
function fields(player, wideKeys = ['style', 'form', 'notes']) {
  const ed = player ? editorialFor(player.slug) : { style: '', form: '', notes: '' };
  const create = !player;
  const wide = key => wideKeys.includes(key);
  return {
    handle: field('Handle', player?.name, {
      ph: 'BoxeR',
      handle: create,
      hint: create ? 'The public name. The slug is built from it, once.' : '',
    }),
    realName: field('Real name', player?.real_name, { ph: 'Lim Yo Hwan' }),
    game: field('Game', player?.game, {
      ph: 'StarCraft: Brood War', list: 'pt-games',
      hint: 'Pick an existing game or type a new one. Spelling it differently splits the roster.',
    }),
    faction: field('Faction', player?.faction, { ph: 'Terran' }),
    style: field('Style', ed.style, { ph: 'How they play', area: true, rows: 2, wide: wide('style') }),
    form: field('Form', ed.form, {
      ph: 'Top ~50, inconsistent',
      hint: 'Your judgement of where they stand. Never calculated from ratings.',
      wide: wide('form'),
    }),
    notes: field('Notes', ed.notes, { ph: 'Anything else worth recording', area: true, rows: 3, wide: wide('notes') }),
  };
}

/** Not a field: a read-only cell, so the row of inputs does not end ragged. */
const readCell = (label, value) => `
  <div class="pt-f pt-read">
    <span class="pt-fl">${esc(label)}</span>
    <p>${value}</p>
  </div>`;

// ---------------------------------------------------------------- the guard

/**
 * Decision 8, built the same way in all three variants: the Player is named, the exact
 * number of Ratings is stated, Delete stays disabled until the slug is typed, and Enter
 * does nothing. Cancel holds the focus.
 */
function guard(player) {
  const n = ratingsFor(player.slug);
  const armed = pt.typed === player.slug;
  return `
    <div class="pt-body">
      <h2>Delete ${esc(player.name)}?</h2>
      <p>
        This removes ${esc(player.name)} from the site
        ${n
          ? `and destroys the <span class="pt-count">${n} rating${n === 1 ? '' : 's'}</span> cast about them.`
          : 'They have <span class="pt-count">no ratings</span> yet, so nothing else goes with them.'}
      </p>
      <p>Nothing restores either. There is no backup of the ratings table and no undo.</p>
      <div class="pt-type">
        <label class="pt-f">
          <span class="pt-fl">Type ${esc(player.slug)} to confirm</span>
          <input id="pt-confirm" type="text" value="${esc(pt.typed)}" placeholder="${esc(player.slug)}"
                 autocomplete="off" spellcheck="false" aria-describedby="pt-confirm-why">
        </label>
      </div>
      <span class="pt-hint" id="pt-confirm-why">Typing the slug is the only confirmation. A dialog you can
        dismiss with a reflexive Enter is not a guard.</span>
      <div class="pt-acts">
        <!-- Keep holds the focus, so a reflexive Enter cancels. Not while tiled: three
             states are on the page and autofocus would jump the reader to the third. -->
        <button class="pt-ghost" type="button" data-cancel ${pt.tile ? '' : 'autofocus'}>Keep ${esc(player.name)}</button>
        <button class="pt-del" type="button" id="pt-confirm-go" ${armed ? '' : 'disabled'}>
          Delete ${esc(player.name)}${n ? ` and ${n} rating${n === 1 ? '' : 's'}` : ''}
        </button>
      </div>
      <span class="pt-hint" data-deleted hidden>Prototype: nothing was deleted.</span>
    </div>`;
}

// ---------------------------------------------------------------- shared chunks

const statCards = () => `
  <div class="stats">
    ${[['players', TOTALS.players], ['ratings', TOTALS.ratings], ['flagged', TOTALS.flagged]]
      .map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('')}
  </div>`;

const ratingsTable = () => `
  <table class="admintable">
    <tr><th>Player</th><th>Panel</th><th>Date</th><th>Scores</th><th>Flagged</th></tr>
    ${RECENT_RATINGS.map(([name, panel, date, scores, flagged]) => `
      <tr><td>${name}</td><td>${panel}</td><td>${date}</td><td>${scores}</td><td>${flagged ? 'yes' : 'no'}</td></tr>`).join('')}
  </table>`;

const createPreview = () => {
  const { slug, collided, base } = previewSlug(pt.typedHandle || '');
  if (!pt.typedHandle) return '<span class="pt-slug">/<b data-slugpreview>…</b></span>';
  return `<span class="pt-slug">/<b data-slugpreview>${esc(slug)}</b></span>
    ${collided ? `<span class="pt-hint warn" data-slugwarn>${esc(base)} is taken, so this becomes ${esc(slug)}.</span>` : ''}`;
};

// ---------------------------------------------------------------- A: roster rail

function variantA(screen) {
  const create = screen === 'empty';
  const player = create ? null : selected();
  const f = fields(player);
  const rows = matches();

  const rail = `
    <aside class="pt-rail">
      <div class="pt-railhead">
        <h2>Roster</h2>
        <span class="count">${rows.length} of ${ROSTER.length}</span>
      </div>
      <button class="pt-railnew" type="button" data-new ${create ? 'data-on' : ''}>+ New player</button>
      <p class="pt-railhint">Filtered by the search in the header. The figure is ratings cast.</p>
      ${rows.length ? `<ul class="pt-raillist">${rows.map(p => `
        <li><button type="button" data-pick="${esc(p.slug)}" ${!create && p.slug === pt.slug ? 'aria-current="true"' : ''}>
          <span class="n">${esc(p.name)}</span>
          <span class="r${ratingsFor(p.slug) ? '' : ' zero'}">${ratingsFor(p.slug) || '–'}</span>
          <span class="s">${esc(p.real_name)} · ${esc(p.faction)}</span>
        </button></li>`).join('')}</ul>`
        : `<p class="pt-railempty">No player matches “${esc(pt.query)}”. Clearing the search brings all
             ${ROSTER.length} back.</p>`}
    </aside>`;

  const head = create
    ? `<div class="pt-mode">
         <span class="pt-tag create">New player</span>
         <h1 data-handlepreview>${esc(pt.typedHandle || 'Unnamed')}</h1>
         ${createPreview()}
       </div>`
    : `<div class="pt-mode">
         <span class="pt-tag edit">Editing</span>
         <h1>${esc(player.name)}</h1>
         <span class="pt-slug">/<b>${esc(player.slug)}</b></span>
       </div>
       <span class="pt-hint">The slug is this player's public address and is in every link ever shared.
         It cannot change.</span>`;

  return `
    <div class="pt-a">
      ${rail}
      <section class="pt-work">
        ${head}
        <fieldset class="pt-set">
          <legend>Identity</legend>
          <div class="pt-grid2">${f.handle}${f.realName}${f.game}${f.faction}</div>
        </fieldset>
        <fieldset class="pt-set">
          <legend>Editorial</legend>
          <div class="pt-grid2">${f.style}${f.form}${f.notes}</div>
        </fieldset>
        <div class="pt-actions">
          <button class="pt-save" type="button" data-save>${create ? 'Create player' : 'Save changes'}</button>
          ${create
            ? '<span class="pt-hint">Creating opens the new player for editing.</span>'
            : `<button class="pt-del" type="button" data-open-guard>Delete ${esc(player.name)}</button>`}
        </div>
        <!-- A: the answer lands under the controls that caused it, at the end of the form. -->
        ${flash()}
        ${create ? '' : `
          <details class="pt-sub">
            <summary>${ratingsFor(player.slug)} ratings about ${esc(player.name)}</summary>
            ${ratingsTable()}
          </details>`}
      </section>
    </div>
    <div class="pt-totals">
      <span><b>${TOTALS.players}</b> players</span>
      <span><b>${TOTALS.ratings}</b> ratings</span>
      <span><b>${TOTALS.flagged}</b> flagged</span>
      <a href="#" data-noop>All ratings</a>
    </div>`;
}

// ---------------------------------------------------------------- B: one column

function variantB(screen) {
  const create = screen === 'empty';
  const player = create ? null : selected();
  const f = fields(player);
  const rows = matches();
  const showDrop = Boolean(pt.query.trim()) || create;

  const drop = !showDrop ? '' : `
    <div class="pt-drop">
      <div class="pt-dh">Overlays the header search · ${rows.length} of ${ROSTER.length}</div>
      ${rows.slice(0, 6).map(p => `
        <button type="button" data-pick="${esc(p.slug)}">
          <span class="n">${esc(p.name)}</span>
          <span class="s">${esc(p.real_name)} · ${esc(p.faction)}</span>
          <span class="r">${ratingsFor(p.slug) || '–'} ratings</span>
        </button>`).join('') || '<div class="pt-dh">Nothing matches. Press New player instead.</div>'}
    </div>`;

  const bar = create
    ? `<div class="pt-bar create">
         <span class="pt-tag create">New player</span>
         <b data-handlepreview>${esc(pt.typedHandle || 'Unnamed')}</b>
         ${createPreview()}
         <span class="pt-sp"></span>
         <button class="pt-save" type="button" data-save>Create player</button>
         ${flash()}
       </div>`
    : `<div class="pt-bar">
         <span class="pt-tag edit">Editing</span>
         <b>${esc(player.name)}</b>
         <span class="pt-slug">/<b>${esc(player.slug)}</b></span>
         <span class="pt-sp"></span>
         <button class="pt-ghost" type="button" data-new>New player</button>
         <button class="pt-save" type="button" data-save>Save changes</button>
         <!-- B: inside the sticky bar, so the answer stays on screen however far the
              form has been scrolled. -->
         ${flash()}
       </div>`;

  const zone = create ? '' : (screen === 'delete'
    ? `<section class="pt-zone"><div class="pt-guard">${guard(player)}</div></section>`
    : `<section class="pt-zone">
         <h2>Delete this player</h2>
         <p>Removes ${esc(player.name)} and the ${ratingsFor(player.slug)} ratings cast about them. There is
            no undo, and no backup to restore from.</p>
         <button class="pt-del" type="button" data-open-guard>Delete ${esc(player.name)}</button>
       </section>`);

  return `
    <div class="pt-b">
      ${drop}
      ${bar}
      <div class="pt-col">${f.handle}${f.realName}${f.game}${f.faction}${f.style}${f.form}${f.notes}</div>
      ${zone}
      <section class="pt-ovr">
        <h2>Site overview</h2>
        ${statCards()}
        ${ratingsTable()}
      </section>
    </div>`;
}

// ---------------------------------------------------------------- C: mode tabs

function variantC(screen) {
  const create = screen === 'empty';
  const player = create ? null : selected();
  const f = fields(player, ['style', 'notes']);
  const rows = matches();
  const n = player ? ratingsFor(player.slug) : 0;

  const tabs = `
    <div class="pt-tabs" role="tablist" aria-label="Admin mode">
      <button role="tab" type="button" aria-selected="${!create}" data-pick="${esc(pt.slug)}">Edit player</button>
      <button role="tab" type="button" aria-selected="${create}" data-new>New player</button>
      <button role="tab" type="button" aria-selected="false" data-noop>Overview</button>
    </div>`;

  // The third cell of the second row is read-only, and it is the first time rating data
  // appears inside the edit surface. The map lists how far that should go as open fog.
  const formBody = `
    <div class="pt-grid3">
      ${f.handle}${f.realName}${f.game}
      ${f.faction}${f.form}
      ${readCell('Ratings', player
        ? `<b class="pt-num">${n}</b> ${n === 1 ? 'rating' : 'ratings'}${n ? ', last on 2026-10-09' : ' yet'}`
        : 'None until someone rates them')}
      ${f.style}${f.notes}
    </div>`;

  if (create) {
    return `
      ${tabs}
      <div class="pt-newcard">
        <div class="pt-mode">
          <span class="pt-tag create">New player</span>
          <h1 data-handlepreview>${esc(pt.typedHandle || 'Unnamed')}</h1>
          ${createPreview()}
        </div>
        ${formBody}
        <div class="pt-actions">
          <button class="pt-save" type="button" data-save>Create player</button>
          <span class="pt-hint">The new player opens in Edit player.</span>
        </div>
        ${flash()}
      </div>
      <div class="pt-stub"><b>Overview</b>Today's stats cards and the full ratings table move here, unchanged.</div>`;
  }

  const row = p => {
    const open = p.slug === pt.slug;
    const ed = editorialFor(p.slug);
    const n = ratingsFor(p.slug);
    return `
      <div class="pt-row" ${open ? 'data-open' : ''}>
        <button class="pt-rowbtn" type="button" data-pick="${esc(p.slug)}">
          <span class="n">${esc(p.name)}</span>
          <span class="d">${esc(p.real_name)}</span>
          <span class="d">${esc(p.faction)}</span>
          <span class="d${ed.form ? '' : ' empty'}">${esc(ed.form || '—')}</span>
          <span class="r${n ? '' : ' zero'}">${n || '–'}</span>
        </button>
        ${open ? `
          <div class="pt-drawer">
            <div class="pt-drawerbody">
              <div class="pt-mode">
                <span class="pt-tag edit">Editing</span>
                <span class="pt-slug">/<b>${esc(p.slug)}</b></span>
                <span class="pt-hint">Fixed at create. Every shared link uses it.</span>
              </div>
              ${formBody}
              ${screen === 'delete'
                ? `<div class="pt-guard" style="margin-top:18px">${guard(p)}</div>`
                : `<div class="pt-actions">
                     <button class="pt-save" type="button" data-save>Save changes</button>
                     <button class="pt-ghost" type="button" data-pick="${esc(p.slug)}">Discard</button>
                     <button class="pt-del" type="button" data-open-guard>Delete ${esc(p.name)}</button>
                   </div>
                   <!-- C: inside the drawer, so the message is attached to the row it is
                        about. Off screen once the roster is scrolled past it. -->
                   ${flash()}`}
            </div>
          </div>` : ''}
      </div>`;
  };

  return `
    ${tabs}
    <div class="pt-roster">
      <div class="pt-rowhead">
        <span>Handle</span><span>Real name</span><span>Faction</span><span>Form</span><span>Ratings</span>
      </div>
      ${rows.length ? rows.map(row).join('')
        : `<p class="pt-railempty">No player matches “${esc(pt.query)}”.</p>`}
    </div>
    <div class="pt-stub"><b>Overview</b>Today's stats cards and the full ratings table move here, unchanged.</div>`;
}

const VARIANT_FN = { A: variantA, B: variantB, C: variantC };

// ---------------------------------------------------------------- page

function frame([key, label, blurb]) {
  const body = VARIANT_FN[pt.variant](key);
  const dialog = pt.variant === 'A' && key === 'delete'
    // Tiled, the modal has to sit in its frame rather than float over the document, or
    // all three states land on top of each other.
    ? `<dialog class="pt-guard${pt.tile ? ' pt-inflow' : ''}" id="pt-dialog" ${pt.tile ? 'open' : ''}>${guard(selected())}</dialog>`
    : '';
  return `
    <div class="pt-frame">
      ${pt.tile ? `<div class="pt-caption"><b>${esc(label)}</b><span>${esc(blurb)}</span></div>` : ''}
      ${body}
      ${dialog}
    </div>`;
}

function render() {
  document.documentElement.dataset.admin = '1';
  document.documentElement.dataset.lensActive = 'combined';

  const state = { ...DEFAULT_STATE, page: 'admin', query: pt.query };
  const session = { role: null, adminKey: true, accountsEnabled: false, adminError: '' };
  const shown = pt.tile ? SCREENS : SCREENS.filter(([k]) => k === pt.screen);
  const [, variantName] = VARIANTS.find(([k]) => k === pt.variant);

  const active = document.activeElement;
  const keepSearch = active && active.id === 'search';
  const caret = keepSearch ? active.selectionStart : 0;

  document.getElementById('app').innerHTML = `
    <div class="pt-banner">
      <b>Prototype</b> — admin page layout, variant ${pt.variant} (${esc(variantName)}).
      Fixture data: 38 players and 39 ratings, where the live site has 3 ratings today.
      Nothing saves, nothing deletes. Throwaway: delete <code>public/prototype/</code> before merging.
    </div>
    ${header(navigation(session), 'admin', state, session)}
    <main class="wrap${pt.tile ? ' pt-tiled' : ''}">${shown.map(frame).join('')}</main>
    ${footer(state, session)}
    ${GAMES_LIST}
    <div class="pt-switch">
      <button type="button" data-cycle="-1" aria-label="Previous layout">←</button>
      <span class="pt-name">${pt.variant} · ${esc(variantName)}</span>
      <button type="button" data-cycle="1" aria-label="Next layout">→</button>
      <span class="pt-rule"></span>
      <button type="button" data-tile ${pt.tile ? 'data-on' : ''}>Tile all</button>
      <span class="pt-rule"></span>
      ${SCREENS.map(([k, label]) =>
        `<button type="button" data-screen="${k}" ${!pt.tile && pt.screen === k ? 'data-on' : ''}>${esc(label)}</button>`).join('')}
      <span class="pt-rule"></span>
      <button type="button" data-msg ${pt.msg === 'none' ? '' : 'data-on'}>${
        { none: 'No message', ok: 'Saved', expired: 'Session expired' }[pt.msg]}</button>
    </div>`;

  if (keepSearch) {
    const box = document.getElementById('search');
    box.focus();
    box.setSelectionRange(caret, caret);
  }

  const dialog = document.getElementById('pt-dialog');
  if (dialog && !pt.tile && !dialog.open) {
    dialog.showModal();
    // Escape cancels, which is safe and therefore allowed. Enter does not, which is the
    // whole of decision 8: the focused control is Keep, and the guard input swallows it.
    dialog.addEventListener('cancel', () => { pt.screen = 'selected'; pt.typed = ''; render(); });
  }

  wireGuard();

  const url = `?variant=${pt.variant}&screen=${pt.screen}&tile=${pt.tile ? 1 : 0}&msg=${pt.msg}` +
    (pt.query ? `&q=${encodeURIComponent(pt.query)}` : '');
  history.replaceState(null, '', url);
}

function wireGuard() {
  const input = document.getElementById('pt-confirm');
  if (!input) return;
  const go = document.getElementById('pt-confirm-go');
  const slug = selected().slug;

  input.addEventListener('input', () => {
    pt.typed = input.value;
    go.disabled = input.value !== slug;
  });
  // The whole point of decision 8: Enter must not be a way through.
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') event.preventDefault();
  });
  go.addEventListener('click', () => {
    const said = document.querySelector('[data-deleted]');
    if (said) said.hidden = false;
  });
}

// ---------------------------------------------------------------- events

const app = document.getElementById('app');

app.addEventListener('click', event => {
  const hit = sel => event.target.closest(sel);

  if (hit('[data-noop]')) return event.preventDefault();

  const cycle = hit('[data-cycle]');
  if (cycle) return setVariant(Number(cycle.dataset.cycle));

  if (hit('[data-tile]')) { pt.tile = !pt.tile; return render(); }

  if (hit('[data-msg]')) {
    const order = ['none', 'ok', 'expired'];
    pt.msg = order[(order.indexOf(pt.msg) + 1) % order.length];
    return render();
  }

  if (hit('[data-save]')) { pt.msg = 'ok'; return render(); }

  const screen = hit('[data-screen]');
  if (screen) { pt.tile = false; pt.screen = screen.dataset.screen; pt.typed = ''; return render(); }

  const pick = hit('[data-pick]');
  if (pick) { pt.slug = pick.dataset.pick; pt.screen = 'selected'; pt.tile = false; pt.typed = ''; return render(); }

  if (hit('[data-new]')) { pt.screen = 'empty'; pt.tile = false; pt.typedHandle = ''; return render(); }

  if (hit('[data-open-guard]')) { pt.screen = 'delete'; pt.tile = false; pt.typed = ''; return render(); }

  if (hit('[data-cancel]')) { pt.screen = 'selected'; pt.typed = ''; return render(); }

  // Real header and footer links: this prototype is one page, so they go nowhere.
  if (hit('[data-page], [data-admin-out], .brand')) event.preventDefault();
});

app.addEventListener('input', event => {
  if (event.target.id === 'search') { pt.query = event.target.value; return render(); }

  // The create form's slug preview, live, including the silent collision suffix.
  if (event.target.dataset.handle) {
    pt.typedHandle = event.target.value;
    const name = document.querySelector('[data-handlepreview]');
    if (name) name.textContent = pt.typedHandle || 'Unnamed';
    const out = document.querySelector('[data-slugpreview]');
    if (!out) return;
    const { slug, collided, base } = previewSlug(pt.typedHandle);
    out.textContent = pt.typedHandle ? slug : '…';
    let warn = document.querySelector('[data-slugwarn]');
    if (collided && pt.typedHandle) {
      if (!warn) {
        warn = document.createElement('span');
        warn.className = 'pt-hint warn';
        warn.dataset.slugwarn = '1';
        out.closest('.pt-slug').after(warn);
      }
      warn.textContent = `${base} is taken, so this becomes ${slug}.`;
    } else if (warn) warn.remove();
  }
});

app.addEventListener('submit', event => event.preventDefault());

function setVariant(step) {
  const i = VARIANTS.findIndex(([k]) => k === pt.variant);
  pt.variant = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length][0];
  render();
}

addEventListener('keydown', event => {
  const el = document.activeElement;
  if (el && (el.matches('input, textarea, select') || el.isContentEditable)) return;
  if (event.key === 'ArrowLeft') return setVariant(-1);
  if (event.key === 'ArrowRight') return setVariant(1);
  if (event.key === 't') { pt.tile = !pt.tile; return render(); }
  const n = ['1', '2', '3'].indexOf(event.key);
  if (n > -1) { pt.tile = false; pt.screen = SCREENS[n][0]; pt.typed = ''; render(); }
});

render();
