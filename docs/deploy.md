# Deploy

Kumquat writes `.kumquat/manifest.json` with:

```bash
kumquat build
```

Start production mode with:

```bash
kumquat start
```

Production bundling and non-Bun adapters are intentionally deferred.

Node runtime can be selected with:

```bash
kumquat build --runtime node
kumquat start --runtime node
```
