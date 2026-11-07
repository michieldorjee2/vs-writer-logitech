/*
 * Cross-document view transitions, the part that has to run before the first paint: written into
 * the <head> of both documents (index.html, home.html) by vite.config.ts, as a classic script, so
 * its listeners exist when the browser fires them. The styles are src/styles/view-transitions.css.
 *
 * pageswap   (the page you leave)
 *   - the search page names the row you are opening: its logo tile (vt-logo) and its name (vt-name)
 *   - and hands the photograph on screen to the page it opens (sessionStorage, `vt.scene`)
 *   - a page showing the search page's photograph hands it back as you return to Search
 *   - an account or person page scrolled past its hero morphs nothing: it would fly in from above
 * pagereveal (the page you arrive on)
 *   - marks the transition `from-search` or `to-search` (the photograph's rounded frame), and
 *     `carry-scene` when both pages show the same photograph: it then moves without a cross-fade
 *   - the search page names the row for the page you came back from
 *   - an account, person or offer page opened from the search page shows the search page's
 *     photograph in its hero (`vt-scene-carry`, --vt-scene): already loaded, so it is there for the
 *     first paint the morph lands on, and the photograph moves without a cross-fade (`carry-scene`)
 *   - at the crop the morph lands it at (--vt-scene-z): the search page's image of the photograph
 *     is its own crop, so the hero shows the photograph that close too, and the morph ends on the
 *     page exactly instead of jumping to the hero's own crop
 *   - a page skips its hero intro (`vt-in`): the hero arrives by the morph
 *   - and, opened from the search page with the booth rail open, makes the rail's room before the
 *     first paint (`vt-rail-room`, view-transitions.css), so the hero lands where it stays; the
 *     rail (FloatingSidebar.tsx, mounted later) slides into that room and takes it over
 *
 * And for the page's own start (src/lib/after-view-transition.ts): `window.__vtSettled`, settled
 * when the transition the page arrived by is over (at once when there is none). The app hydrates
 * after it; started during the morph, it cancelled the transition.
 *
 * Plain JavaScript, no imports: it runs as written. Does nothing in a browser without
 * cross-document view transitions.
 */
