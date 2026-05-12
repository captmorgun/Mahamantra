/* ═══════════════════════════════════════════════════════════
   Mahamantra.online — app.js (v2)
   ═══════════════════════════════════════════════════════════ */
;(function () {
  "use strict";

  /* ── утилита: безопасный localStorage ── */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v !== null ? v : fallback; }
      catch { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, val); } catch { /* Safari private, quota */ }
    },
  };

  /* ── глобальное состояние ── */
  let beads          = 1;
  let rounds         = 1;
  let userPaused     = false;
  let introRestMS    = 0;
  let guardId        = null;
  let introEndStamp  = 0;
  let wakeLock       = null;
  let introVisible   = true;
  let introTimerId   = null;   // вместо showIntro.t
  let speed          = +store.get("mantraSpeed", 4.5);
  let curLang        = store.get("mantraLang", "ru");
  let isDark         = false;
  const introDuration = 9.8;
  const INTRO_MS      = 10000;
  const HOOK_MAX_RETRIES = 20;

  /* ── DOM ── */
  const $      = (id) => document.getElementById(id);
  const decBtn     = $("dec");
  const incBtn     = $("inc");
  const spdText    = $("spdText");
  const waviy      = $("waviy");
  const intro      = $("intro");
  const roundsVal  = $("roundsVal");
  const beadsVal   = $("beadsVal");
  const fontCtrl   = $("fontCtrl");
  const triggerArea = $("triggerArea");
  const langSel    = $("langSel");
  const themeBtn   = $("theme");
  const moonIcon   = $("moon");
  const sunIcon    = $("sun");
  const pauseBadge = $("pauseBadge");
  const metaTheme  = document.querySelector('meta[name="theme-color"]');

  langSel.value = curLang;

  /* ══════════════════════════════════════════════
     СЧЁТЧИК
     ══════════════════════════════════════════════ */
  function updateCounter() {
    roundsVal.textContent = rounds;
    beadsVal.textContent  = beads;
  }

  function onIter() {
    if (introVisible) return;
    if (++beads > 108) {
      beads = 1;
      rounds++;
      showIntro();
    }
    updateCounter();
  }

  /* ══════════════════════════════════════════════
     HOOK — привязка счётчика к первому <span>
     ══════════════════════════════════════════════ */
  function hook(retries) {
    if (retries === undefined) retries = 0;

    // очищаем старые
    waviy.querySelectorAll("#first").forEach((e) => {
      e.removeEventListener("animationiteration", onIter);
      e.removeAttribute("id");
    });

    const first = waviy.querySelector("span");
    if (!first) {
      if (retries < HOOK_MAX_RETRIES) {
        setTimeout(() => hook(retries + 1), 100);
      }
      return;
    }
    first.id = "first";
    first.addEventListener("animationiteration", onIter);
  }

  /* ══════════════════════════════════════════════
     INTRO (панча-таттва мантра)
     ══════════════════════════════════════════════ */
  function showIntro() {
    clearTimeout(introTimerId);
    introVisible = true;
    intro.classList.remove("hidden");
    waviy.classList.add("paused");
    setSpeedCtrlsVisible(false);
    fitIntro();

    introEndStamp = Date.now() + INTRO_MS;
    introTimerId  = setTimeout(hideIntro, INTRO_MS);
  }

  function fitIntro() {
    if (!intro || intro.classList.contains("hidden")) return;

    intro.style.setProperty("--intro-scale", "1");

    requestAnimationFrame(() => {
      if (intro.classList.contains("hidden")) return;

      const viewport = window.visualViewport || document.documentElement;
      const viewportWidth = viewport.width || document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = viewport.height || document.documentElement.clientHeight || window.innerHeight;
      const availableWidth = Math.max(0, viewportWidth - 24);
      const availableHeight = Math.max(0, viewportHeight - 24);
      const textWidth = intro.scrollWidth || intro.offsetWidth;
      const textHeight = intro.scrollHeight || intro.offsetHeight;

      if (!availableWidth || !availableHeight || !textWidth || !textHeight) return;

      const scale = Math.min(1, availableWidth / textWidth, availableHeight / textHeight);
      intro.style.setProperty("--intro-scale", Math.max(0.1, scale).toFixed(3));
    });
  }

  function fitMantra() {
    if (!waviy) return;

    const mantraBox = waviy.parentElement || waviy;
    mantraBox.style.setProperty("--mantra-scale", "1");

    requestAnimationFrame(() => {
      const viewport = window.visualViewport || document.documentElement;
      const viewportWidth = viewport.width || document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = viewport.height || document.documentElement.clientHeight || window.innerHeight;
      const isPortrait = viewportHeight >= viewportWidth;

      if (curLang !== "hy" || !isPortrait) return;

      const availableWidth = Math.max(0, viewportWidth - 24);
      const availableHeight = Math.max(0, viewportHeight - 24);
      const textWidth = waviy.scrollWidth || waviy.offsetWidth;
      const textHeight = waviy.scrollHeight || waviy.offsetHeight;

      if (!availableWidth || !availableHeight || !textWidth || !textHeight) return;

      const scale = Math.min(1, availableWidth / textWidth, availableHeight / textHeight);
      mantraBox.style.setProperty("--mantra-scale", Math.max(0.1, scale).toFixed(3));
    });
  }

  function hideIntro() {
    intro.classList.add("hidden");
    waviy.classList.remove("paused");
    introVisible = false;
    introRestMS  = 0;
    setSpeedCtrlsVisible(true);
    resetWave();
    fitMantra();
    updateCounter();
  }

  function restartIntroTimer() {
    if (userPaused) {
      introRestMS = INTRO_MS;
      clearTimeout(introTimerId);
      return;
    }
    clearTimeout(introTimerId);
    introEndStamp = Date.now() + INTRO_MS;
    introTimerId  = setTimeout(hideIntro, INTRO_MS);
  }

  function setSpeedCtrlsVisible(show) {
    [decBtn, incBtn, spdText].forEach((el) =>
      el.classList.toggle("hidden", !show)
    );
  }

  /* ══════════════════════════════════════════════
     СКОРОСТЬ
     ══════════════════════════════════════════════ */
  function setSpeed(doReset) {
    const root = document.documentElement.style;
    root.setProperty("--speed", speed + "s");
    root.setProperty("--step",  (speed / 16).toFixed(3) + "s");
    spdText.textContent = speed.toFixed(1);
    if (doReset) resetWave();
  }

  function resetWave() {
    waviy.querySelectorAll(".w").forEach((s) => {
      s.style.animation = "none";
      // двойной rAF надёжнее, чем offsetHeight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          s.style.animation = "";
          s.style.animationDelay = "calc(var(--step) * " + s.dataset.i + ")";
        });
      });
    });
    // hook после rAF завершится
    requestAnimationFrame(() => {
      requestAnimationFrame(() => hook());
    });
  }

  decBtn.onclick = () => {
    if (speed > 2) {
      speed -= 0.5;
      store.set("mantraSpeed", speed);
      setSpeed(true);
    }
  };
  incBtn.onclick = () => {
    if (speed < 9) {
      speed += 0.5;
      store.set("mantraSpeed", speed);
      setSpeed(true);
    }
  };

  /* ══════════════════════════════════════════════
     ПАУЗА
     ══════════════════════════════════════════════ */
  function setUserPaused(next) {
    if (userPaused === next) return;
    userPaused = next;

    pauseBadge.classList.toggle("hidden", !userPaused);
    document.documentElement.classList.toggle("userPaused", userPaused);

    if (userPaused) {
      if (introVisible) {
        introRestMS = Math.max(0, introEndStamp - Date.now());
        clearTimeout(introTimerId);
      }
      stopGuard();
      releaseWakeLock();
    } else {
      if (introVisible) {
        clearTimeout(introTimerId);
        introRestMS = 0;
        render(curLang);
        showIntro();
      }
      startGuard();
      if (document.visibilityState === "visible") acquireWakeLock();
    }
  }

  function toggleUserPause() { setUserPaused(!userPaused); }

  /* видимость вкладки */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      setUserPaused(true);
      return;
    }
    if (!userPaused) acquireWakeLock();
  });

  /* ══════════════════════════════════════════════
     ТЕМА
     ══════════════════════════════════════════════ */
  function applyTheme(dark) {
    isDark = dark;
    document.body.classList.toggle("dark", isDark);
    if (sunIcon)  sunIcon.classList.toggle("hidden", !isDark);
    if (moonIcon) moonIcon.classList.toggle("hidden", isDark);
    if (metaTheme) metaTheme.content = isDark ? "#1e2226" : "#f5f5f7";
    store.set("mantraTheme", isDark ? "dark" : "light");
  }

  function toggleTheme() { applyTheme(!isDark); }

  // начальная тема: сохранённая → системная → светлая
  (function initTheme() {
    const saved = store.get("mantraTheme", null);
    if (saved) {
      applyTheme(saved === "dark");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme(true);
    } else {
      applyTheme(false);
    }
  })();

  // следим за системной темой
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        // только если пользователь не переключал вручную
        if (!store.get("mantraTheme", null)) applyTheme(e.matches);
      });
  }

  if (themeBtn) themeBtn.onclick = toggleTheme;

  /* ══════════════════════════════════════════════
     МАСШТАБ ШРИФТА
     ══════════════════════════════════════════════ */
  function getScale() {
    return parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--scale")
    ) || 1;
  }
  function setScale(v) {
    document.documentElement.style.setProperty(
      "--scale",
      Math.max(0.5, Math.min(v, 3))
    );
    fitMantra();
    fitIntro();
  }
  $("fInc").onclick = () => setScale(getScale() + 0.2);
  $("fDec").onclick = () => setScale(getScale() - 0.2);

  /* ── панель A± (появление при ховере) ── */
  let hideT, lastMove = 0;
  function showCtrl() {
    if (innerWidth < 1024) return;
    const now = performance.now();
    if (now - lastMove < 100) return;
    clearTimeout(hideT);
    fontCtrl.classList.add("active");
    lastMove = now;
    hideT = setTimeout(() => fontCtrl.classList.remove("active"), 4000);
  }
  triggerArea.onmousemove = showCtrl;
  fontCtrl.onmouseenter = () => { clearTimeout(hideT); fontCtrl.classList.add("active"); };
  fontCtrl.onmouseleave = () => { hideT = setTimeout(() => fontCtrl.classList.remove("active"), 4000); };
  if (innerWidth >= 1024) {
    fontCtrl.classList.add("active");
    setTimeout(() => fontCtrl.classList.remove("active"), 3000);
  }

  /* ══════════════════════════════════════════════
     КЛИКИ и КЛАВИАТУРА
     ══════════════════════════════════════════════ */
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".panel, .font-ctrl, #langSel, button")) toggleUserPause();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, button, [contenteditable='true']")) return;

    switch (true) {
      case e.code === "Space":
        e.preventDefault(); toggleUserPause(); break;
      case e.key === "+" || e.code === "NumpadAdd" || e.key === "=":
        e.preventDefault(); setScale(getScale() + 0.2); break;
      case e.key === "-" || e.code === "NumpadSubtract" || e.key === "_":
        e.preventDefault(); setScale(getScale() - 0.2); break;
      case e.key === "<" || (e.code === "Comma" && e.shiftKey):
        if (speed > 2) { speed -= 0.5; store.set("mantraSpeed", speed); setSpeed(true); } break;
      case e.key === ">" || (e.code === "Period" && e.shiftKey):
        if (speed < 9) { speed += 0.5; store.set("mantraSpeed", speed); setSpeed(true); } break;
      case e.key === "?" || (e.code === "Slash" && e.shiftKey):
        e.preventDefault(); toggleTheme(); break;
    }
  });

  /* ══════════════════════════════════════════════
     ПЕРЕВОДЫ
     ══════════════════════════════════════════════ */
  let tr = null;

  async function loadTranslations() {
    try {
      const r = await fetch("translations.json");
      tr = r.ok ? await r.json() : null;
    } catch { /* offline fallback */ }

    if (!tr) {
      tr = {
        ru: {
          maha:   "Харе Кришна Харе Кришна Кришна Кришна Харе Харе Харе Рама Харе Рама Рама Рама Харе Харе",
          pancha: "Джая Шри Кришна Чайтанья Прабху Нитьянанда Шри Адвайта Гададхара Шривасади Гаура Бхакта Вринда",
        },
      };
    }
    render(curLang);
  }

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  function render(lang) {
    lang = lang || "ru";
    const prevIntroHTML = intro.innerHTML;
    const rec      = tr[lang] || tr.ru;
    const mahaStr  = typeof rec === "string" ? rec : (rec.maha || tr.ru.maha);
    const panchaStr = typeof rec === "string" ? "" : (rec.pancha || tr.ru.pancha || "");

    /* МАХА-мантра */
    const words = mahaStr.trim().split(/\s+/);
    let ids = 0;
    const rowsHTML = [];

    for (let i = 0; i < words.length; i += 4) {
      const row = words.slice(i, i + 4).map((w) => {
        const iVar = (ids % 16) + 1;
        ids++;
        return '<span class="w" style="--i:' + iVar + '" data-i="' + iVar + '">' + w + '</span>';
      }).join(" ");
      rowsHTML.push("<div>" + row + "</div>");
    }

    waviy.innerHTML = rowsHTML.join("");
    hook();
    fitMantra();

    /* ПАНЧА */
    if (!panchaStr) return false;

    const ps = panchaStr.split(/\s+/).filter(Boolean);
    let rows = panchaStr.split(/\n+/).map((line) => line.trim()).filter(Boolean);

    if (rows.length <= 1) {
      const limits = [4, 2, 3, 4];
      rows = [];
      let r = 0, buf = [];
      for (let i = 0; i < ps.length; i++) {
        buf.push(ps[i]);
        if (buf.length === limits[r] || i === ps.length - 1) {
          rows.push(buf.join(" "));
          buf = [];
          r++;
          if (r >= limits.length) break;
        }
      }
    }

    const totalWords = ps.length || 1;
    const slot = introDuration / totalWords;
    let idx = 0;
    const makeLine = (line) =>
      line.split(/\s+/).map((w) => {
        const delay = (idx * slot).toFixed(3);
        idx++;
        return '<span class="w" style="animation-delay:' + delay + 's;animation-duration:' + introDuration + 's;">' + w + '</span>';
      }).join(" ");

    intro.innerHTML = rows.map((l) => "<div>" + makeLine(l) + "</div>").join("");
    fitIntro();
    return intro.innerHTML !== prevIntroHTML;
  }

  window.addEventListener("resize", () => {
    fitIntro();
    fitMantra();
  });
  window.addEventListener("orientationchange", () => {
    fitIntro();
    fitMantra();
  });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => {
    fitIntro();
    fitMantra();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      fitIntro();
      fitMantra();
    }).catch(() => {});
  }

  /* ── смена языка ── */
  langSel.onchange = (e) => {
    curLang = e.target.value;
    store.set("mantraLang", curLang);
    render(curLang);
    if (introVisible) restartIntroTimer();
  };

  /* ══════════════════════════════════════════════
     WAKE LOCK
     ══════════════════════════════════════════════ */
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    if (wakeLock || userPaused) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        if (!userPaused && document.visibilityState === "visible") acquireWakeLock();
      });
    } catch (err) {
      console.warn("WakeLock:", err);
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    try { if (wakeLock) await wakeLock.release(); } catch { /* noop */ }
    wakeLock = null;
  }

  /* ══════════════════════════════════════════════
     СТОРОЖ
     ══════════════════════════════════════════════ */
  function startGuard() {
    if (guardId) return;
    guardId = setInterval(() => {
      if (userPaused) return;
      const f = waviy.querySelector("#first");
      if (!f || (getComputedStyle(f).animationPlayState === "paused" && !introVisible)) {
        resetWave();
      }
    }, 5000);
  }

  function stopGuard() {
    clearInterval(guardId);
    guardId = null;
  }

  /* ══════════════════════════════════════════════
     РЕГИСТРАЦИЯ SERVICE WORKER (если есть)
     ══════════════════════════════════════════════ */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  /* ══════════════════════════════════════════════
     СТАРТ
     ══════════════════════════════════════════════ */
  loadTranslations();
  setSpeed(false);
  showIntro();
  startGuard();
  acquireWakeLock();

})();
