# White Hat

Full-stack prototype for **White Hat**, a premium Indian culinary talent platform for chefs, restaurants, hotels, event hosts, and hospitality operators.

## What changed

This repository started as a premium single-page landing concept. It has now been extended into a working full-stack prototype with:

- a Node.js backend
- API endpoints for chefs, overview metrics, masterclasses, testimonials, and lead capture
- a dynamic frontend powered by `fetch`
- live chef filtering by city, cuisine, service type, and availability
- persisted form submissions written to `data/leads.json`

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

## Notes

- The original design exploration is preserved in `whitehat-landing.html`.
- The new product experience is served from `public/index.html`.
- Leads submitted through the contact form are stored locally in `data/leads.json`.