(function () {
  if (!('onpagereveal' in window)) return;
  var root = document.documentElement;
  var settle;
  window.__vtSettled = new Promise(function (resolve) {
    settle = resolve;
  });

  function pathOf(url) {
    try {
      return new URL(url, location.href).pathname.replace(/^\/+|\/+$/g, '');
    } catch (e) {
      return '';
    }
  }
  function isSearchPath(path) {
    return path === 'search';
  }
  function onSearchPage() {
    return isSearchPath(pathOf(location.href));
  }
  /* Whether the booth rail will open: FloatingSidebar.tsx's readRailCollapsed() (its RAIL_KEY and
     PHONE), and only on a desktop, where the page moves over for it (booth-rail.css). */
  function railOpens() {
    if (!/[?&]search(=|&|$)/.test(location.search)) return false;
    if (window.matchMedia && matchMedia('(max-width: 640px)').matches) return false;
    try {
      return localStorage.getItem('opti.booth.rail') !== 'collapsed';
    } catch (e) {
      return true;
    }
  }
  /* The photograph on the search page: the top layer that is in (a new one is laid over the last). */
  var SCENE_KEY = 'vt.scene';
  var BOX_KEY = 'vt.scene.box';
  var RAIL_KEY = 'vt.rail';
  function keepScene() {
    var imgs = document.querySelectorAll('.sh-scene__layer.is-in .sh-scene__img');
    var img = imgs[imgs.length - 1];
    var frame = document.querySelector('.sh-scene');
    try {
      if (img && (img.currentSrc || img.src)) sessionStorage.setItem(SCENE_KEY, img.currentSrc || img.src);
      else sessionStorage.removeItem(SCENE_KEY);
      /* And how the search page shows it: its frame, and the photograph's own size (sceneZoom). */
      var r = frame && img && img.naturalWidth ? frame.getBoundingClientRect() : null;
      if (r) sessionStorage.setItem(BOX_KEY, [r.width, r.height, img.naturalWidth, img.naturalHeight].join(' '));
      else sessionStorage.removeItem(BOX_KEY);
    } catch (e) {
      /* no storage: the page shows its own photograph */
    }
  }
  /* The search page's frame and photograph sizes, kept with the photograph (taken with it). */
  var sceneBox = null;
  /* Taken once: only an https address, or this site's own. */
  function takeScene() {
    var src = '';
    sceneBox = null;
    try {
      src = sessionStorage.getItem(SCENE_KEY) || '';
      sessionStorage.removeItem(SCENE_KEY);
      var box = (sessionStorage.getItem(BOX_KEY) || '').split(' ').map(Number);
      sessionStorage.removeItem(BOX_KEY);
      if (box.length === 4 && box.every(function (n) { return n > 0 && isFinite(n); })) sceneBox = box;
    } catch (e) {
      return '';
    }
    if (!src) return '';
    try {
      var u = new URL(src, location.href);
      if (u.protocol !== 'https:' && u.origin !== location.origin) return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }
  function cssUrl(href) {
    return 'url("' + href.replace(/["\\\s]/g, encodeURIComponent) + '")';
  }
  /*
   * How much closer the hero shows the carried photograph, so the morph lands on it exactly.
   *
   * The photograph that moves is the search page's image of it (view-transitions.css,
   * vt-scene-square): its frame's crop, laid over the hero's photograph box (the <picture>,
   * 12% taller than its frame, www.css) to cover it. The search frame is wider than a 3:2
   * photograph, so its crop shows less of the photograph's height than the hero's own does, and
   * the image the morph ends on was some 8% (a wide window: 20%) closer than the page under it,
   * which jumped as the transition ended. The hero draws the photograph that much closer instead:
   * the scale the image lands at over the hero's scale. Both crops are centred, so the scale is all.
   */
  function sceneZoom(box) {
    var pic = box && document.querySelector('.www-page .www-hero__visual picture');
    var p = pic && pic.getBoundingClientRect();
    if (!p || !p.width || !p.height) return 0;
    var fw = box[0], fh = box[1], nw = box[2], nh = box[3];
    var search = Math.max(fw / nw, fh / nh); // the search page's photograph, covering its frame
    var image = Math.max(p.width / fw, p.height / fh); // its image of it, covering the hero's box
    var hero = Math.max(p.width / nw, p.height / nh); // the hero's own, covering the same box
    var z = (search * image) / hero;
    return isFinite(z) && z > 1.001 && z < 4 ? z : 0;
  }
  /* The photograph this page shows in its hero, the search page's (kept to hand it back). */
  var carried = '';
  /* Back on the search page: is it showing that photograph, loaded? */
  function showsScene(href) {
    var imgs = document.querySelectorAll('.sh-scene__layer.is-in .sh-scene__img');
    var img = imgs[imgs.length - 1];
    if (!href || !img || !img.complete || !img.naturalWidth) return false;
    try {
      return new URL(img.currentSrc || img.src, location.href).href === href;
    } catch (e) {
      return false;
    }
  }

  /* The search page's rows carry their page's route in data-vt-slug ("cdw", "logitech/ben-yu"). */
  function clearRow() {
    var named = document.querySelectorAll('[data-vt-named]');
    for (var i = 0; i < named.length; i++) {
      named[i].style.viewTransitionName = '';
      named[i].removeAttribute('data-vt-named');
    }
  }
  function nameRow(slug) {
    clearRow();
    if (!slug) return;
    var rows = document.querySelectorAll('[data-vt-slug]');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-vt-slug') !== slug) continue;
      var parts = [
        ['.sh-tile', 'vt-logo'],
        ['.sh-row__name', 'vt-name'],
      ];
      for (var j = 0; j < parts.length; j++) {
        var el = rows[i].querySelector(parts[j][0]);
        if (!el) continue;
        el.style.viewTransitionName = parts[j][1];
        el.setAttribute('data-vt-named', '');
      }
      return;
    }
  }

  addEventListener('pageswap', function (e) {
    var to = e.activation && e.activation.entry ? pathOf(e.activation.entry.url) : '';
    if (onSearchPage()) {
      keepScene();
      if (e.viewTransition) nameRow(to);
      return;
    }
    if (isSearchPath(to)) {
      try {
        if (carried) sessionStorage.setItem(SCENE_KEY, carried);
        /* The rail open: the frame starts from its rounded corner on the way back. */
        if (root.classList.contains('booth-page--rail')) sessionStorage.setItem(RAIL_KEY, '1');
      } catch (err) {
        /* the photograph cross-fades back instead */
      }
    }
    if (!e.viewTransition) return;
    var hero = document.getElementById('hero');
    if (hero && hero.getBoundingClientRect().bottom < innerHeight * 0.3) root.classList.add('vt-far');
  });

  addEventListener('pagereveal', function (e) {
    if (e.viewTransition) e.viewTransition.finished.then(settle, settle);
    else settle();
    root.classList.remove('vt-far');
    var nav = window.navigation;
    var from = nav && nav.activation && nav.activation.from ? pathOf(nav.activation.from.url) : '';
    /* The search page's photograph, with or without a transition (reduced motion still gets it). */
    var scene = !onSearchPage() && isSearchPath(from) ? takeScene() : '';
    if (scene) {
      carried = scene;
      root.style.setProperty('--vt-scene', cssUrl(scene));
      root.classList.add('vt-scene-carry');
    }
    /* Back on the search page, the photograph the page showed: the same one? And its rail? */
    var back = onSearchPage() ? takeScene() : '';
    if (onSearchPage()) {
      try {
        if (sessionStorage.getItem(RAIL_KEY)) root.style.setProperty('--vt-frame-r', '20px 0 0 0');
        else root.style.removeProperty('--vt-frame-r');
        sessionStorage.removeItem(RAIL_KEY);
      } catch (err) {
        /* square corners: the page without its rail */
      }
    }
    if (!e.viewTransition) return;
    var types = e.viewTransition.types;
    if (onSearchPage()) {
      if (types) types.add('to-search');
      if (types && showsScene(back)) types.add('carry-scene');
      nameRow(from);
      e.viewTransition.finished.then(clearRow, clearRow);
      return;
    }
    if (isSearchPath(from)) {
      if (types) types.add('from-search');
      if (types && scene) types.add('carry-scene');
      if (railOpens()) {
        root.classList.add('vt-rail-room');
        /* The rail's ground, there before the rail itself (it mounts after the morph): it slides
           in with the frame's left edge, and the rail slides over it (src/lib/rail-room.ts). */
        var shell = document.createElement('div');
        shell.className = 'vt-rail-shell';
        shell.setAttribute('aria-hidden', 'true');
        (document.body || root).appendChild(shell);
        root.style.setProperty('--vt-frame-r', '20px 0 0 0');
      }
    }
    root.classList.add('vt-in');
    /* Measured with the rail's room made and the hero's intro off: the hero as the morph ends. */
    var z = scene && isSearchPath(from) ? sceneZoom(sceneBox) : 0;
    if (z) root.style.setProperty('--vt-scene-z', z.toFixed(4));
  });
})();
