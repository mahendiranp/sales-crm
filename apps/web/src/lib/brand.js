// Single place to change the product's name across the app (nav header,
// login/signup/landing pages, terms/privacy, emails). Edit this one value
// once the real brand name is confirmed instead of hunting down every
// hardcoded "Pipeline" string.
export const APP_NAME = "Flowora";

// Shown in diagnostic info attached to feedback/issue reports — inlined
// at build time from package.json's version field (see next.config.mjs).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
