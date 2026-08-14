(function () {
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');

  navToggle.addEventListener('click', function () {
    var open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  siteNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Highlight active section in nav on scroll
  var sections = Array.prototype.slice.call(document.querySelectorAll('.menu-section'));
  var navLinks = Array.prototype.slice.call(siteNav.querySelectorAll('a'));

  function onScroll() {
    var scrollPos = window.scrollY + 110;
    var current = sections[0];
    sections.forEach(function (sec) {
      if (sec.offsetTop <= scrollPos) current = sec;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current.id);
    });

    var backToTop = document.getElementById('backToTop');
    backToTop.classList.toggle('visible', window.scrollY > 500);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Search filter
  var searchInput = document.getElementById('menuSearch');
  var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.group-title'));
  var noResults = document.getElementById('noResults');

  searchInput.addEventListener('input', function () {
    var query = searchInput.value.trim().toLowerCase();
    var anyVisible = false;

    items.forEach(function (item) {
      var text = item.textContent.toLowerCase();
      var match = query === '' || text.indexOf(query) !== -1;
      item.classList.toggle('hidden', !match);
      if (match) anyVisible = true;
    });

    // Hide group titles/notes with no visible items
    groups.forEach(function (group) {
      var el = group.nextElementSibling;
      var hasVisible = false;
      while (el && !el.classList.contains('group-title')) {
        if (el.classList.contains('group-note')) {
          el.classList.toggle('hidden', query !== '');
        }
        if (el.classList.contains('menu-list')) {
          hasVisible = el.querySelectorAll('.item:not(.hidden)').length > 0;
        }
        el = el.nextElementSibling;
      }
      group.classList.toggle('hidden', query !== '' && !hasVisible);
    });

    noResults.classList.toggle('hidden', anyVisible);
  });
})();
