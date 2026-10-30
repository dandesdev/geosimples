# GeoSimples

Geometry figures for teaching material, exported as TikZ (LaTeX), PNG or SVG. The interface is in Brazilian Portuguese.

It replaces [tikzgenerator](https://github.com/dandesdev/tikzgenerator), the archived v1.

## Layout

```
src/              Vite + React editor
core/             framework-free figure model, geometry and exporters (@geosimples/core)
```

## Scripts

```
npm install
npm run dev        # editor
npm run build      # editor production build
npm test           # core and editor tests (vitest)
npm run typecheck  # core typecheck
npm run lint
```

## License

MIT
