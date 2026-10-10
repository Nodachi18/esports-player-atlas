-- Demo data for LOCAL development only. Never run this against the remote database:
-- the invite code below (PRO-DEMO-2026) is public.

INSERT OR IGNORE INTO players (slug, name, real_name, game, faction, style, notes)
VALUES ('jyj', 'JYJ', 'Jeong Yeongjae', 'StarCraft II', 'Terran', 'Modern "Jack of all Trades"', 'ASL Season 15 Champion');

-- sha256('PRO-DEMO-2026')
INSERT OR IGNORE INTO pro_invites (code_hash, label)
VALUES ('336a2ff4f62913afd81fd176b8750dd0e2da650b4c799f11f1c8ca6223a45fe1', 'Demo');

-- Brood War players, for a demo list long enough to page through.
-- Source: Liquipedia StarCraft wiki, Players/Full Players List, fetched 2026-10-10 via
-- its MediaWiki API. Liquipedia content is CC BY-SA 3.0; ID, real name and race are
-- reproduced here with attribution. LOCAL DEMO DATA ONLY.
-- Style and notes are left empty: the source list has no equivalent field.
INSERT OR IGNORE INTO players (slug, name, real_name, game, faction, style, notes)
VALUES
  ('flash', 'Flash', 'Lee Young Ho', 'StarCraft: Brood War', 'Terran', '', ''),
  ('jaedong', 'Jaedong', 'Lee Jae Dong', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('bisu', 'Bisu', 'Kim Taek Yong', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('stork', 'Stork', 'Song Byung Goo', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('boxer', 'BoxeR', 'Lim Yo Hwan', 'StarCraft: Brood War', 'Terran', '', ''),
  ('nada', 'NaDa', 'Lee Yoon Yeol', 'StarCraft: Brood War', 'Terran', '', ''),
  ('savior', 'sAviOr', 'Ma Jae Yoon', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('july', 'July', 'Park Sung Joon', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('fantasy', 'Fantasy', 'Jung Myung Hoon', 'StarCraft: Brood War', 'Terran', '', ''),
  ('rain', 'Rain', 'Jung Yoon Jong', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('light', 'Light', 'Lee Jae Ho', 'StarCraft: Brood War', 'Terran', '', ''),
  ('snow', 'SnOw', 'Jang Yoon Chul', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('soulkey', 'Soulkey', 'Kim Min Chul', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('sea', 'Sea', 'Yum Bo Sung', 'StarCraft: Brood War', 'Terran', '', ''),
  ('effort', 'effOrt', 'Kim Jung Woo', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('calm', 'Calm', 'Kim Yoon Hwan', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('horang2', 'Horang2', 'Lee Kyung Min', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('mini', 'Mini', 'Byun Hyun Je', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('best', 'Best', 'Doh Jae Wook', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('shuttle', 'Shuttle', 'Kim Yoon Joong', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('sharp', 'Sharp', 'Jo Ki Seok', 'StarCraft: Brood War', 'Terran', '', ''),
  ('larva', 'Larva', 'Lim Hong Gyu', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('action', 'Action', 'Kim Seong Dae', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('free', 'free', 'Yoon Yong Tae', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('hiya', 'HiyA', 'Ku Sung Hoon', 'StarCraft: Brood War', 'Terran', '', ''),
  ('bbyong', 'Bbyong', 'Jung Woo Yong', 'StarCraft: Brood War', 'Terran', '', ''),
  ('barracks', 'BarrackS', 'Hwang Byung Yung', 'StarCraft: Brood War', 'Terran', '', ''),
  ('last', 'Last', 'Kim Sung Hyun', 'StarCraft: Brood War', 'Terran', '', ''),
  ('queen', 'Queen', 'Kim Myung Woon', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('mind', 'Mind', 'Park Sung Gyoon', 'StarCraft: Brood War', 'Terran', '', ''),
  ('movie', 'Movie', 'Jin Young Hwa', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('pusan', 'Pusan', 'Park Ji Ho', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('nal-ra', 'Nal_rA', 'Kang Min', 'StarCraft: Brood War', 'Protoss', '', ''),
  ('iris', 'Iris', 'Byun Hyung Tae', 'StarCraft: Brood War', 'Terran', '', ''),
  ('killer', 'Killer', 'Park Joon Oh', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('hero', 'herO', 'Jo Il Jang', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('modesty', 'Modesty', 'Kim Hyun Woo', 'StarCraft: Brood War', 'Zerg', '', ''),
  ('jaehoon', 'Jaehoon', 'Kim Jae Hoon', 'StarCraft: Brood War', 'Protoss', '', '');
