// Centralized theme key and initial script to set theme before hydration.
export const THEME_STORAGE_KEY = "theme:v1"

// This script is injected into the server-rendered HTML to apply the
// user's preferred theme (stored in localStorage) or the OS preference
// before React hydrates. Keeping it centralized makes it easy to change
// the storage key or script behavior project-wide.
export const INITIAL_THEME_SCRIPT = `(function(){
  try {
    const t = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (t === 'dark') document.documentElement.classList.add('dark');
    else if (t === 'light') document.documentElement.classList.remove('dark');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`
