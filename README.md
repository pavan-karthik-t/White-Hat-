# White Hat

Full-stack prototype for **White Hat**, a premium Indian culinary talent platform for chefs, restaurants, hotels, event hosts, and hospitality operators.

## What changed

This repository started as a premium single-page landing concept. It has now been extended into a working full-stack prototype with:

- a Node.js backend
- API endpoints for chefs, overview metrics, masterclasses, testimonials, and lead capture
- a dynamic frontend powered by `fetch`
- live chef filtering by city, cuisine, service type, and availability
- persisted form submissions written to `data/leads.json`
- a Vercel-ready deployment setup for the frontend plus `/api/*` functions

## Stack

- `Node.js`
- `HTML`
- `CSS`
- `Vanilla JavaScript`
- built-in `node:test` for API verification

No external dependencies are required.

## Project structure

```text
.
|-- .github/
|-- api/
|   `-- index.js
|-- data/
|   |-- chefs.json
|   |-- leads.json
|   |-- masterclasses.json
|   |-- overview.json
|   `-- testimonials.json
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- server.js
|-- server.test.js
|-- supabase/
|   `-- leads.sql
|-- vercel.json
|-- whitehat-landing.html
`-- README.md
```

## Run locally

Start the prototype:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## API endpoints

- `GET /api/health`
- `GET /api/overview`
- `GET /api/chefs`
- `GET /api/masterclasses`
- `GET /api/testimonials`
- `POST /api/leads`

Example filter request:

```text
/api/chefs?city=Chennai&cuisine=Chettinad
```

## Test

Run the API checks:

```bash
npm test
```

## Deploy to Vercel

This repository is prepared for Vercel:

- static frontend assets are served from `public/`
- `/api/*` requests are rewritten to `api/index.js`
- Node.js is pinned through `package.json` using `22.x`

To deploy:

1. Import the GitHub repository into Vercel.
2. Keep the project root as the repository root.
3. Leave the frontend as static and let Vercel serve the `public/` assets automatically.

### Permanent lead storage on Vercel

To store contact form submissions permanently after deployment, connect Supabase:

1. Create a Supabase project.
2. Run the schema in [supabase/leads.sql](D:/Projects/White%20Hat/supabase/leads.sql).
3. Add these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE`

`SUPABASE_LEADS_TABLE` is optional and defaults to `leads`.

## Notes

- The original design exploration is preserved in `whitehat-landing.html`.
- The new product experience is served from `public/index.html`.
- Leads submitted through the contact form are stored locally in `data/leads.json` during local development.
- On Vercel, lead submissions are stored in Supabase when the environment variables are configured.
- If Supabase is not configured, Vercel falls back to demo-mode lead capture without permanent persistence.
