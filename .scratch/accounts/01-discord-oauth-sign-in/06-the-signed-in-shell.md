# The signed-in shell

Status: ready-for-agent
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: 05

## What to build

**Session on load.** `main.js` calls `GET /api/auth/me` and puts `role` into the `session`
object that `navigation()` already reads. `ACCOUNTS_ENABLED` stays `false` in this ticket —
[07](07-make-the-published-promises-true.md) flips it, so everything here is invisible until
then and can be built without a half-finished shell reaching a visitor.

**Header.** Signed out: `Sign in with Discord`, an `<a href="/api/auth/discord/start">`, a
full-page navigation. Not a `fetch`, not a modal — the authorize step is a top-level
redirect and an XHR cannot do it. Labelled as Discord sign-in rather than a bare "Login",
because an unlabelled control that jumps to `discord.com` reads as a phish. There is no
separate Register control: first sign-in is registration, and a second button starting the
identical redirect is a spec smell.

Signed in: the username, and a Logout control that `POST`s `/api/auth/logout` and re-renders.

**No avatar is rendered.** The hash is stored, nothing displays it. An
`<img src="https://cdn.discordapp.com/...">` loads from another origin, which the privacy
page says nothing on this site does — and it would slip past the guard test, because that
test greps source files and this URL would come from a database value. That blind spot is
named in [../../HANDOFF.md](../../HANDOFF.md); this is the first feature to walk into it.
Add a rendered-output assertion to that test rather than relying on the grep.

**Rate page.** Signed out, the sliders render in their disabled state behind a
"Sign in with Discord to rate" panel, pointing at the same URL. The form is shown rather
than replaced, so the visitor can see what they are being asked to sign in for. The submit
button is disabled, and the server answers `401` regardless — a disabled input is a
suggestion.

`nav.js` already has the right vocabulary for this and needs no change: `prompt` means
"usable, but asks the viewer to sign in first", which is exactly Rate's signed-out state
once accounts are on.

**`?auth=failed`** renders one line above the Rate page: sign-in did not complete, try
again. Read it out of the query string and drop it from the state, so a reload does not
re-show it.

## Watch out

- `render()` replaces `root.innerHTML` wholesale. Session state belongs in the `session`
  object beside the others, not in the DOM.
- The Account page stays `planned`. `nav.js` already returns it that way for a signed-in
  user, and `views.plannedPage` already renders it. Building it is a follow-up.
- Nothing may load from another origin, and a test enforces it.

## Done when

The header shows the right control in both states, logout clears the session, the Rate page
renders disabled-with-a-prompt when signed out, `?auth=failed` shows one line and does not
survive a reload, `npm test` is green and no avatar URL appears in rendered output.
