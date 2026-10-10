# Self-host the typefaces

Status: resolved
Type: task
Source: decision 3 of [03-privacy-statement.md](03-privacy-statement.md)

## Problem

`public/index.html` loaded Barlow and Barlow Condensed from `fonts.googleapis.com`, with
the files themselves from `fonts.gstatic.com`. So every visitor's browser opened a
connection to Google and handed it their IP address, before they had clicked anything and
without being asked. It was the only third party on the site other than the host.

Writing [03](03-privacy-statement.md) turned this up and disclosed it. Disclosure was the
wrong end state: the same files can be served from this origin, which deletes the question
instead of answering it.

## Why it is not the same as Cloudflare

Both are US companies, both certified under the EU–US Data Privacy Framework, so the
transfer mechanism is not the difference. Two things are:

- **Role.** Cloudflare is a processor under Art. 28, acting on the operator's instructions
  under a DPA in its terms. Google, serving fonts from its own CDN, has no contract here
  and takes no instruction: it receives the IP as an independent controller, for its own
  purposes. That is a disclosure to a third party and needs its own Art. 6 basis.
- **Avoidability.** No website can be served without *some* host seeing the visitor's IP,
  so Cloudflare seeing it is unavoidable and the balance under Art. 6(1)(f) is easy. A
  font file is avoidable at zero cost. That is what **LG München I, 20.01.2022, 3 O
  17493/20** turned on, awarding €100: because self-hosting was available, there was no
  legitimate interest in sending the IP to Google at all.

  First instance, one regional court, not appellate precedent — and the warning-letter
  wave it set off was itself largely ruled abusive. But the reasoning is shared by the
  German supervisory authorities, and the fix costs an afternoon, so the citation is not
  what decides this.

## What was done

- `public/fonts/` holds the 14 `woff2` files: Barlow 400/500/600/700 and Barlow Condensed
  500/600/700, each in `latin` and `latin-ext`. Subsets beyond those (vietnamese, and the
  rest) are dropped — the UI is English and the player names are latin.
- `public/app/fonts.css` declares them, **keeping the `unicode-range` lines** from the
  Google css2 response. Those are what stop `latin-ext` being fetched unless a glyph calls
  for it; deleting them doubles what every visitor downloads.
- `public/fonts/OFL.txt` ships beside them, because the SIL Open Font License 1.1 requires
  the licence and copyright to travel with the files. Barlow is Jeremy Tribby's.
- `index.html` lost both `preconnect` hints and the stylesheet link.
- The Google section of the privacy page is gone, and the Cloudflare section now says what
  it could not say before: Cloudflare is the only company involved, and loading the page
  contacts no other server.

## What keeps it true

A sentence claiming no other origin is contacted is worth only as much as the markup
behind it. `test/frontend.test.js` now walks `index.html` and every file in `public/app/`
for an `http(s)` `src`, `href` or `url()`, and fails on any. A second test checks every
face `fonts.css` declares exists on disk, and that `OFL.txt` is still there.

## Note for whoever adds a glyph

The arrows already in the UI — `↗` on external links, `←`/`→` on the pager — are outside
the `latin` subset, so they render in a system fallback font. That was true with Google
Fonts too; nothing changed. If they ever need to match, the subset has to grow.
