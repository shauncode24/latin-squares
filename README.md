# dMAT Latin Square Drill (MERN)

A practice tool for the dMAT 5×5 Latin square question type. The server generates
puzzles and grades them; the client is a pure React UI that never sees the
solution until you answer.

## How difficulty actually works

The generator doesn't hide a random number of cells and guess at difficulty. It
builds a real solved 5×5 Latin square, then hides cells one at a time while
re-running a solver after each hide. The solver reproduces the exact
row/column-only reasoning the dMAT format allows (no sub-blocks, no diagonals):
at each "round" it resolves every cell that's currently forced to one letter,
simultaneously, and checks whether the target cell has collapsed to a single
answer yet.

- **Low** → target resolves at round 0 (direct read: row ∩ column already leaves one letter)
- **Medium** → target resolves at round 1 (one pivot cell forces it)
- **High** → target resolves at round 2–3 (a short deduction chain)

A hide is only kept if it doesn't push the puzzle past the difficulty you
asked for, so every generated puzzle is guaranteed solvable by that amount of
reasoning — not just sparse-looking.

## Project structure

```
dmat-mern/
  server/            Express + MongoDB API
    lib/generator.js  puzzle generation + difficulty solver
    models/           Puzzle (TTL, single-use) and Attempt (stats) schemas
    routes/           /api/puzzles, /api/stats
    server.js
  client/            React (Vite) frontend
    src/
      api.js          fetch wrapper, per-browser client id
      App.jsx          puzzle flow: generate → answer/hint/reveal → stats
      components/      Grid, AnswerPad, Stats
```

## Why a server at all

The whole point of a practice tool is that you don't know the answer yet, so
the solution has to live server-side until you submit. The API:

- `POST /api/puzzles/generate` `{ difficulty }` → creates a puzzle, returns only
  revealed letters + blanks (never the solution), stores the puzzle in Mongo
  with a 15-minute TTL.
- `POST /api/puzzles/:id/answer` `{ letter, elapsedMs, clientId }` → grades it,
  records an `Attempt`, deletes the puzzle (single-use).
- `GET /api/puzzles/:id/reveal` → same idea, no grading.
- `GET /api/puzzles/:id/hint` → returns the coordinates of the pivot cell(s)
  from round 1 of the solver's chain — not their letters.
- `GET /api/stats?clientId=...` → solved / accuracy / avg time, overall and
  per difficulty, scoped to a client id the frontend generates and stores in
  `localStorage` (no login).

## Running it

You'll need a MongoDB instance — local (`mongod`) or a free Atlas cluster.

### 1. Server

```bash
cd server
cp .env.example .env       # edit MONGODB_URI if not using local default
npm install
npm run dev                # nodemon, http://localhost:4000
```

### 2. Client

```bash
cd client
cp .env.example .env       # edit VITE_API_URL if the server isn't on :4000
npm install
npm run dev                # http://localhost:5173
```

Open the client URL, pick a difficulty, and go. "New Grid" regenerates
infinitely — nothing is capped or seeded, every puzzle is a fresh random
Latin square.

## Notes / things worth adding next

- No auth — stats are scoped by an anonymous id in `localStorage`, so they're
  per-browser, not per-person. Swapping in real accounts would just mean
  replacing `clientId` with a `userId` from a login.
- Puzzles are single-use and TTL-expire after 15 minutes in case someone
  abandons a grid mid-solve.
- A timed 20-question batch mode (mirroring the real 25-minute test) would be
  a natural next feature — the `Attempt` schema already has everything needed
  to build a session/run on top of it.
