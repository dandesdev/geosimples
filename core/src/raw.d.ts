/** Vite's ?raw imports, which tests use to read source files. */
declare module "*?raw" {
  const text: string;
  export default text;
}
