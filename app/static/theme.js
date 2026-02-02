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

  // Toast de feedback rápido (erros/avisos)
  const ensureToastStack = () => {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  };
  const removeToast = (el) => {
    if (!el) return;
    el.classList.add("toast-hide");
    setTimeout(() => el.remove(), 220);
  };
  const showToast = (message, variant = "info", opts = {}) => {
    if (!message) return;
    const stack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-show${variant ? " " + variant : ""}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");

    const icon = document.createElement("div");
    icon.className = "toast-icon";
    icon.textContent = variant === "danger" ? "!" : "i";

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Fechar aviso");
    close.textContent = "×";
    close.addEventListener("click", () => removeToast(toast));

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    stack.appendChild(toast);

    const duration = typeof opts.duration === "number" ? opts.duration : 4200;
    const timer = setTimeout(() => removeToast(toast), duration);
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => removeToast(toast), 1200);
    });
  };

  window.ufpbToast = showToast;
})();
