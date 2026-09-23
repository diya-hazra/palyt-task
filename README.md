# Palyt - Kitchen Stock & Menu

## Run the tests

```
node --test src/*.test.js
```

No dependencies to install - uses Node's built-in test runner (Node 18+).

## Open the page

The page loads `data/stock.json` and `data/recipes.json` via `fetch`, which
browsers block on `file://`. Serve the folder locally, then open it:

```
python3 -m http.server 8000
# then visit http://localhost:8000/
```

(or `npx serve`, or any static file server you already have.)

## What's here

- `data/stock.json`, `data/recipes.json` - the kitchen's data
- `src/logic.js` - all the actual logic: unit conversion, availability,
  stock deduction, delete rules, form validation. No UI code in here.
- `src/logic.test.js` - tests for the above
- `index.html` - the two views (stock list, diner menu), plain JS, no
  build step, no framework

See the PR description for the write-up (judgment calls, how I checked the
numbers, what I'd do with another day).
