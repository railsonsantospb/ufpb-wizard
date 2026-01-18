(function () {
  const THEME_KEY = "ufpb-wizard-theme";
  const FONT_KEY = "ufpb-wizard-font-scale";

  const getInitialTheme = () => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  };

  const updateButtons = (theme) => {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      const isLight = theme === "light";
      btn.textContent = isLight ? "Modo escuro" : "Modo claro";
      btn.setAttribute("aria-pressed", isLight ? "true" : "false");
      btn.title = isLight ? "Voltar ao modo escuro" : "Ativar modo claro";
    });
  };

  const applyTheme = (theme) => {
    if (theme === "light") document.body.classList.add("theme-light");
    else document.body.classList.remove("theme-light");
    localStorage.setItem(THEME_KEY, theme);
    updateButtons(theme);
  };

  // Fonte / zoom assistivo
  const clampScale = (v) => Math.min(1.4, Math.max(0.8, v));
  const getInitialFont = () => {
    const stored = parseFloat(localStorage.getItem(FONT_KEY) || "1");
    return Number.isFinite(stored) ? clampScale(stored) : 1;
  };
  const updateFontDisplay = (scale) => {
    const label = `${Math.round(scale * 100)}%`;
    document.querySelectorAll("[data-font-display]").forEach(el => el.textContent = label);
  };
  const applyFontScale = (scale) => {
    const s = clampScale(scale);
    document.documentElement.style.setProperty("--font-scale", s);
    localStorage.setItem(FONT_KEY, String(s));
    updateFontDisplay(s);
  };

  applyTheme(getInitialTheme());
  applyFontScale(getInitialFont());

  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = document.body.classList.contains("theme-light") ? "dark" : "light";
      applyTheme(next);
    });
  });

  document.querySelectorAll("[data-font-inc]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--font-scale")) || 1;
      applyFontScale(current + 0.1);
    });
  });
  document.querySelectorAll("[data-font-dec]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--font-scale")) || 1;
      applyFontScale(current - 0.1);
    });
  });
})();
