// Runs before first paint (loaded synchronously in <head>) so the saved or system
// theme is applied with no flash of the wrong palette.
try {
  var saved = localStorage.getItem("tm-theme");
  var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
