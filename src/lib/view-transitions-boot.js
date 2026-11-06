/*
 * Cross-document view transitions, the part that has to run before the first paint: written into
 * the <head> of both documents (index.html, home.html) by vite.config.ts, as a classic script, so
 * its listeners exist when the browser fires them. The styles are src/styles/view-transitions.css.
 *
 * pageswap   (the page you leave)
 *   - the search page names the row you are opening: its logo tile (vt-logo) and its name (vt-name)
 *   - an account or person page scrolled past its hero morphs nothing: it would fly in from above
 * pagereveal (the page you arrive on)
 *   - marks the transition `from-search` or `to-search` (the photograph's rounded frame)
 *   - the search page names the row for the page you came back from
 *   - an account or person page skips its hero intro (`vt-in`): the hero arrives by the morph
 *
 * Plain JavaScript, no imports: it runs as written. Does nothing in a browser without
 * cross-document view transitions.
 */
(function () {
  if (!('onpagereveal' in window)) return;
  var root = document.documentElement;

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
    if (!e.viewTransition) return;
    var to = e.activation && e.activation.entry ? pathOf(e.activation.entry.url) : '';
    if (onSearchPage()) {
      nameRow(to);
      return;
    }
    var hero = document.getElementById('hero');
    if (hero && hero.getBoundingClientRect().bottom < innerHeight * 0.3) root.classList.add('vt-far');
  });

  addEventListener('pagereveal', function (e) {
    root.classList.remove('vt-far');
    if (!e.viewTransition) return;
    var nav = window.navigation;
    var from = nav && nav.activation && nav.activation.from ? pathOf(nav.activation.from.url) : '';
    var types = e.viewTransition.types;
    if (onSearchPage()) {
      if (types) types.add('to-search');
      nameRow(from);
      e.viewTransition.finished.then(clearRow, clearRow);
      return;
    }
    if (types && isSearchPath(from)) types.add('from-search');
    root.classList.add('vt-in');
  });
})();
