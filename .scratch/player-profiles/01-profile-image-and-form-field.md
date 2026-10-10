# Add a profile image and a Form field to players

Status: needs-triage
Source: navigation-overhaul spec §15, the broadcast-overlay reference that shaped the layout

## Problem

The player detail was designed from a broadcast overlay carrying a photo, Style, Form and
Notes. Two of those five have no data behind them:

| Element | Column |
|---|---|
| Name, real name, faction | `name`, `real_name`, `faction` ✓ |
| Style | `style` ✓ |
| Notes | `notes` ✓ |
| **Photo** | **none** |
| **Form** | **none** |

Both currently render as `planned`: the portrait is a hatched frame with the player's
initial and a "Photo planned" caption, Form reads "No column for this yet". Honest, but the
layout has two visible holes.

The 38 seeded Liquipedia players also have empty `style` and `notes`, since the source list
has no equivalent field — so in practice the detail column is mostly em dashes today.

## What to build

1. A migration adding the columns. Form is probably free text like Style, not an enum —
   "Top ~50, Inconsistent" is the reference's own example.
2. Somewhere to put an image. R2 is the obvious Cloudflare answer; an external URL column is
   the cheap one. This is the real decision in this ticket.
3. Admin editing UI, since `POST /api/admin/players` currently only creates.
4. A professional editing their own player's fields, once promotion exists.

## Questions for triage

- Hosted images or linked ones? Hosting means an upload path, a size limit and moderation of
  what gets uploaded. Linking means hotlinking someone else's server and broken images.
- Who may change Form — admins only, or the professional who owns the player? It is the most
  opinion-shaped of the fields.
- Are player photos a rights question worth answering before building the column?

## Done when

A player can carry a photo and a Form line, an admin can set both, and the detail layout has
no placeholder left in it.
