/*!
 * Scalefield Analytics — универсальный трекер просмотров страниц.
 *
 * Аналог Vercel Web Analytics, но не привязан ни к фреймворку, ни к прокси:
 * одна строка на любом сайте (Next.js, Vue, Svelte, обычный HTML) —
 *
 *   <script defer src="https://scalefield.uz/script.js" data-site="my-project"></script>
 *
 *  - data-site     — слаг проекта в Scalefield. Без него проект узнаётся по
 *                    домену страницы (если домен заведён в сервисах проекта).
 *  - data-exclude  — пути, которые не считать, через запятую; `*` — любой
 *                    кусок пути внутри сегмента, `**` — любой хвост:
 *                    data-exclude="/admin/**,/*\/admin/**".
 *  - data-endpoint — свой адрес приёмника; по умолчанию `<origin скрипта>/api/collect`.
 *
 * Считает первую загрузку и клиентские переходы SPA (history.pushState /
 * replaceState / «назад»). Шлёт только путь без query (в query бывают токены
 * и персональные данные) и referrer. Cookie и localStorage не использует;
 * уникальность посетителя считает сервер по необратимому хешу.
 */
(function () {
  "use strict";
  var w = window;
  var d = document;
  var script = d.currentScript;
  if (!script || w.__scalefieldAnalytics) return;
  w.__scalefieldAnalytics = true;

  var loc = w.location;
  // Локальная разработка и автоматизированные браузеры — не аудитория.
  if (/^(localhost|127\.|\[?::1\]?$)/.test(loc.hostname) && !script.hasAttribute("data-debug")) return;
  if (navigator.webdriver) return;

  var endpoint = script.getAttribute("data-endpoint");
  if (!endpoint) {
    try {
      endpoint = new URL(script.src).origin + "/api/collect";
    } catch {
      return;
    }
  }
  var site = script.getAttribute("data-site") || null;
  var exclude = (script.getAttribute("data-exclude") || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean)
    .map(function (glob) {
      var re = glob
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, ".*");
      return new RegExp("^" + re + "$");
    });

  var lastPath = null;
  var lastUrl = d.referrer || null;

  function excluded(path) {
    for (var i = 0; i < exclude.length; i++) if (exclude[i].test(path)) return true;
    return false;
  }

  function send() {
    var path = loc.pathname;
    // replaceState часто меняет только query или хеш — это не новый просмотр.
    if (path === lastPath) return;
    lastPath = path;
    // Исключённая страница не уходит никуда — даже referrer'ом следующей.
    if (excluded(path)) return;
    var referrer = lastUrl;
    // Без query и хеша — по той же причине, что и путь.
    lastUrl = loc.href.split(/[?#]/)[0];

    var body = JSON.stringify({ site: site, path: path, referrer: referrer });
    // text/plain — «простой» запрос без CORS-preflight; sendBeacon не теряет
    // событие при закрытии вкладки.
    var sent = false;
    try {
      sent = !!navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }));
    } catch {
      sent = false;
    }
    if (!sent && w.fetch) {
      w.fetch(endpoint, { method: "POST", body: body, keepalive: true, mode: "cors" }).catch(function () {});
    }
  }

  function patch(method) {
    var original = history[method];
    if (typeof original !== "function") return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      // Роутеры меняют URL до перерисовки — отправляем после текущего такта.
      setTimeout(send, 0);
      return result;
    };
  }
  patch("pushState");
  patch("replaceState");
  w.addEventListener("popstate", send);

  // Страница, открытая в фоне (предзагрузка вкладки), считается, когда её покажут.
  if (d.visibilityState === "prerender") {
    d.addEventListener("visibilitychange", function onShow() {
      if (d.visibilityState === "visible") {
        d.removeEventListener("visibilitychange", onShow);
        send();
      }
    });
  } else {
    send();
  }
})();
