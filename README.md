# Syed Family Tree — Backend

Node.js (Express) + MongoDB API for the Syed family tree. It imports a GEDCOM file exported from Family Tree Maker and serves it to the [frontend](https://github.com/FarhanAli2000/family-tree-frontend).

## Setup

1. Install MongoDB locally, or create a MongoDB Atlas database.
2. Configure:
   ```sh
   cp .env.example .env   # set MONGODB_URI if not using local MongoDB
   npm install
   ```
3. Put the GEDCOM file at `data/syed-family.ged`, then import it:
   ```sh
   npm run import                      # or: npm run import -- path/to/file.ged
   ```
   This replaces everything in the `persons` and `families` collections.
4. Start the API:
   ```sh
   npm run dev     # restarts on file changes
   npm start
   ```
   Runs on http://localhost:5000.

The family data (`data/`) and photos (`media/`) are git-ignored and never committed.

## Photos

The GEDCOM only stores photo file names. Copy the files from the Family Tree Maker `... Media` folder into `media/` and they are served at `/media/<file name>`.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/stats` | Counts, number of generations, suggested root person |
| `GET /api/persons?q=name&limit=20` | Search by name (Urdu or English, partial match) |
| `GET /api/persons/:id` | Person with parents, spouses, children, siblings |
| `GET /api/persons/:id/tree?depth=3` | Descendant tree (max depth 6); nodes with `hasMore` can be loaded later |
| `GET /api/persons/:id/lineage` | Ancestor line from the top-most ancestor down to this person |

## Structure

```
src/
  index.js          Express app
  db.js             MongoDB connection
  models.js         Person and Family schemas
  routes.js         API routes
  gedcom.js         GEDCOM parser (names, events, photos, descendant counts, generations)
  importGedcom.js   import script
```
