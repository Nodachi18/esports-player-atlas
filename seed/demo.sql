-- Demo data for LOCAL development only. Never run this against the remote database:
-- the invite code below (PRO-DEMO-2026) is public.

INSERT OR IGNORE INTO players (slug, name, real_name, game, faction, style, notes)
VALUES ('jyj', 'JYJ', 'Jeong Yeongjae', 'StarCraft II', 'Terran', 'Modern "Jack of all Trades"', 'ASL Season 15 Champion');

-- sha256('PRO-DEMO-2026')
INSERT OR IGNORE INTO pro_invites (code_hash, label)
VALUES ('336a2ff4f62913afd81fd176b8750dd0e2da650b4c799f11f1c8ca6223a45fe1', 'Demo');
