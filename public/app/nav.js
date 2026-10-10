// Navigation visibility. Pure: no DOM, no fetch.

/**
 * Three outcomes, and conflating them is the easiest mistake in the whole shell:
 *
 *   visible — usable now
 *   planned — rendered inert, because the feature is not built yet
 *   prompt  — usable, but asks the viewer to sign in first
 *
 * A forbidden item is none of these: it is absent from the returned list, because
 * "hidden" means not in the DOM at all. Rendering it dimmed would say "coming soon"
 * about something that is simply not for you.
 */
export const VISIBILITY = { visible: 'visible', planned: 'planned', prompt: 'prompt' };

/**
 * @param session.role        null, 'community' or 'professional'
 * @param session.adminKey    an accepted admin key, which is not a role: an admin-key
 *                            holder is otherwise anonymous
 * @param session.accountsEnabled
 *        Accounts do not exist yet. Until they do, rating stays open to anyone with a
 *        browser-local voter id, exactly as it is today, and Account has nothing to show.
 *        Flipping this to true is what turns the spec's target-state matrix on.
 */
export function navigation({ role = null, adminKey = false, accountsEnabled = false } = {}) {
  const signedIn = role === 'community' || role === 'professional';
  return [
    { key: 'players', label: 'Players', href: '/players', visibility: VISIBILITY.visible },
    { key: 'leaderboard', label: 'Leaderboard', href: '/leaderboard', visibility: VISIBILITY.visible },
    {
      key: 'rate',
      label: 'Rate',
      href: '/rate',
      visibility: !accountsEnabled || signedIn ? VISIBILITY.visible : VISIBILITY.prompt,
    },
    accountsEnabled && signedIn
      ? { key: 'account', label: 'Account', href: '/account', visibility: VISIBILITY.planned }
      : null,
    adminKey ? { key: 'admin', label: 'Admin', href: '/admin', visibility: VISIBILITY.visible } : null,
  ].filter(Boolean);
}

/**
 * Footer links are session-independent: a legal notice says the same thing to everyone,
 * and there is no session in which it is hidden.
 */
export const FOOTER_LINKS = [
  { key: 'help', label: 'Help', href: '/help', visibility: VISIBILITY.visible },
  { key: 'legal', label: 'Legal notice', href: '/legal', visibility: VISIBILITY.visible },
  { key: 'privacy', label: 'Privacy', href: '/privacy', visibility: VISIBILITY.visible },
];

/** Whether a route key is reachable in this session, for rejecting a stale URL. */
export function isReachable(pageKey, session) {
  return navigation(session).some(item => item.key === pageKey)
    || FOOTER_LINKS.some(link => link.key === pageKey);
}
