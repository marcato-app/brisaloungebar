(function () {
  var PHOTO_AFTER = {
    drinks: { src: 'assets/img/branded-cup.jpg', alt: 'Copo personalizado Brisa Lounge Bar' },
    comidas: { src: 'assets/img/venue-night.jpg', alt: 'Ambiente do Brisa Lounge Bar à noite' }
  };

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderItem(item, group, section) {
    var li = el('li', 'item');
    var row = el('div', 'item-row');
    var nameHtml = item.name + (item.unit ? ' <span class="unit">' + item.unit + '</span>' : '');
    row.appendChild(el('span', 'item-name', nameHtml));
    row.appendChild(el('span', 'item-price', item.price));
    li.appendChild(row);
    if (item.note) li.appendChild(el('p', 'item-note', item.note));

    // Hidden search index: catches category searches ("cerveja", "whisky")
    // when the item itself is only listed by brand name.
    var searchParts = [
      item.name, item.unit, item.note, item.tags,
      group.title, group.unit, group.keywords,
      section.title
    ].filter(Boolean);
    li.dataset.search = searchParts.join(' ').toLowerCase();

    return li;
  }

  function renderGroup(group, section) {
    var frag = document.createDocumentFragment();
    var titleHtml = group.title + (group.unit ? ' <span class="unit">' + group.unit + '</span>' : '');
    frag.appendChild(el('h3', 'group-title', titleHtml));
    if (group.note) frag.appendChild(el('p', 'group-note', group.note));
    var list = el('ul', 'menu-list');
    (group.items || []).forEach(function (item) { list.appendChild(renderItem(item, group, section)); });
    frag.appendChild(list);
    return frag;
  }

  function renderSection(section) {
    var sec = el('section', 'menu-section');
    sec.id = section.id;
    sec.appendChild(el('h2', 'section-title', section.title));
    (section.groups || []).forEach(function (group) {
      sec.appendChild(renderGroup(group, section));
    });
    return sec;
  }

  function renderPhoto(id) {
    var photo = PHOTO_AFTER[id];
    if (!photo) return null;
    var wrap = el('div', 'section-photo');
    var img = el('img');
    img.src = photo.src;
    img.alt = photo.alt;
    img.loading = 'lazy';
    wrap.appendChild(img);
    return wrap;
  }

  function renderMenu(data) {
    var root = document.getElementById('menuRoot');
    root.classList.remove('loading');
    root.innerHTML = '';
    (data.sections || []).forEach(function (section) {
      root.appendChild(renderSection(section));
      var photo = renderPhoto(section.id);
      if (photo) root.appendChild(photo);
    });
  }

  function renderError() {
    var root = document.getElementById('menuRoot');
    root.classList.remove('loading');
    root.innerHTML = '<p class="loading-msg">Não foi possível carregar o cardápio agora. Recarregue a página.</p>';
  }

  // A capa se apaga sozinha pelo CSS. Aqui só tratamos o toque para pular e
  // a regra de mostrar uma vez por visita, para quem é do lugar não assistir
  // à abertura a cada consulta ao cardápio.
  function welcome() {
    var cover = document.getElementById('welcome');
    if (!cover) return;

    var quieter = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = sessionStorage.getItem('brisaBoasVindas') === '1'; } catch (e) {}

    if (quieter || seen) {
      cover.parentNode.removeChild(cover);
      return;
    }

    try { sessionStorage.setItem('brisaBoasVindas', '1'); } catch (e) {}
    document.body.classList.add('welcoming');

    var close = function () {
      document.body.classList.remove('welcoming');
      cover.classList.add('gone');
      setTimeout(function () {
        if (cover.parentNode) cover.parentNode.removeChild(cover);
      }, 600);
    };

    cover.addEventListener('click', close);
    setTimeout(close, 2150);
  }

  welcome();

  function init() {
    var siteNav = document.getElementById('siteNav');
    var navLinks = Array.prototype.slice.call(siteNav.querySelectorAll('a'));
    var backToTop = document.getElementById('backToTop');

    function onScroll() {
      var sections = Array.prototype.slice.call(document.querySelectorAll('.menu-section'));
      if (sections.length) {
        var scrollPos = window.scrollY + 110;
        var current = sections[0];
        sections.forEach(function (sec) {
          if (sec.offsetTop <= scrollPos) current = sec;
        });
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + current.id);
        });
      }
      backToTop.classList.toggle('visible', window.scrollY > 500);
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    var searchInput = document.getElementById('menuSearch');
    var noResults = document.getElementById('noResults');

    searchInput.addEventListener('input', function () {
      var query = searchInput.value.trim().toLowerCase();
      var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
      var groups = Array.prototype.slice.call(document.querySelectorAll('.group-title'));
      var sections = Array.prototype.slice.call(document.querySelectorAll('.menu-section'));
      var anyVisible = false;

      items.forEach(function (item) {
        var text = item.dataset.search || item.textContent.toLowerCase();
        var match = query === '' || text.indexOf(query) !== -1;
        item.classList.toggle('hidden', !match);
        if (match) anyVisible = true;
      });

      groups.forEach(function (group) {
        var e = group.nextElementSibling;
        var hasVisible = false;
        while (e && !e.classList.contains('group-title')) {
          if (e.classList.contains('group-note')) {
            e.classList.toggle('hidden', query !== '');
          }
          if (e.classList.contains('menu-list')) {
            hasVisible = e.querySelectorAll('.item:not(.hidden)').length > 0;
          }
          e = e.nextElementSibling;
        }
        group.classList.toggle('hidden', query !== '' && !hasVisible);
      });

      sections.forEach(function (section) {
        var hasVisible = section.querySelectorAll('.item:not(.hidden)').length > 0;
        var hide = query !== '' && !hasVisible;
        section.classList.toggle('hidden', hide);
        var photo = section.nextElementSibling;
        if (photo && photo.classList.contains('section-photo')) {
          photo.classList.toggle('hidden', query !== '');
        }
      });

      noResults.classList.toggle('hidden', anyVisible);
    });

    fetch('/api/menu')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load menu');
        return res.json();
      })
      .then(function (data) {
        renderMenu(data);
        onScroll();
      })
      .catch(renderError);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
