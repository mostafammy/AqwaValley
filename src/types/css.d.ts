// Type declarations for importing CSS files in TypeScript.
// Ensures side-effect global CSS imports (e.g. `import "~/styles/globals.css"`) do
// not cause TypeScript errors. Also includes module declarations for CSS modules.

declare module "*.css";
declare module "*.scss";
declare module "*.sass";

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.module.scss" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
