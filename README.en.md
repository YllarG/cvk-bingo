# Sales Bingo

An internal gamified motivation tool for sales teams. A 5×5 bingo card where every square is a sales activity. Players tick a square once they've completed the activity. Points come from completing a whole pattern — a row, column, diagonal, the corners, or the full card.

Built for the CV Keskus sales team. Season runs August–December 2026, roughly 20 players.

**Live:** https://cvk-bingo.vercel.app

---

## Why

To keep the sales team engaged through the second half of the year. Bingo gives ordinary work a playful frame: the same activities people already do become visible and competitive. Because points require a full pattern, no single activity scores on its own — you need a combination, which nudges people to vary what they do.

Each pattern can only be won once, by whoever completes it first. That creates urgency without anyone taking anything from anyone else — every player can tick every square.

---

## Game logic

### The card

25 squares, columns B-I-N-G-O. The centre square (N3) is free and holds the logo. **Every player gets the same card** with the same tasks.

### Patterns and points

| Pattern | Ticks needed | Points |
|---|---|---|
| Rows 1, 2, 4, 5 | 5 | 6 |
| Columns B, I, G, O | 5 | 6 |
| Row 3 | 4 | 4 |
| Column N | 4 | 4 |
| Diagonals 1 and 2 | 4 | 4 |
| Corners | 4 | 4 |
| MÜÜGIBINGO (hidden) | 5 | 15 |
| Full card | 25 | 30 |

Patterns crossing the free centre square need one tick fewer, which is why they're worth less.

**MÜÜGIBINGO** is a hidden five-square combination (indices 1, 10, 18, 23, 24). Players know it exists but not which squares it covers. Its shape is revealed on the leaderboard only after someone wins it.

**Total available:** 113 points from patterns.

### Square of the week

Every Monday the system picks a random square and outlines it in blue on the card. The first player to tick it that week earns 2 bonus points. Anyone who ticked it earlier doesn't score — this gives players who are behind a fresh chance each week.

Across roughly 20 weeks that adds up to 40 points, over a quarter of the total point pool.

**Technical note:** the new square is picked when the first player opens their card that week. If nobody opens it, no square is chosen.

### End of game

31 December 2026, or when someone completes the full card. A full card means that player has also collected every other pattern along the way — after that there's nothing left to win. The code does not lock the card automatically; ending the game is a manual call.

---

## Prizes

Configurable on the admin page, stored in the `settings` table.

| Prize | Amount | Paid as |
|---|---|---|
| Monthly 1st | €50 | gift card |
| Monthly 2nd | €25 | gift card |
| Monthly 3rd | €15 | gift card |
| Full card | €350 | salary bonus (gross) |
| MÜÜGIBINGO | €150 | salary bonus (gross) |

**Maximum budget:** (50+25+15) × 5 months + 350 + 150 = **€950**

Monthly prizes are paid as gift cards, the two special prizes as gross salary bonuses. Budget for employer taxes on top of the gross figure — in Estonia €500 gross costs the employer roughly €670.

The monthly table is calculated from wins in the current calendar month (patterns plus squares of the week). Each month starts from zero — earlier wins stay in the overall leaderboard but don't affect the monthly standings. If fewer than three people scored in a month, only the corresponding places are awarded.

The admin page lists months separately, marked KÄIB (running) or LÕPPENUD (closed), with the payout total. On payday you look at last month's row.

**Worth being aware of:** the full card plus MÜÜGIBINGO come to €500 for one person, more than half the budget. The monthly prizes (€450) spread across up to 15 placings. If the aim is to reward many people rather than one top performer, the proportions are worth revisiting.

---

## Technical setup

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Font | Montserrat (Google Fonts) |

There is no authentication. A player enters a name, gets a card, and the link between them is kept in the browser's `localStorage`.

### Pages

| Route | Contents |
|---|---|
| `/` | Landing page, logo, entry button |
| `/player` | Name entry with duplicate check |
| `/bingo` | The card, rules, current score |
| `/leaderboard` | Standings, pattern overview, monthly top 3, recent wins, player list |
| `/admin` | Prize accounting, player management (password protected) |

