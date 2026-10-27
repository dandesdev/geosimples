# GeoSimples

Geometry figures for teaching material, exported as TikZ (LaTeX), PNG or SVG. The interface is in Brazilian Portuguese.

This is the v2 rewrite. v1 is [tikzgenerator](https://github.com/dandesdev/tikzgenerator), live at https://geosimples.vercel.app.

## Layout

```
apps/geosimples   Vite + React editor
packages/core     framework-free figure model, geometry and exporters (@geosimples/core)
```

## Scripts

```
npm install
npm run dev        # editor
npm run build      # editor production build
npm test           # core tests (vitest)
npm run typecheck  # core typecheck
npm run lint
```

## License

MIT