### Database tables

```
players          (id, email, name, created_at)
cards            (id, player_id)
marked_squares   (id, card_id, square_number, marked_at)
wins             (id, player_id, pattern_type, won_at)
claimed_patterns (id, pattern_type, claimed_by_player_id, claimed_at)  -- UNIQUE pattern_type
weekly_square    (id, week_start, square_number, winner_player_id, won_at)  -- UNIQUE week_start
settings         (key, value)
```

`claimed_patterns.pattern_type` is UNIQUE — this guarantees at database level that a pattern can't be won twice. The code attempts an insert and treats the resulting error as "someone got there first".

**All timestamp columns are `TIMESTAMPTZ`.** If you use an older schema with plain `TIMESTAMP`, the interface will display times in UTC, three hours behind Estonian time in summer.

---

## Known limitations

**The card is tied to one browser.** A player can't reach their card from another device. If browser data is cleared, the card is gone. A PIN and a personal link were both considered, but simplicity won.

**Names must be unique.** The check is case-insensitive (`ilike`) and trims whitespace, but won't catch typos. Two people called Jaan need to agree on who is "Jaan K".

**Ticks are not verified.** The system trusts the player. With money involved it's worth considering spot checks, or at least stating in the rules that wins may be reviewed.

**Supabase free tier.** The project pauses after seven days without activity. During quiet stretches, check in occasionally.

**Mobile view is untested.** The card is five squares wide and will be cramped on a phone.

**No Teams or Slack integration.** It was considered, but connecting Power Automate to an external app needs IT sign-off. Current approach: someone posts the standings manually once a week.

---

## Setting this up for another country or team

The same code works for other teams once you swap the database and the copy.

### 1. Supabase

Create a new project. In the SQL Editor create the tables (schema above), enable RLS on each table and add a permissive policy:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON <table> FOR ALL USING (true) WITH CHECK (true);
```

Populate `settings` with the prize amounts.

Copy the **Project URL** and **publishable key** (Settings → API Keys).

### 2. Vercel

Import the repo from GitHub. Add the environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

Deploy.

**Check the URL character by character.** A single wrong letter produces a "Load failed" error that gives no hint as to the cause — this cost several hours during the build.

### 3. Adapt the content

| What | Where |
|---|---|
| Square texts | `app/bingo/page.tsx` → `BINGO_SQUARES` |
| Patterns and points | `app/bingo/page.tsx` → `PATTERNS` |
| Hidden pattern | `PATTERNS` → `MÜÜGIBINGO` indices |
| Admin password | `app/admin/page.tsx` → `ADMIN_PASSWORD` |
| Logo | The SVG is inline in `app/bingo/page.tsx` and `app/page.tsx` |
| Language | All copy is hardcoded, currently in Estonian |

Point tables appear in three files (`bingo`, `leaderboard`, `admin`) — if you change the points, change all three.

### 4. Before going live

Clear the test data:

```sql
DELETE FROM weekly_square;
DELETE FROM claimed_patterns;
DELETE FROM wins;
DELETE FROM marked_squares;
DELETE FROM cards;
DELETE FROM players;
```

Test players who won patterns keep those patterns locked away from real players.

---

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` needs the same two variables as Vercel.

Changes go live on push:

```bash
git add .
git commit -m "description"
git push
```

Vercel builds automatically, 2–3 minutes.

**Use a private window for testing** — every new private window gives a clean `localStorage`, so you can play as a new player without losing your own card.

---

## Time spent

Building and testing took roughly 10–12 hours across four days, including learning how to set up Supabase and Vercel.

---

## Credits

Concept, game rules, content and design: **Üllar Gustavson**, CV Keskus.

The code was written in collaboration with Claude AI (Anthropic). The concept, game mechanics, scoring system and all editorial decisions are human — the AI acted as a development partner.
