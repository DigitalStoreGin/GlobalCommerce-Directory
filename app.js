/* ═══════════════════════════════════════════════════════════════════
   GlobalCommerce Intelligence — Main Application
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────── DATA AGGREGATION ── */
  var DATA = window.GC_DATA || {};
  var ALL_SITES = [].concat(
    DATA.europe   || [],
    DATA.asia     || [],
    DATA.americas || [],
    DATA.africa_me|| [],
    DATA.oceania  || []
  );
  var DIGITAL = DATA.digital || [];
  var ALL_WITH_DIGITAL = ALL_SITES.concat(DIGITAL);

  /* Continent meta */
  var CONTINENT_META = {
    'Europe':              { emoji: '🇪🇺', label: 'Châu Âu',         color: '#0B5FFF' },
    'Asia':                { emoji: '🌏', label: 'Châu Á',          color: '#16A34A' },
    'North America':       { emoji: '🌎', label: 'Bắc Mỹ',          color: '#D97706' },
    'South America':       { emoji: '🌎', label: 'Nam Mỹ',          color: '#EA580C' },
    'Americas':            { emoji: '🌎', label: 'Châu Mỹ',         color: '#D97706' },
    'Africa':              { emoji: '🌍', label: 'Châu Phi',        color: '#DC2626' },
    'Middle East':         { emoji: '🕌', label: 'Trung Đông',      color: '#7C3AED' },
    'Oceania':             { emoji: '🌊', label: 'Châu Đại Dương', color: '#DB2777' },
    'Africa & Middle East':{ emoji: '🌍', label: 'Phi & Trung Đông', color: '#DC2626' },
    'Digital':             { emoji: '💻', label: 'Digital',         color: '#0284C7' }
  };

  /* EU member states (27, as of 2026) */
  var EU_COUNTRIES = [
    'Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Czechia',
    'Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland',
    'Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland',
    'Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'
  ];
  var EU_SET = {};
  EU_COUNTRIES.forEach(function (c) { EU_SET[c.toLowerCase()] = 1; });
  function isEU(country) {
    return !!(country && EU_SET[String(country).toLowerCase()]);
  }

  /* Type name display */
  var TYPE_NAMES = {
    'marketplace':            'Marketplace',
    'classified':             'Classified',
    'retail':                 'Retail',
    'secondhand':             'Secondhand',
    'fashion':                'Fashion',
    'auction':                'Auction',
    'general':                'General',
    'digital-marketplace':    'Digital MP',
    'key-marketplace':        'Key MP',
    'creative-marketplace':   'Creative MP',
    'publishing':             'Publishing',
    'saas-platform':          'SaaS',
    'privacy-selling':        'Privacy',
    'freelance':              'Freelance'
  };

  /* App state */
  var state = {
    route: 'overview',
    filtered: ALL_SITES.slice(),
    sortKey: 'traffic-desc',
    viewMode: 'table',
    page: 1,
    pageSize: 25,
    search: '',
    chartContinent: null,
    chartMode: 'traffic'
  };

  /* ─────────────────────────────────────────── HELPERS ─────────── */
  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /* Safely encode a JS object as JSON for use inside an HTML attribute value.
     esc() only encodes <, >, & — it does NOT encode " — so bare JSON breaks
     HTML attribute parsing the moment the first key/value appears.
     This function additionally encodes " → &quot; so the attribute stays valid. */
  function jsonAttr(obj) {
    return JSON.stringify(obj)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function parseTraffic(str) {
    if (!str) return 0;
    str = String(str).replace(/[~,]/g, '').trim();
    var m = str.match(/([\d.]+)\s*(B|M|K)?/i);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    var u = (m[2] || '').toUpperCase();
    if (u === 'B') return n * 1e9;
    if (u === 'M') return n * 1e6;
    if (u === 'K') return n * 1e3;
    return n;
  }

  function parseFeeNum(str) {
    if (!str) return Infinity;
    var s = String(str).toUpperCase();
    if (s === 'FREE' || s === '0%' || s.indexOf('FREE') >= 0 || s.indexOf('MIỄN PHÍ') >= 0) return 0;
    var m = s.match(/([\d.]+)\s*%/);
    return m ? parseFloat(m[1]) : Infinity;
  }

  function formatTraffic(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(Math.round(n));
  }

  function badgeClass(t) {
    if (!t) return 'badge';
    return 'badge badge-' + String(t).toLowerCase().replace(/[\s/]+/g, '-');
  }

  function typeName(t) {
    return TYPE_NAMES[t] || t || '—';
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /* Format number with dots: 1000000 → "1.000.000" */
  function formatNumVN(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    return String(Math.floor(Math.abs(Number(n)))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  /* Strip dots and parse: "1.000.000" → 1000000 */
  function parseNumVN(str) {
    if (!str) return 0;
    var digits = String(str).replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }
  /* 1000000 → "1 triệu" */
  function humanShort(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + ' tỷ';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + ' triệu';
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + ' nghìn';
    return String(n);
  }

  /* ─────────────────────────────────────────── ROUTER ──────────── */
  function navigate(route) {
    if (!route || route === state.route) {
      // still highlight if first time
    }
    state.route = route;
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var target = $('#view-' + route);
    if (target) target.classList.add('active');

    $$('.side-link').forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-route') === route);
    });

    // Close sidebar on mobile
    closeSidebar();

    // Render route-specific
    if (route === 'overview') renderOverview();
    if (route === 'directory') renderDirectory();
    if (route === 'analytics') renderAnalyticsCharts();
    if (route === 'digital') renderDigital();
    if (route === 'continents') renderContinents();
    if (route === 'favorites') renderFavorites();

    // Scroll to top of content
    var content = $('#mainContent');
    if (content) content.scrollTo ? content.scrollTo({ top: 0, behavior: 'smooth' }) : window.scrollTo(0, 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─────────────────────────────────────────── SIDEBAR (MOBILE) ── */
  function openSidebar() {
    $('#sidebar').classList.add('is-open');
    $('#appOverlay').classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('is-open');
    $('#appOverlay').classList.remove('is-active');
    document.body.style.overflow = '';
  }

  /* ─────────────────────────────────────────── OVERVIEW ─────────── */
  function renderOverview() {
    // KPI
    var uniqCountries = {}, uniqTypes = {}, totalTraffic = 0;
    ALL_SITES.forEach(function (s) {
      if (s.c) uniqCountries[s.c] = 1;
      if (s.t) uniqTypes[s.t] = 1;
      totalTraffic += parseTraffic(s.traffic);
    });
    var nCountries = Object.keys(uniqCountries).length;
    var nTypes = Object.keys(uniqTypes).length;

    $('#kpiPlatforms').textContent = ALL_SITES.length.toLocaleString();
    $('#kpiCountries').textContent = nCountries.toLocaleString();
    $('#kpiTraffic').textContent = formatTraffic(totalTraffic) + '/mo';
    $('#kpiTypes').textContent = nTypes;

    $('#phPlatforms').textContent = ALL_SITES.length.toLocaleString();
    $('#sfPlatforms').textContent = ALL_SITES.length.toLocaleString();
    $('#sfCountries').textContent = nCountries.toLocaleString() + '+';
    $('#navDirCount').textContent = ALL_SITES.length.toLocaleString();
    $('#phDirCount').textContent = ALL_SITES.length.toLocaleString();

    // Sparklines
    drawSparklines();

    // Top platforms
    renderTopPlatforms();

    // Continent chart
    renderContinentChart();

    // Type bars
    renderTypeBars();

    // Overview continent cards
    renderOverviewContinents();
  }

  function renderTopPlatforms() {
    var top = ALL_WITH_DIGITAL.slice().sort(function (a, b) {
      return parseTraffic(b.traffic) - parseTraffic(a.traffic);
    }).slice(0, 20);

    var html = top.map(function (s, i) {
      var rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      return '<tr>'
        + '<td><span class="rank ' + rc + '">' + (i + 1) + '</span></td>'
        + '<td><div class="site-cell">'
        + '<span class="site-name">' + esc(s.n) + '</span>'
        + '<a class="site-url" href="https://' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.url) + '</a>'
        + '</div></td>'
        + '<td class="hide-sm"><span class="country-cell"><span class="flag">' + (s.f || '') + '</span>' + esc(s.c || '—') + '</span></td>'
        + '<td><span class="traffic-val">' + esc(s.traffic || '—') + '</span></td>'
        + '<td class="hide-sm"><span class="' + badgeClass(s.t) + '">' + esc(typeName(s.t)) + '</span></td>'
        + '<td class="hide-md"><span class="fee-val">' + esc(s.fee || '—') + '</span></td>'
        + '</tr>';
    }).join('');
    $('#topBody').innerHTML = html;
  }

  function renderTypeBars() {
    var counts = {};
    ALL_SITES.forEach(function (s) {
      if (!s.t) return;
      counts[s.t] = (counts[s.t] || 0) + 1;
    });
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 8);

    var max = entries.length ? entries[0][1] : 1;
    var palette = ['#0B5FFF', '#16A34A', '#D97706', '#8B5CF6', '#EC4899', '#0284C7', '#DC2626', '#475569'];

    var html = entries.map(function (e, i) {
      var pct = (e[1] / max * 100).toFixed(1);
      var color = palette[i % palette.length];
      return '<div class="bar">'
        + '<div class="bar-row"><span>' + esc(typeName(e[0])) + '</span><span>' + e[1] + '</span></div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
        + '</div>';
    }).join('');
    $('#typeBars').innerHTML = html;
  }

  function renderOverviewContinents() {
    var container = $('#overviewContinents');
    if (!container) return;
    var groups = {};
    ALL_SITES.forEach(function (s) {
      var g = s.g || 'Other';
      if (!groups[g]) groups[g] = { sites: 0, countries: {}, top: [] };
      groups[g].sites++;
      if (s.c) groups[g].countries[s.c] = 1;
    });

    // Get top per continent
    Object.keys(groups).forEach(function (g) {
      var top = ALL_SITES.filter(function (s) { return s.g === g; })
        .sort(function (a, b) { return parseTraffic(b.traffic) - parseTraffic(a.traffic); })
        .slice(0, 3)
        .map(function (s) { return s.n; });
      groups[g].top = top;
    });

    var html = Object.keys(groups).sort().map(function (g) {
      var meta = CONTINENT_META[g] || { emoji: '🌐', label: g, color: '#0B5FFF' };
      var info = groups[g];
      return '<a class="continent-card" href="#" data-continent="' + esc(g) + '" style="--cc-color:' + meta.color + '">'
        + '<div class="cc-emoji">' + meta.emoji + '</div>'
        + '<div class="cc-title">' + esc(meta.label) + '</div>'
        + '<div class="cc-region">' + esc(g) + '</div>'
        + '<div class="cc-stats">'
        + '<div class="cc-stat"><span class="n">' + info.sites + '</span><span class="l">Sàn</span></div>'
        + '<div class="cc-stat"><span class="n">' + Object.keys(info.countries).length + '</span><span class="l">Quốc gia</span></div>'
        + '</div>'
        + '<div class="cc-top">Top: <strong>' + esc(info.top.join(' · ')) + '</strong></div>'
        + '<div class="cc-cta">Xem danh mục →</div>'
        + '</a>';
    }).join('');
    container.innerHTML = html;
  }

  function drawSparklines() {
    $$('.kpi-spark').forEach(function (el) {
      var raw = el.getAttribute('data-spark') || '';
      var vals = raw.split(',').map(function (v) { return parseFloat(v) || 0; });
      if (!vals.length) return;
      var max = Math.max.apply(null, vals);
      var min = Math.min.apply(null, vals);
      var range = max - min || 1;
      var w = 200, h = 32;
      var step = w / (vals.length - 1);
      var pts = vals.map(function (v, i) {
        var x = i * step;
        var y = h - ((v - min) / range) * h;
        return x + ',' + y.toFixed(1);
      }).join(' ');
      var lastX = (vals.length - 1) * step;
      var lastY = h - ((vals[vals.length - 1] - min) / range) * h;
      var color = getComputedStyle(el.closest('.kpi')).getPropertyValue('color').trim() || '#0B5FFF';
      // Use brand color from CSS
      var tone = el.closest('.kpi').getAttribute('data-tone') || 'primary';
      var toneColors = {
        primary: '#0B5FFF',
        success: '#16A34A',
        warning: '#D97706',
        info: '#0284C7'
      };
      color = toneColors[tone] || '#0B5FFF';
      el.innerHTML = '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">'
        + '<defs><linearGradient id="spk-' + tone + '" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="' + color + '" stop-opacity=".25"/>'
        + '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>'
        + '</linearGradient></defs>'
        + '<polygon points="0,' + h + ' ' + pts + ' ' + w + ',' + h + '" fill="url(#spk-' + tone + ')"/>'
        + '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="' + lastX + '" cy="' + lastY + '" r="2.6" fill="' + color + '"/>'
        + '</svg>';
    });
  }

  function renderContinentChart() {
    var canvas = $('#continentChart');
    if (!canvas || typeof Chart === 'undefined') return;

    var continentData = {};
    ALL_SITES.forEach(function (s) {
      var g = s.g || 'Other';
      if (!continentData[g]) continentData[g] = { traffic: 0, count: 0 };
      continentData[g].traffic += parseTraffic(s.traffic);
      continentData[g].count++;
    });

    var labels = Object.keys(continentData).sort(function (a, b) {
      return continentData[b].traffic - continentData[a].traffic;
    });
    var mode = state.chartMode;
    var values = labels.map(function (l) {
      return mode === 'traffic' ? continentData[l].traffic : continentData[l].count;
    });
    var displayLabels = labels.map(function (l) { return (CONTINENT_META[l] || {}).label || l; });
    var colors = labels.map(function (l) { return (CONTINENT_META[l] || {}).color || '#0B5FFF'; });

    var cs = getComputedStyle(document.documentElement);
    var fg = cs.getPropertyValue('--fg-mute').trim() || '#475569';
    var grid = cs.getPropertyValue('--border-soft').trim() || '#E2E8F0';

    if (state.chartContinent) state.chartContinent.destroy();
    state.chartContinent = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: displayLabels,
        datasets: [{
          label: mode === 'traffic' ? 'Tổng traffic/tháng' : 'Số sàn',
          data: values,
          backgroundColor: colors.map(function (c) { return c + '99'; }),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 60
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            padding: 12,
            titleFont: { weight: '600', size: 13 },
            bodyFont: { size: 12.5 },
            callbacks: {
              label: function (ctx) {
                if (mode === 'traffic') return ' ' + formatTraffic(ctx.parsed.y) + '/mo';
                return ' ' + ctx.parsed.y + ' sàn';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: fg, font: { size: 11.5, weight: '500' } },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: fg,
              font: { size: 11 },
              callback: function (v) { return mode === 'traffic' ? formatTraffic(v) : v; }
            },
            grid: { color: grid, drawBorder: false }
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });
  }

  function renderAnalyticsCharts() {
    // Already mostly static. Re-render the continent chart if visible.
    // (no analytics-only chart here, can be extended)
  }

  /* ─────────────────────────────────────────── DIRECTORY ────────── */
  function populateFilters() {
    var continents = {}, countries = {}, types = {}, regions = {};
    ALL_SITES.forEach(function (s) {
      if (s.g) continents[s.g] = 1;
      if (s.c) countries[s.c] = 1;
      if (s.t) types[s.t] = 1;
      if (s.r) regions[s.r] = 1;
    });

    fillSelect('fltContinent', Object.keys(continents).sort());
    fillSelect('fltCountry', Object.keys(countries).sort());
    fillSelect('fltType', Object.keys(types).sort().map(function (t) { return { v: t, l: typeName(t) }; }));
    fillSelect('fltRegion', Object.keys(regions).sort());
  }

  function fillSelect(id, items) {
    var el = $('#' + id);
    if (!el) return;
    // keep first option "Tất cả"
    var first = el.firstElementChild ? el.firstElementChild.outerHTML : '<option value="">Tất cả</option>';
    var rest = items.map(function (it) {
      var v = typeof it === 'string' ? it : it.v;
      var l = typeof it === 'string' ? it : it.l;
      return '<option value="' + esc(v) + '">' + esc(l) + '</option>';
    }).join('');
    el.innerHTML = first + rest;
  }

  function getFilterValues() {
    var trafficSel = $('#fltTraffic').value;
    var minTraffic = 0;
    if (trafficSel === 'custom') {
      minTraffic = parseNumVN($('#fltTrafficCustom').value);
    } else if (trafficSel) {
      minTraffic = parseFloat(trafficSel) || 0;
    }
    var feeSel = $('#fltFee').value;
    var maxFee = Infinity;
    if (feeSel === 'custom') {
      var cv = $('#fltFeeCustom').value;
      if (cv !== '') maxFee = parseFloat(cv);
    } else if (feeSel !== '') {
      maxFee = parseFloat(feeSel);
    }
    return {
      q: ($('#dirSearch').value || '').toLowerCase().trim(),
      continent: $('#fltContinent').value,
      country: $('#fltCountry').value,
      type: $('#fltType').value,
      region: $('#fltRegion').value,
      eu: ($('#fltEU') ? $('#fltEU').value : ''),
      trafficSel: trafficSel,
      minTraffic: minTraffic,
      feeSel: feeSel,
      maxFee: maxFee
    };
  }

  function applyFilters() {
    var f = getFilterValues();
    state.filtered = ALL_SITES.filter(function (s) {
      if (f.q) {
        var hay = [s.n, s.c, s.g, s.t, s.r, s.url, s.feat, s.fee, s.traffic].join(' ').toLowerCase();
        if (hay.indexOf(f.q) < 0) return false;
      }
      if (f.continent && s.g !== f.continent) return false;
      if (f.country && s.c !== f.country) return false;
      if (f.type && s.t !== f.type) return false;
      if (f.region && s.r !== f.region) return false;
      if (f.eu === 'eu' && !isEU(s.c)) return false;
      if (f.eu === 'non-eu' && (s.g !== 'Europe' || isEU(s.c))) return false;
      if (f.minTraffic > 0 && parseTraffic(s.traffic) < f.minTraffic) return false;
      if (f.maxFee < Infinity && parseFeeNum(s.fee) > f.maxFee) return false;
      return true;
    });

    sortFiltered();
    state.page = 1;
    renderResults();
    renderChips(f);
    updateSelectVisuals();
  }

  function sortFiltered() {
    var k = state.sortKey;
    state.filtered.sort(function (a, b) {
      switch (k) {
        case 'traffic-desc': return parseTraffic(b.traffic) - parseTraffic(a.traffic);
        case 'traffic-asc':  return parseTraffic(a.traffic) - parseTraffic(b.traffic);
        case 'name-asc':     return (a.n || '').localeCompare(b.n || '');
        case 'name-desc':    return (b.n || '').localeCompare(a.n || '');
        case 'country-asc':  return (a.c || '').localeCompare(b.c || '');
      }
      return 0;
    });
  }

  function renderResults() {
    var total = ALL_SITES.length;
    var n = state.filtered.length;
    $('#rbCount').textContent = n.toLocaleString();
    $('#rbTotal').textContent = total.toLocaleString();

    $('#emptyState').hidden = n > 0;
    $('#dirTableWrap').hidden = n === 0 || state.viewMode !== 'table';
    $('#dirCardsWrap').hidden = n === 0 || state.viewMode !== 'cards';

    if (n === 0) return;

    if (state.viewMode === 'table') renderTable();
    else renderCards();
  }

  function renderTable() {
    var start = (state.page - 1) * state.pageSize;
    var end = start + state.pageSize;
    var rows = state.filtered.slice(start, end);

    // Make sure table has star column header
    var thead = $('#dirTable thead tr');
    if (thead && !thead.querySelector('.th-star')) {
      var th = document.createElement('th');
      th.className = 'th-star';
      th.style.width = '40px';
      th.textContent = '★';
      thead.appendChild(th);
    }

    var html = rows.map(function (s, i) {
      var idx = start + i + 1;
      var siteId = s.url || s.n;
      var isFav = window.GCFavs && window.GCFavs.has(siteId);
      var starCls = 'star-btn' + (isFav ? ' is-fav' : '');
      /* jsonAttr() is used (not esc+JSON.stringify) because esc() does NOT encode
         double-quotes. Bare JSON inside an attribute terminates on the first "
         and the browser silently truncates the value, breaking JSON.parse. */
      var siteJson = jsonAttr({n:s.n,url:s.url,f:s.f||'',c:s.c||'',g:s.g||'',r:s.r||'',t:s.t||'',traffic:s.traffic||'',fee:s.fee||'',feat:s.feat||''});
      return '<tr>'
        + '<td><span class="rank">' + idx + '</span></td>'
        + '<td><div class="site-cell site-cell-click" data-platform-open="' + siteJson + '">'
        + '<span class="site-name">' + esc(s.n) + '</span>'
        + '<a class="site-url" href="https://' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' + esc(s.url) + '</a>'
        + '</div></td>'
        + '<td class="hide-sm"><span class="country-cell"><span class="flag">' + (s.f || '') + '</span>' + esc(s.c || '—') + (isEU(s.c) ? ' <span class="eu-tag" style="padding:1px 6px;font-size:9.5px">EU</span>' : '') + '</span></td>'
        + '<td class="hide-sm">' + esc(s.g || '—') + '</td>'
        + '<td><span class="' + badgeClass(s.t) + '">' + esc(typeName(s.t)) + '</span></td>'
        + '<td><span class="traffic-val">' + esc(s.traffic || '—') + '</span></td>'
        + '<td class="hide-md"><span class="fee-val">' + esc(s.fee || '—') + '</span></td>'
        + '<td class="hide-lg"><span class="feat-cell">' + esc(s.feat || '—') + '</span></td>'
        + '<td><button class="' + starCls + '" data-fav-site="' + siteJson + '" aria-label="Yêu thích">' + (isFav ? '★' : '☆') + '</button></td>'
        + '</tr>';
    }).join('');
    $('#dirBody').innerHTML = html;

    renderPager('#pager');
  }

  function renderCards() {
    // Group filtered sites by country
    var byCountry = {};
    state.filtered.forEach(function (s) {
      var key = (s.c || '—') + '|' + (s.g || '');
      if (!byCountry[key]) {
        byCountry[key] = {
          country: s.c || '—',
          flag: s.f || '',
          continent: s.g || '',
          sites: []
        };
      }
      byCountry[key].sites.push(s);
    });

    // Build groups array and compute total traffic per group
    var groups = Object.keys(byCountry).map(function (k) {
      var g = byCountry[k];
      g.totalTraffic = g.sites.reduce(function (sum, s) { return sum + parseTraffic(s.traffic); }, 0);
      // Sort sites inside each country by traffic desc
      g.sites.sort(function (a, b) { return parseTraffic(b.traffic) - parseTraffic(a.traffic); });
      return g;
    });

    // Sort groups based on current sortKey
    var sk = state.sortKey;
    groups.sort(function (a, b) {
      if (sk === 'n-asc' || sk === 'c-asc') return (a.country || '').localeCompare(b.country || '');
      if (sk === 'n-desc') return (b.country || '').localeCompare(a.country || '');
      if (sk === 'traffic-asc') return a.totalTraffic - b.totalTraffic;
      return b.totalTraffic - a.totalTraffic; // default: traffic-desc
    });

    // Paginate by groups (8 countries per page on mobile-friendly)
    var groupsPerPage = 8;
    var totalPages = Math.max(1, Math.ceil(groups.length / groupsPerPage));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * groupsPerPage;
    var pageGroups = groups.slice(start, start + groupsPerPage);

    if (pageGroups.length === 0) {
      $('#dirCards').innerHTML = '';
      $('#pager2').innerHTML = '';
      return;
    }

    var html = pageGroups.map(function (g) {
      var euBadge = isEU(g.country) ? '<span class="eu-tag" title="Thành viên Liên minh Châu Âu">🇪🇺 EU</span>' : '';
      var sitesHtml = g.sites.map(function (s) {
        var siteId = s.url || s.n;
        var isFav = window.GCFavs && window.GCFavs.has(siteId);
        var starCls = 'star-btn' + (isFav ? ' is-fav' : '');
        return '<li class="cc-site">'
          + '<a href="https://' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">'
          + '<div class="cc-site-h">'
          + '<span class="cc-site-name">' + esc(s.n) + '</span>'
          + '<span class="' + badgeClass(s.t) + '">' + esc(typeName(s.t)) + '</span>'
          + '</div>'
          + '<div class="cc-site-meta">'
          + '<span>📊 ' + esc(s.traffic || '—') + '</span>'
          + '<span>💸 ' + esc(s.fee || '—') + '</span>'
          + (s.r ? '<span>📍 ' + esc(s.r) + '</span>' : '')
          + '</div>'
          + (s.feat ? '<div class="cc-site-feat">' + esc(s.feat) + '</div>' : '')
          + '</a>'
          + '<button class="' + starCls + '" data-fav-site="' + jsonAttr({n:s.n,url:s.url,f:s.f||'',c:s.c||'',g:s.g||'',t:s.t||'',traffic:s.traffic||'',fee:s.fee||'',feat:s.feat||''}) + '" aria-label="Yêu thích">' + (isFav ? '★' : '☆') + '</button>'
          + '</li>';
      }).join('');

      return '<article class="ccard">'
        + '<header class="ccard-h">'
        + '<span class="flag">' + (g.flag || '🏳️') + '</span>'
        + '<div class="ccard-h-text">'
        + '<h3>' + esc(g.country) + ' ' + euBadge + '</h3>'
        + '<div class="ccard-sub">' + esc(g.continent || '—') + ' · <b>' + g.sites.length + '</b> sàn · Traffic <b>' + formatTraffic(g.totalTraffic) + '</b>/tháng</div>'
        + '</div>'
        + '</header>'
        + '<ul class="ccard-list">' + sitesHtml + '</ul>'
        + '</article>';
    }).join('');

    $('#dirCards').innerHTML = html;
    renderPager('#pager2', groups.length, groupsPerPage);
  }

  function renderPager(selector, totalItems, pageSize) {
    var total = (totalItems != null) ? totalItems : state.filtered.length;
    var ps = pageSize || state.pageSize;
    var totalPages = Math.ceil(total / ps);
    var el = $(selector);
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    var cur = state.page;
    var html = '';
    html += '<button class="pg-btn" data-pg="' + (cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + ' aria-label="Trang trước">‹</button>';

    var pages = pagerRange(cur, totalPages);
    pages.forEach(function (p) {
      if (p === '...') html += '<span class="pg-ellipsis">…</span>';
      else html += '<button class="pg-btn' + (p === cur ? ' active' : '') + '" data-pg="' + p + '">' + p + '</button>';
    });

    html += '<button class="pg-btn" data-pg="' + (cur + 1) + '"' + (cur === totalPages ? ' disabled' : '') + ' aria-label="Trang sau">›</button>';
    el.innerHTML = html;
  }

  function pagerRange(cur, total) {
    var delta = 2;
    var range = [];
    var rangeWithDots = [];
    var l;
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= cur - delta && i <= cur + delta)) {
        range.push(i);
      }
    }
    range.forEach(function (i) {
      if (l !== undefined) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    });
    return rangeWithDots;
  }

  function renderChips(f) {
    var chips = [];
    if (f.q) chips.push({ k: 'q', label: '"' + f.q + '"' });
    if (f.continent) chips.push({ k: 'fltContinent', label: 'Châu lục: ' + f.continent });
    if (f.country) chips.push({ k: 'fltCountry', label: 'Quốc gia: ' + f.country });
    if (f.type) chips.push({ k: 'fltType', label: 'Loại: ' + typeName(f.type) });
    if (f.region) chips.push({ k: 'fltRegion', label: 'Khu vực: ' + f.region });
    if (f.eu === 'eu') chips.push({ k: 'fltEU', label: '🇪🇺 Chỉ EU (27)' });
    if (f.eu === 'non-eu') chips.push({ k: 'fltEU', label: 'Ngoài EU (Châu Âu)' });
    if (f.trafficSel) {
      var lbl = f.trafficSel === 'custom'
        ? 'Traffic ≥ ' + formatTraffic(f.minTraffic)
        : 'Traffic ≥ ' + formatTraffic(parseFloat(f.trafficSel));
      chips.push({ k: 'fltTraffic', label: lbl });
    }
    if (f.feeSel !== '') {
      var fLbl = f.feeSel === 'custom'
        ? 'Phí ≤ ' + f.maxFee + '%'
        : (f.feeSel === '0' ? 'Miễn phí (0%)' : 'Phí ≤ ' + f.feeSel + '%');
      chips.push({ k: 'fltFee', label: fLbl });
    }

    var html = chips.map(function (c) {
      return '<span class="chip" data-clear="' + esc(c.k) + '">' + esc(c.label) + ' <span class="x">✕</span></span>';
    }).join('');
    if (chips.length > 0) html += '<button class="chip-clear-all" data-action="clear-all">Xóa tất cả</button>';
    $('#activeChips').innerHTML = html;
  }

  function updateSelectVisuals() {
    ['fltContinent', 'fltCountry', 'fltType', 'fltRegion', 'fltEU', 'fltTraffic', 'fltFee'].forEach(function (id) {
      var el = $('#' + id);
      if (!el) return;
      el.classList.toggle('has-value', !!el.value && el.value !== 'custom');
    });
  }

  function clearFilter(key) {
    if (key === 'q') {
      $('#dirSearch').value = '';
      $('#globalSearch').value = '';
    } else if (key === 'fltTraffic') {
      $('#fltTraffic').value = '';
      $('#fltTrafficCustom').value = '';
      var tw = $('#fltTrafficCustomWrap'); if (tw) tw.hidden = true;
      var th = $('#fltTrafficHint'); if (th) { th.innerHTML = 'Nhập số lượt truy cập tối thiểu'; th.classList.remove('is-active'); }
    } else if (key === 'fltFee') {
      $('#fltFee').value = '';
      $('#fltFeeCustom').value = '';
      var fw = $('#fltFeeCustomWrap'); if (fw) fw.hidden = true;
    } else {
      var el = $('#' + key);
      if (el) el.value = '';
    }
    applyFilters();
  }

  function clearAllFilters() {
    $('#dirSearch').value = '';
    $('#globalSearch').value = '';
    ['fltContinent', 'fltCountry', 'fltType', 'fltRegion', 'fltEU', 'fltTraffic', 'fltFee'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.value = '';
    });
    $('#fltTrafficCustom').value = '';
    var tw = $('#fltTrafficCustomWrap'); if (tw) tw.hidden = true;
    var th = $('#fltTrafficHint'); if (th) { th.innerHTML = 'Nhập số lượt truy cập tối thiểu'; th.classList.remove('is-active'); }
    $('#fltFeeCustom').value = '';
    var fw = $('#fltFeeCustomWrap'); if (fw) fw.hidden = true;
    applyFilters();
  }

  function renderDirectory() {
    // first time setup
    if (!state.dirReady) {
      populateFilters();
      state.dirReady = true;
    }
    applyFilters();
  }

  /* ─────────────────────────────────────────── DIGITAL ──────────── */
  function renderDigital() {
    var counts = {
      'digital-marketplace': 0,
      'key-marketplace': 0,
      'creative-marketplace': 0,
      'publishing': 0,
      'saas-platform': 0,
      'privacy-selling': 0,
      'freelance': 0
    };
    DIGITAL.forEach(function (p) {
      if (counts.hasOwnProperty(p.t)) counts[p.t]++;
    });

    $('#dpMarketplace').textContent = counts['digital-marketplace'];
    $('#dpKeys').textContent = counts['key-marketplace'];
    $('#dpCreative').textContent = counts['creative-marketplace'];
    $('#dpPublish').textContent = counts['publishing'];

    var html = DIGITAL.map(function (p) {
      return '<tr>'
        + '<td><div class="site-cell">'
        + '<span class="site-name">' + (p.f ? p.f + ' ' : '') + esc(p.n) + '</span>'
        + '<a class="site-url" href="https://' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.url) + '</a>'
        + '</div></td>'
        + '<td><span class="' + badgeClass(p.t) + '">' + esc(typeName(p.t)) + '</span></td>'
        + '<td><span class="traffic-val">' + esc(p.traffic || '—') + '</span></td>'
        + '<td class="hide-sm"><span class="fee-val">' + esc(p.fee || '—') + '</span></td>'
        + '<td class="hide-md"><span class="feat-cell">' + esc(p.feat || '—') + '</span></td>'
        + '</tr>';
    }).join('');
    $('#dpCompareBody').innerHTML = html;
  }

  /* ─────────────────────────────────────────── CONTINENTS ───────── */
  function renderContinents() {
    var groups = {};
    ALL_SITES.forEach(function (s) {
      var g = s.g || 'Other';
      if (!groups[g]) groups[g] = { sites: 0, countries: {}, totalTraffic: 0, top: [] };
      groups[g].sites++;
      groups[g].totalTraffic += parseTraffic(s.traffic);
      if (s.c) groups[g].countries[s.c] = 1;
    });

    Object.keys(groups).forEach(function (g) {
      var top = ALL_SITES.filter(function (s) { return s.g === g; })
        .sort(function (a, b) { return parseTraffic(b.traffic) - parseTraffic(a.traffic); })
        .slice(0, 5)
        .map(function (s) { return s.n; });
      groups[g].top = top;
    });

    var html = Object.keys(groups).sort().map(function (g) {
      var meta = CONTINENT_META[g] || { emoji: '🌐', label: g, color: '#0B5FFF' };
      var info = groups[g];
      return '<a class="continent-card" href="#" data-continent="' + esc(g) + '" style="--cc-color:' + meta.color + '">'
        + '<div class="cc-emoji">' + meta.emoji + '</div>'
        + '<div class="cc-title">' + esc(meta.label) + '</div>'
        + '<div class="cc-region">' + esc(g) + ' · ' + formatTraffic(info.totalTraffic) + '/mo</div>'
        + '<div class="cc-stats">'
        + '<div class="cc-stat"><span class="n">' + info.sites + '</span><span class="l">Sàn</span></div>'
        + '<div class="cc-stat"><span class="n">' + Object.keys(info.countries).length + '</span><span class="l">Quốc gia</span></div>'
        + '</div>'
        + '<div class="cc-top">Top: <strong>' + esc(info.top.join(' · ')) + '</strong></div>'
        + '<div class="cc-cta">Xem tất cả →</div>'
        + '</a>';
    }).join('');
    $('#continentGrid').innerHTML = html;
  }

  /* ─────────────────────────────────────────── EXPORT CSV ──────── */
  function exportCSV() {
    var data;
    if (state.route === 'directory' && state.filtered && state.filtered.length) {
      data = state.filtered;
    } else if (state.route === 'digital') {
      data = DIGITAL;
    } else {
      data = ALL_SITES.slice();
    }
    var head = ['Name', 'URL', 'Country', 'Continent', 'Region', 'Type', 'Traffic', 'Fee', 'Features'];
    var rows = [head];
    data.forEach(function (s) {
      rows.push([
        s.n || '',
        s.url || '',
        s.c || '',
        s.g || '',
        s.r || '',
        typeName(s.t),
        s.traffic || '',
        s.fee || '',
        (s.feat || '').replace(/"/g, '""')
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'globalcommerce_' + state.route + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ─────────────────────────────────────────── GLOBAL SEARCH ────── */
  var suggestIndex = -1;
  function showSuggest(q) {
    var box = $('#searchSuggest');
    if (!box) return;
    if (!q || q.length < 2) { box.hidden = true; return; }
    var lq = q.toLowerCase();
    var results = ALL_WITH_DIGITAL.filter(function (s) {
      var hay = [s.n, s.c, s.url, s.t].join(' ').toLowerCase();
      return hay.indexOf(lq) >= 0;
    }).slice(0, 8);

    if (!results.length) {
      box.innerHTML = '<div class="sg-empty">Không tìm thấy kết quả cho "<strong>' + esc(q) + '</strong>"</div>';
      box.hidden = false;
      return;
    }

    var html = results.map(function (s, i) {
      var name = highlightMatch(s.n, q);
      return '<div class="sg-item' + (i === suggestIndex ? ' active' : '') + '" data-suggest="' + i + '">'
        + '<div class="sg-l">'
        + '<div class="sg-name">' + name + '</div>'
        + '<div class="sg-url">' + esc(s.url) + '</div>'
        + '</div>'
        + '<div class="sg-r">'
        + '<span class="sg-country">' + (s.f || '') + ' ' + esc(s.c || '') + '</span>'
        + '<span class="' + badgeClass(s.t) + '">' + esc(typeName(s.t)) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
    html += '<div class="sg-foot">Enter để xem tất cả · Esc để đóng</div>';
    box.innerHTML = html;
    box.hidden = false;

    // store results for click
    box._results = results;
  }

  function highlightMatch(text, query) {
    if (!query) return esc(text);
    var lText = String(text).toLowerCase();
    var idx = lText.indexOf(query.toLowerCase());
    if (idx < 0) return esc(text);
    return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + query.length)) + '</mark>' + esc(text.slice(idx + query.length));
  }

  function selectSuggest(i) {
    var box = $('#searchSuggest');
    if (!box._results) return;
    var s = box._results[i];
    if (!s) return;
    box.hidden = true;
    $('#globalSearch').value = s.n;
    $('#dirSearch').value = s.n;
    navigate('directory');
    setTimeout(applyFilters, 30);
  }

  /* ─────────────────────────────────────────── TOAST ─────────── */
  var _toastContainer = null;
  function toast(msg, type, duration) {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.className = 'toast-container';
      document.body.appendChild(_toastContainer);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    _toastContainer.appendChild(t);
    setTimeout(function () {
      t.style.animation = 'toast-out .3s var(--ease) forwards';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, duration || 2800);
  }

  /* ─────────────────────────────────────────── AUTH MODAL UI ─── */
  function openAuthModal(tab) {
    var backdrop = $('#authModalBackdrop');
    backdrop.classList.add('is-open');
    backdrop.removeAttribute('aria-hidden');
    switchAuthTab(tab || 'login');
    setTimeout(function () {
      var input = tab === 'register' ? $('#regEmail') : $('#loginEmail');
      if (input) input.focus();
    }, 150);
  }
  function closeAuthModal() {
    var backdrop = $('#authModalBackdrop');
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    hideAuthError('loginError');
    hideAuthError('registerError');
  }
  function switchAuthTab(tab) {
    $$('.auth-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-auth-tab') === tab); });
    $$('.auth-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel' + (tab === 'login' ? 'Login' : 'Register')); });
  }
  function showAuthError(id, msg) {
    var el = $('#' + id);
    if (!el) return;
    el.textContent = msg;
    /* BUG FIX: main.css declares [hidden]{display:none !important}.
       An author !important rule beats ANY normal inline style, so
       el.style.display='block' does nothing while [hidden] is present.
       The only reliable fix is to remove the attribute entirely. */
    el.removeAttribute('hidden');
  }

  function hideAuthError(id) {
    var el = $('#' + id);
    if (!el) return;
    el.setAttribute('hidden', '');
  }
  function setSubmitting(btnId, loading) {
    var btn = $('#' + btnId);
    if (!btn) return;
    var text = btn.querySelector('.btn-text');
    var spinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    /* Text: no [hidden] attribute in HTML, so plain style toggle works */
    if (text) text.style.display = loading ? 'none' : '';
    /* Spinner: has [hidden] attribute. main.css: [hidden]{display:none !important}
       means style.display='inline-block' can NEVER override it.
       Fix: remove the attribute to show, restore it to hide. */
    if (spinner) {
      if (loading) {
        spinner.removeAttribute('hidden');
        spinner.style.display = 'inline-block';
      } else {
        spinner.style.display = '';
        spinner.setAttribute('hidden', '');
      }
    }
  }

  /* ── Auth widget toggle (login btn vs user pill) ── */
  function updateAuthUI() {
    var isIn = window.GCAuth && window.GCAuth.loggedIn();
    var loginBtn = $('#authLoginBtn');
    var pill = $('#authUserPill');

    if (isIn) {
      /* Hide login button */
      if (loginBtn) { loginBtn.hidden = true; loginBtn.style.display = 'none'; }
      /* Show user pill — must remove hidden attribute AND set display */
      if (pill) {
        pill.hidden = false;
        pill.style.display = 'flex';
        var name   = window.GCAuth.displayName();
        var avChar = window.GCAuth.avatar();
        var av     = $('#authAvatar');
        var dn     = $('#authDisplayName');
        var ddAv   = $('#authDdAvatar');
        var ddName = $('#authDdName');
        if (av)     av.textContent   = avChar;
        if (dn)     dn.textContent   = name;
        if (ddAv)   ddAv.textContent = avChar;
        if (ddName) ddName.textContent = name;
      }
    } else {
      /* Show login button */
      if (loginBtn) { loginBtn.hidden = false; loginBtn.style.display = ''; }
      /* Hide user pill */
      if (pill) { pill.hidden = true; pill.style.display = 'none'; }
      /* Close dropdown if open */
      var dd = $('#authDropdown');
      if (dd) dd.hidden = true;
    }
    updateFavBadge();
  }

  function updateFavBadge() {
    var badge = $('#navFavCount');
    var ddBadge = $('#authDdFavCount');
    if (!badge) return;
    if (window.GCAuth && window.GCAuth.loggedIn() && window.GCFavs) {
      var count = window.GCFavs.all().length;
      badge.textContent = count;
      badge.style.display = count > 0 ? '' : 'none';
      if (ddBadge) ddBadge.textContent = count;
    } else {
      badge.textContent = '0';
      badge.style.display = 'none';
      if (ddBadge) ddBadge.textContent = '0';
    }
  }

  /* ─────────────────────────────────────────── FAVORITES VIEW ── */
  function renderFavorites() {
    var isIn = window.GCAuth && window.GCAuth.loggedIn();
    var guestEl = $('#favGuestState');
    var emptyEl = $('#favEmptyState');
    var toolbar = $('#favToolbar');
    var listEl = $('#favList');
    var actionsEl = $('#favActions');

    /* ── helpers: use removeAttribute/setAttribute to reliably toggle
       elements that carry the HTML `hidden` attribute in markup ── */
    function show(el) { if (el) el.removeAttribute('hidden'); }
    function hide(el) { if (el) el.setAttribute('hidden', ''); }

    if (!isIn) {
      show(guestEl);
      hide(emptyEl); hide(toolbar); hide(listEl);
      if (actionsEl) actionsEl.style.display = 'none';
      return;
    }

    hide(guestEl);
    if (actionsEl) actionsEl.style.display = '';

    var favs = window.GCFavs ? window.GCFavs.all() : [];

    /* ── Filters ── */
    var q        = ($('#favSearch')          ? $('#favSearch').value          : '').toLowerCase().trim();
    var sort     = ($('#favSortSelect')      ? $('#favSortSelect').value      : 'newest');
    var fPrio    = ($('#favPriorityFilter')  ? $('#favPriorityFilter').value  : '');
    var fStatus  = ($('#favStatusFilter')   ? $('#favStatusFilter').value    : '');
    var fCountry = ($('#favCountryFilter')  ? $('#favCountryFilter').value.toLowerCase().trim() : '');

    if (q) {
      favs = favs.filter(function (f) {
        return [f.n, f.url, f.c, f.note, f.strategy, f.opportunity, f.risk, f.target, f.contact, (f.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (fPrio)    favs = favs.filter(function (f) { return f.priority === fPrio; });
    if (fStatus)  favs = favs.filter(function (f) { return f.status === fStatus; });
    if (fCountry) favs = favs.filter(function (f) { return (f.c || '').toLowerCase().indexOf(fCountry) >= 0; });

    favs = favs.slice().sort(function (a, b) {
      if (sort === 'oldest')   return (a.savedAt || 0) - (b.savedAt || 0);
      if (sort === 'name')     return (a.n || '').localeCompare(b.n || '');
      if (sort === 'traffic')  return parseTraffic(b.traffic) - parseTraffic(a.traffic);
      if (sort === 'priority') { var p = { high: 3, medium: 2, low: 1 }; return (p[b.priority] || 0) - (p[a.priority] || 0); }
      return (b.savedAt || 0) - (a.savedAt || 0);
    });

    /* ── Update result count label ── */
    var countEl = $('#favFilterCount');
    var total = window.GCFavs ? window.GCFavs.all().length : 0;
    if (countEl) {
      countEl.textContent = (favs.length < total)
        ? 'Hiển thị ' + favs.length + ' / ' + total + ' yêu thích'
        : total + ' sàn đã lưu';
    }

    if (favs.length === 0) {
      show(emptyEl);
      show(toolbar);
      hide(listEl);
      return;
    }

    hide(emptyEl);
    show(toolbar);
    show(listEl);

    var statusLabels = {
      'researching': '🔍 Nghiên cứu',
      'active':      '✅ Triển khai',
      'pending':     '⏳ Chờ triển khai',
      'paused':      '⏸ Tạm dừng',
      'completed':   '🏆 Hoàn thành'
    };
    var priorityLabels = {
      'low':    '🟢 Thấp',
      'medium': '🟡 Trung bình',
      'high':   '🔴 Cao'
    };

    var html = favs.map(function (fav) {
      /* ── Meta pills row ── */
      var meta = '';
      if (fav.t)       meta += '<span class="fav-meta-pill type">' + esc(typeName(fav.t)) + '</span>';
      if (fav.c)       meta += '<span class="fav-meta-pill country"><span class="flag">' + (fav.f || '') + '</span>' + esc(fav.c) + '</span>';
      if (fav.traffic) meta += '<span class="fav-meta-pill traffic">📊 ' + esc(fav.traffic) + '</span>';
      if (fav.fee)     meta += '<span class="fav-meta-pill fee">💰 ' + esc(fav.fee) + '</span>';
      if (fav.priority) meta += '<span class="fav-meta-pill priority-' + esc(fav.priority) + '">' + (priorityLabels[fav.priority] || '') + '</span>';
      if (fav.status)  meta += '<span class="fav-meta-pill fav-status-pill status-' + esc(fav.status) + '">' + (statusLabels[fav.status] || fav.status) + '</span>';

      /* ── CRM fields — always shown (dash if empty) ── */
      function crmRow(icon, label, val) {
        return '<div class="fav-crm-row' + (val ? '' : ' fav-crm-empty') + '">'
          + '<span class="fav-crm-icon">' + icon + '</span>'
          + '<div class="fav-crm-body">'
          + '<span class="fav-crm-label">' + label + '</span>'
          + '<span class="fav-crm-val">' + (val ? esc(val) : '<em>—</em>') + '</span>'
          + '</div>'
          + '</div>';
      }

      var hasAnyNote = fav.note || fav.strategy || fav.opportunity || fav.risk || fav.target || fav.contact;
      var crmSection = '<div class="fav-crm-section">'
        + crmRow('📝', 'Ghi chú', fav.note)
        + crmRow('🎯', 'Chiến lược', fav.strategy)
        + crmRow('💡', 'Cơ hội', fav.opportunity)
        + crmRow('⚠️', 'Rủi ro', fav.risk)
        + crmRow('📊', 'Mục tiêu', fav.target)
        + crmRow('📞', 'Liên hệ / Tài khoản', fav.contact)
        + '</div>';

      /* ── Tags ── */
      var tagsHtml = '';
      if (fav.tags && fav.tags.length) {
        tagsHtml = '<div class="fav-card-tags fav-card-tags-inline">'
          + '<span class="fav-crm-label" style="margin-right:6px">🏷</span>'
          + fav.tags.map(function (t) { return '<span class="fav-tag">' + esc(t) + '</span>'; }).join('')
          + '</div>';
      }

      var dateStr = fav.savedAt ? new Date(fav.savedAt).toLocaleDateString('vi-VN') : '';

      return '<article class="fav-card">'
        /* ── Card header ── */
        + '<div class="fav-card-head">'
        + '<span class="fav-card-flag">' + (fav.f || '🏳️') + '</span>'
        + '<div class="fav-card-info">'
        + '<div class="fav-card-name">' + esc(fav.n) + '</div>'
        + '<a class="fav-card-url" href="https://' + esc(fav.url) + '" target="_blank" rel="noopener noreferrer">' + esc(fav.url) + '</a>'
        + '</div>'
        + '<div class="fav-card-actions">'
        + '<button class="fav-edit-btn" data-note-open="' + esc(fav.id) + '" title="Chỉnh sửa ghi chú"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Sửa</button>'
        + '<button class="fav-remove-btn" data-fav-remove="' + esc(fav.id) + '" title="Xóa khỏi yêu thích"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> Xóa</button>'
        + '</div>'
        + '</div>'
        /* ── Meta pills ── */
        + (meta ? '<div class="fav-card-meta">' + meta + '</div>' : '')
        /* ── CRM workspace ── */
        + crmSection
        /* ── Tags row ── */
        + tagsHtml
        /* ── Footer ── */
        + '<div class="fav-card-foot">'
        + '<span class="fav-date">⭐ Lưu ngày ' + dateStr + '</span>'
        + '<a href="https://' + esc(fav.url) + '" class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" style="font-size:12px">🔗 Mở website</a>'
        + '</div>'
        + '</article>';
    }).join('');
    listEl.innerHTML = html;
  }

  /* ──────────────────────────────────────────────── NOTE MODAL UI ─── */
  var _noteCurrentId = null;
  var _noteTags = [];
  var _notePriority = 'high';

  function openNoteModal(favId) {
    if (!window.GCFavs) return;
    var fav = window.GCFavs.get(favId);
    if (!fav) return;

    _noteCurrentId = favId;
    _noteTags = (fav.tags || []).slice();
    _notePriority = fav.priority || 'high';

    /* Dynamic header label: new vs existing notes */
    var isNew = !(fav.note || fav.strategy || fav.opportunity || fav.risk || fav.target || fav.contact);
    var savedBadge = $('#noteModalBackdrop .note-saved-badge');
    if (savedBadge) {
      savedBadge.textContent = isNew
        ? '✅ Đã lưu vào yêu thích — thêm ghi chú tuỳ chọn bên dưới'
        : '✏️ Chỉnh sửa ghi chú — nhấn Lưu để cập nhật';
    }

    // Populate header
    $('#noteFlag').textContent = fav.f || '🏳️';
    $('#noteModalTitle').textContent = fav.n;
    var urlEl = $('#noteSiteUrl');
    urlEl.textContent = fav.url;
    urlEl.href = 'https://' + fav.url;

    // Meta pills
    var pills = '';
    if (fav.t) pills += '<span class="note-meta-pill">' + esc(typeName(fav.t)) + '</span>';
    if (fav.traffic) pills += '<span class="note-meta-pill">📊 ' + esc(fav.traffic) + '</span>';
    if (fav.fee) pills += '<span class="note-meta-pill">💰 ' + esc(fav.fee) + '</span>';
    if (fav.c) pills += '<span class="note-meta-pill">' + (fav.f || '') + ' ' + esc(fav.c) + '</span>';
    $('#noteMetaPills').innerHTML = pills;

    // Main note textarea
    var ta = $('#noteTextarea');
    ta.value = fav.note || '';
    $('#noteCharCount').textContent = ta.value.length;

    // Structured fields
    var fs = $('#noteStrategy');    if (fs) fs.value = fav.strategy || '';
    var fo = $('#noteOpportunity'); if (fo) fo.value = fav.opportunity || '';
    var fr = $('#noteRisk');        if (fr) fr.value = fav.risk || '';
    var ft = $('#noteTarget');      if (ft) ft.value = fav.target || '';
    var fc = $('#noteContact');     if (fc) fc.value = fav.contact || '';

    // Priority buttons
    $$('.note-priority-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-priority') === _notePriority);
    });

    // Status select
    var statusSel = $('#noteStatus');
    if (statusSel) statusSel.value = fav.status || 'researching';

    // Tags
    renderTagChips();

    // Open modal
    var backdrop = $('#noteModalBackdrop');
    backdrop.classList.add('is-open');
    backdrop.removeAttribute('aria-hidden');
    setTimeout(function () { ta.focus(); }, 150);
  }

  function closeNoteModal() {
    var backdrop = $('#noteModalBackdrop');
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    _noteCurrentId = null;
    _noteTags = [];
    _notePriority = 'high';
  }

  function renderTagChips() {
    var list = $('#tagsList');
    if (!list) return;
    list.innerHTML = _noteTags.map(function (tag, i) {
      return '<span class="tag-chip">' + esc(tag)
        + '<button type="button" data-tag-remove="' + i + '" aria-label="Xóa tag">×</button>'
        + '</span>';
    }).join('');
  }

  function addTag(tag) {
    tag = tag.trim();
    if (!tag || _noteTags.indexOf(tag) >= 0) return;
    _noteTags.push(tag);
    renderTagChips();
  }

  /* ─────────────────────────────────────────── STAR CLICK ─────── */
  function handleStarClick(btn) {
    if (!window.GCAuth || !window.GCAuth.loggedIn()) {
      openAuthModal('login');
      toast('🔑 Đăng nhập để lưu yêu thích', 'warn');
      return;
    }
    var siteData;
    try { siteData = JSON.parse(btn.getAttribute('data-fav-site')); } catch (e) {
      toast('❌ Lỗi đọc dữ liệu sàn', 'error');
      return;
    }
    var siteId = siteData.url || siteData.n;
    var wasAlreadyFav = window.GCFavs && window.GCFavs.has(siteId);

    if (wasAlreadyFav) {
      /* ── Already saved: open note modal so user can edit notes OR remove ── */
      openNoteModal(siteId);
    } else {
      /* ── New: add immediately, highlight star, open note modal ── */
      window.GCFavs.add(siteData).then(function() {
        updateFavBadge();
        setTimeout(function () { openNoteModal(siteId); }, 380);
      });

      /* Visually highlight the star right away */
      btn.classList.add('is-fav');
      btn.textContent = '★';
      btn.classList.add('pulse-fav');
      setTimeout(function () { btn.classList.remove('pulse-fav'); }, 500);

      toast('★ Đã lưu vào yêu thích! Thêm ghi chú bên dưới.', 'success');
      return; // early return — everything else handled in .then() above
    }
  }

  /* ─────────────────────────────────────────── EVENT WIRING ─────── */
  function wire() {
    // Sidebar nav
    document.addEventListener('click', function (e) {
      var routeEl = e.target.closest('[data-route]');
      if (routeEl) {
        e.preventDefault();
        // Close dropdown if open
        var dd = $('#authDropdown');
        if (dd && !dd.hidden) {
          dd.hidden = true;
          var mb = $('#authMenuBtn');
          if (mb) mb.setAttribute('aria-expanded', 'false');
        }
        navigate(routeEl.getAttribute('data-route'));
        return;
      }
      var contEl = e.target.closest('[data-continent]');
      if (contEl) {
        e.preventDefault();
        var c = contEl.getAttribute('data-continent');
        // need to render directory first to populate filters
        renderDirectory();
        $('#fltContinent').value = c;
        navigate('directory');
        applyFilters();
        return;
      }
      /* Platform detail modal — opens when clicking the site-cell */
      var pmEl = e.target.closest('.site-cell-click');
      if (pmEl && !e.target.closest('.star-btn') && !e.target.closest('a')) {
        e.preventDefault();
        try {
          var pmData = JSON.parse(pmEl.getAttribute('data-platform-open'));
          openPlatformModal(pmData);
        } catch (pmErr) {}
        return;
      }
      if (e.target.closest('[data-action="export-csv"]')) {
        e.preventDefault();
        exportCSV();
        return;
      }
      if (e.target.closest('[data-action="apply"]')) {
        e.preventDefault();
        applyFilters();
        return;
      }
      if (e.target.closest('[data-action="clear-all"]')) {
        e.preventDefault();
        clearAllFilters();
        return;
      }
      var chipEl = e.target.closest('.chip[data-clear]');
      if (chipEl) {
        clearFilter(chipEl.getAttribute('data-clear'));
        return;
      }
      var pgEl = e.target.closest('[data-pg]');
      if (pgEl) {
        var p = parseInt(pgEl.getAttribute('data-pg'), 10);
        if (!isNaN(p) && p > 0) {
          state.page = p;
          renderResults();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      var vm = e.target.closest('[data-view-mode]');
      if (vm) {
        state.viewMode = vm.getAttribute('data-view-mode');
        $$('.vt-btn').forEach(function (b) { b.classList.toggle('active', b === vm); });
        state.page = 1;
        renderResults();
        return;
      }
      var sg = e.target.closest('[data-suggest]');
      if (sg) {
        selectSuggest(parseInt(sg.getAttribute('data-suggest'), 10));
        return;
      }
      var cm = e.target.closest('[data-chart-mode]');
      if (cm) {
        $$('[data-chart-mode]').forEach(function (b) { b.classList.toggle('active', b === cm); });
        state.chartMode = cm.getAttribute('data-chart-mode');
        renderContinentChart();
        return;
      }

      // Export CSV from sidebar
      if (e.target.closest('#navExportCsv')) {
        e.preventDefault();
        exportCSV();
        return;
      }
    });

    // Mobile menu
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sidebarClose').addEventListener('click', closeSidebar);
    $('#appOverlay').addEventListener('click', closeSidebar);

    // Search inputs
    var dirSearch = $('#dirSearch');
    var dirSearchHandler = debounce(applyFilters, 220);
    dirSearch.addEventListener('input', function () {
      $('#globalSearch').value = this.value;
      dirSearchHandler();
    });
    dirSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyFilters(); }
    });

    var globalSearch = $('#globalSearch');
    var globalHandler = debounce(function () { showSuggest(globalSearch.value); }, 150);
    globalSearch.addEventListener('input', function () {
      $('#dirSearch').value = this.value;
      globalHandler();
    });
    globalSearch.addEventListener('keydown', function (e) {
      var box = $('#searchSuggest');
      var items = box ? $$('.sg-item', box) : [];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestIndex = Math.min(suggestIndex + 1, items.length - 1);
        items.forEach(function (it, i) { it.classList.toggle('active', i === suggestIndex); });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestIndex = Math.max(suggestIndex - 1, -1);
        items.forEach(function (it, i) { it.classList.toggle('active', i === suggestIndex); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestIndex >= 0) {
          selectSuggest(suggestIndex);
        } else {
          if (box) box.hidden = true;
          navigate('directory');
          $('#dirSearch').value = globalSearch.value;
          applyFilters();
        }
      } else if (e.key === 'Escape') {
        if (box) box.hidden = true;
        this.blur();
      }
    });
    globalSearch.addEventListener('focus', function () {
      if (this.value.length >= 2) showSuggest(this.value);
    });

    // Close suggest on outside click
    document.addEventListener('click', function (e) {
      var wrap = $('#topSearchWrap');
      if (wrap && !wrap.contains(e.target)) {
        $('#searchSuggest').hidden = true;
        suggestIndex = -1;
      }
    });

    // Keyboard shortcut: '/'
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        $('#globalSearch').focus();
      }
      if (e.key === 'Escape') {
        $('#searchSuggest').hidden = true;
      }
    });

    // Filters
    ['fltContinent', 'fltCountry', 'fltType', 'fltRegion', 'fltEU'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('change', applyFilters);
    });

    // Helper: format number with dots as thousand separators (VN style)
    // (formatNumVN, parseNumVN, humanShort defined in outer scope)

    // Custom traffic filter — with live formatting
    $('#fltTraffic').addEventListener('change', function () {
      var wrap = $('#fltTrafficCustomWrap');
      var cust = $('#fltTrafficCustom');
      if (this.value === 'custom') {
        wrap.hidden = false;
        setTimeout(function () { cust.focus(); }, 50);
      } else {
        wrap.hidden = true;
        cust.value = '';
      }
      applyFilters();
    });

    var customTrafficHandler = debounce(applyFilters, 300);
    var trafficInput = $('#fltTrafficCustom');
    var trafficHint = $('#fltTrafficHint');

    trafficInput.addEventListener('input', function (e) {
      // Auto-format with dots while typing, preserve cursor position
      var oldVal = this.value;
      var oldPos = this.selectionStart;
      var digits = oldVal.replace(/[^\d]/g, '');
      // Cap at 999,999,999,999 (trillion)
      if (digits.length > 13) digits = digits.slice(0, 13);
      var newVal = digits ? formatNumVN(digits) : '';
      this.value = newVal;

      // Restore cursor position smartly
      var diff = newVal.length - oldVal.length;
      var newPos = Math.max(0, oldPos + diff);
      this.setSelectionRange(newPos, newPos);

      // Update hint
      var n = parseNumVN(newVal);
      if (n > 0) {
        trafficHint.innerHTML = '≈ <b>' + humanShort(n) + '</b> lượt truy cập / tháng';
        trafficHint.classList.add('is-active');
      } else {
        trafficHint.innerHTML = 'Nhập số lượt truy cập tối thiểu';
        trafficHint.classList.remove('is-active');
      }

      // Update active quick-chip
      $$('.num-chip[data-traffic-quick]').forEach(function (c) {
        c.classList.toggle('active', parseInt(c.getAttribute('data-traffic-quick'), 10) === n);
      });

      customTrafficHandler();
    });

    // Quick-chip buttons for common traffic values
    $$('.num-chip[data-traffic-quick]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var val = parseInt(this.getAttribute('data-traffic-quick'), 10);
        trafficInput.value = formatNumVN(val);
        // Trigger input event for formatting + hint update
        trafficInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    // Custom fee filter — same treatment
    $('#fltFee').addEventListener('change', function () {
      var wrap = $('#fltFeeCustomWrap');
      var cust = $('#fltFeeCustom');
      if (this.value === 'custom') {
        wrap.hidden = false;
        setTimeout(function () { cust.focus(); }, 50);
      } else {
        wrap.hidden = true;
        cust.value = '';
      }
      applyFilters();
    });
    var customFeeHandler = debounce(applyFilters, 300);
    $('#fltFeeCustom').addEventListener('input', function () {
      // Allow digits + one decimal point, cap at 100
      var v = this.value.replace(/[^\d.,]/g, '').replace(',', '.');
      var parts = v.split('.');
      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
      var n = parseFloat(v);
      if (!isNaN(n) && n > 100) v = '100';
      this.value = v;
      customFeeHandler();
    });

    // Sort
    $('#sortSelect').addEventListener('change', function () {
      state.sortKey = this.value;
      sortFiltered();
      state.page = 1;
      renderResults();
    });

    // Theme change re-renders charts
    document.addEventListener('gc:themechange', function () {
      if (state.route === 'overview') renderContinentChart();
    });

    // Sortable table headers
    $$('#dirTable thead th[data-sort]').forEach(function (th) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (k === 'name') state.sortKey = state.sortKey === 'name-asc' ? 'name-desc' : 'name-asc';
        else if (k === 'traffic') state.sortKey = state.sortKey === 'traffic-desc' ? 'traffic-asc' : 'traffic-desc';
        else if (k === 'country') state.sortKey = 'country-asc';
        $('#sortSelect').value = state.sortKey;
        sortFiltered();
        renderResults();
      });
    });
  }


  /* ─────────────────────────────────────────── PLATFORM DETAIL MODAL ─── */
  var _platformModalSite = null;

  function openPlatformModal(site) {
    _platformModalSite = site;

    /* Header */
    var flagEl = $('#pmFlag');
    if (flagEl) flagEl.textContent = site.f || '🏳️';

    var nameEl = $('#pmName');
    if (nameEl) nameEl.textContent = site.n || '';

    var urlEl = $('#pmUrl');
    if (urlEl) { urlEl.textContent = site.url || ''; urlEl.href = 'https://' + (site.url || ''); }

    var visitBtn = $('#pmVisitBtn');
    if (visitBtn) visitBtn.href = 'https://' + (site.url || '');

    /* Pills */
    var pills = '';
    if (site.t) pills += '<span class="note-meta-pill">' + esc(typeName(site.t)) + '</span>';
    if (site.c) pills += '<span class="note-meta-pill">' + (site.f || '') + ' ' + esc(site.c) + '</span>';
    if (site.g) pills += '<span class="note-meta-pill">🌍 ' + esc(site.g) + '</span>';
    var pillsEl = $('#pmPills');
    if (pillsEl) pillsEl.innerHTML = pills;

    /* Stats */
    var pmT = $('#pmTraffic'); if (pmT) pmT.textContent = site.traffic || '—';
    var pmF = $('#pmFee');     if (pmF) pmF.textContent = site.fee || '—';
    var pmC = $('#pmContinent'); if (pmC) pmC.textContent = site.g || '—';
    var pmR = $('#pmRegion');  if (pmR) pmR.textContent = site.r || '—';

    /* Feature description */
    var featEl = $('#pmFeat');
    if (featEl) {
      featEl.textContent = site.feat || '';
      featEl.style.display = site.feat ? '' : 'none';
    }

    /* Update star + fav status */
    updatePmStar();

    /* Show modal */
    var backdrop = $('#platformModalBackdrop');
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.removeAttribute('aria-hidden');
    }
  }

  function closePlatformModal() {
    var backdrop = $('#platformModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    _platformModalSite = null;
  }

  function updatePmStar() {
    if (!_platformModalSite) return;
    var siteId = _platformModalSite.url || _platformModalSite.n;
    var isFav  = window.GCFavs && window.GCFavs.has(siteId);
    var btn = $('#pmStarBtn');
    if (btn) {
      btn.classList.toggle('is-fav', isFav);
      btn.textContent = isFav ? '★' : '☆';
    }
    var statusEl = $('#pmFavStatus');
    if (statusEl) statusEl.hidden = !isFav;
    var saveFavBtn = $('#pmSaveFavBtn');
    if (saveFavBtn) {
      saveFavBtn.textContent = isFav ? '✏️ Xem / Sửa ghi chú' : '★ Lưu & Ghi chú';
    }
  }

  /* ─────────────────────────────────────────── WIRE AUTH+FAV ─── */
  function wireAuthFav() {
    // Auth modal open
    var loginBtn = $('#authLoginBtn');
    if (loginBtn) loginBtn.addEventListener('click', function () { openAuthModal('login'); });

    // ── Platform detail modal wiring ──────────────────────────────────────
    var pmClose = $('#platformModalClose');
    if (pmClose) pmClose.addEventListener('click', closePlatformModal);
    var pmClose2 = $('#platformModalClose2');
    if (pmClose2) pmClose2.addEventListener('click', closePlatformModal);
    var pmBackdrop = $('#platformModalBackdrop');
    if (pmBackdrop) pmBackdrop.addEventListener('click', function (e) {
      if (e.target === this) closePlatformModal();
    });

    /* Platform star button */
    var pmStar = $('#pmStarBtn');
    if (pmStar) pmStar.addEventListener('click', function () {
      if (!window.GCAuth || !window.GCAuth.loggedIn()) {
        openAuthModal('login');
        toast('🔑 Đăng nhập để lưu yêu thích', 'warn');
        return;
      }
      var site = _platformModalSite;
      if (!site) return;
      var siteId = site.url || site.n;
      if (window.GCFavs && window.GCFavs.has(siteId)) {
        window.GCFavs.remove(siteId).then(function() {
          updatePmStar(); updateFavBadge();
          if (state.route === 'directory') renderResults();
        });
        toast('☆ Đã xóa khỏi yêu thích');
      } else {
        window.GCFavs && window.GCFavs.add(site).then(function() {
          updatePmStar(); updateFavBadge();
          if (state.route === 'directory') renderResults();
        });
        toast('★ Đã lưu yêu thích!', 'success');
      }
    });

    /* Platform Save & Note button */
    var pmSaveFavBtn = $('#pmSaveFavBtn');
    if (pmSaveFavBtn) pmSaveFavBtn.addEventListener('click', function () {
      if (!window.GCAuth || !window.GCAuth.loggedIn()) {
        openAuthModal('login');
        toast('🔑 Đăng nhập để lưu yêu thích', 'warn');
        return;
      }
      var site = _platformModalSite;
      if (!site) return;
      var siteId = site.url || site.n;
      if (!window.GCFavs.has(siteId)) {
        window.GCFavs.add(site).then(function() {
          updateFavBadge();
          if (state.route === 'directory') renderResults();
        });
      }
      closePlatformModal();
      setTimeout(function () { openNoteModal(siteId); }, 120);
    });

    /* Platform fav-edit button */
    var pmFavEditBtn = $('#pmFavEditBtn');
    if (pmFavEditBtn) pmFavEditBtn.addEventListener('click', function () {
      if (!_platformModalSite) return;
      var siteId = _platformModalSite.url || _platformModalSite.n;
      closePlatformModal();
      setTimeout(function () { openNoteModal(siteId); }, 120);
    });
    // ── End platform modal wiring ─────────────────────────────────────────

    // Auth modal close
    var closeBtn = $('#authModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    var backdrop = $('#authModalBackdrop');
    if (backdrop) backdrop.addEventListener('click', function (e) { if (e.target === this) closeAuthModal(); });

    // Auth tab switching
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-auth-tab]');
      if (tab && $('#authModalBackdrop').classList.contains('is-open')) {
        switchAuthTab(tab.getAttribute('data-auth-tab'));
      }
    });

    // Logout
    var logoutBtn = $('#authLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      var dd = $('#authDropdown');
      if (dd) dd.hidden = true;
      if (window.GCAuth) window.GCAuth.logout();
      updateAuthUI();
      toast('👋 Đã đăng xuất thành công');
      if (state.route === 'favorites') navigate('overview');
    });

    // Password strength meter
    var regPwd = $('#regPassword');
    if (regPwd) regPwd.addEventListener('input', function () {
      var bar = $('#pwdStrength .pwd-bar');
      var label = $('#pwdStrengthLabel');
      if (!bar) return;
      var v = this.value;
      var strength = 0;
      if (v.length >= 4) strength += 25;
      if (v.length >= 8) strength += 25;
      if (/[A-Z]/.test(v) || /[0-9]/.test(v)) strength += 25;
      if (/[^a-zA-Z0-9]/.test(v)) strength += 25;
      bar.style.width = strength + '%';
      bar.style.background = strength <= 25 ? '#EF4444' : strength <= 50 ? '#F59E0B' : strength <= 75 ? '#3B82F6' : '#16A34A';
      if (label) {
        var levels = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
        var idx = Math.round(strength / 25);
        label.textContent = levels[idx] || '';
        label.style.color = bar.style.background;
      }
    });

    // Show/hide password toggles
    document.addEventListener('click', function (e) {
      var tog = e.target.closest('.pwd-toggle');
      if (!tog) return;
      var targetId = tog.getAttribute('data-target');
      var inp = $('#' + targetId);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Login form submit
    var loginForm = $('#loginForm');
    if (loginForm) loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      console.log('[Login] Form submitted');
      hideAuthError('loginError');
      var email    = ($('#loginEmail')    ? $('#loginEmail').value.trim()    : '');
      var password = ($('#loginPassword') ? $('#loginPassword').value        : '');
      console.log('[Login] Email:', email);
      setSubmitting('loginSubmitBtn', true);
      try {
        var result = await window.GCAuth.login(email, password);
        setSubmitting('loginSubmitBtn', false);
        console.log('[Login] Result:', result);
        if (!result.ok) {
          showAuthError('loginError', result.msg);
        } else {
          closeAuthModal();
          updateAuthUI();
          toast('👋 Chào mừng ' + window.GCAuth.displayName() + '!', 'success');
          if (state.route === 'directory') renderResults();
          if (state.route === 'favorites') renderFavorites();
        }
      } catch (unexpectedErr) {
        console.error('[Login] Unexpected error:', unexpectedErr);
        setSubmitting('loginSubmitBtn', false);
        showAuthError('loginError', 'Đã xảy ra lỗi không mong đợi. Vui lòng thử lại.');
      }
    });

    // Forgot password link
    var forgotBtn = $('#forgotPasswordBtn');
    if (forgotBtn) forgotBtn.addEventListener('click', async function () {
      var email = ($('#loginEmail').value || '').trim();
      if (!email) {
        showAuthError('loginError', 'Nhập email của bạn vào ô trên, rồi nhấn "Quên mật khẩu".');
        return;
      }
      forgotBtn.disabled = true;
      forgotBtn.textContent = 'Đang gửi...';
      var result = await window.GCAuth.resetPassword(email);
      forgotBtn.disabled = false;
      forgotBtn.textContent = 'Quên mật khẩu?';
      if (result.ok) {
        toast('📧 Email đặt lại mật khẩu đã gửi tới ' + email, 'success');
        var le = $('#loginError'); if (le) le.style.display = 'none';
      } else {
        showAuthError('loginError', result.msg);
      }
    });

    // Register form submit
    var registerForm = $('#registerForm');
    if (registerForm) registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      console.log('[Register] Form submitted');
      hideAuthError('registerError');
      var email       = ($('#regEmail')       ? $('#regEmail').value.trim()       : '');
      var displayName = ($('#regDisplayName') ? $('#regDisplayName').value.trim() : '');
      var password    = ($('#regPassword')    ? $('#regPassword').value           : '');
      console.log('[Register] Email:', email, '| DisplayName:', displayName || '(none)');

      /* Verify GCAuth is available before bothering Firebase */
      if (!window.GCAuth) {
        console.error('[Register] window.GCAuth is undefined — Firebase Auth did not boot. Check console for earlier errors.');
        showAuthError('registerError', 'Hệ thống xác thực chưa sẵn sàng. Kiểm tra cấu hình Firebase.');
        return;
      }

      setSubmitting('registerSubmitBtn', true);
      try {
        var result = await window.GCAuth.register(email, displayName, password);
        setSubmitting('registerSubmitBtn', false);
        console.log('[Register] Result:', result);
        if (!result.ok) {
          console.warn('[Register] Registration failed:', result.msg);
          showAuthError('registerError', result.msg);
        } else {
          closeAuthModal();
          updateAuthUI();
          var msg = '✅ Tài khoản đã tạo thành công!';
          if (result.emailVerificationSent) {
            msg += ' Email xác minh đã gửi đến ' + email + '.';
          }
          toast(msg, 'success');
          if (state.route === 'directory') renderResults();
          if (state.route === 'favorites') renderFavorites();
        }
      } catch (unexpectedErr) {
        console.error('[Register] Unexpected error:', unexpectedErr);
        setSubmitting('registerSubmitBtn', false);
        showAuthError('registerError', 'Đã xảy ra lỗi không mong đợi. Vui lòng thử lại.');
      }
    });

    // Fav login prompt
    var favPrompt = $('#favLoginPromptBtn');
    if (favPrompt) favPrompt.addEventListener('click', function () { openAuthModal('login'); });

    // Fav export
    var favExport = $('#favExportBtn');
    if (favExport) favExport.addEventListener('click', function () {
      if (!window.GCFavs) return;
      window.GCFavs.exportJSON();
      toast('↓ Đã xuất JSON thành công', 'success');
    });

    // Fav import
    var favImport = $('#favImportInput');
    if (favImport) favImport.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function (ev) {
        var r = await window.GCFavs.importJSON(ev.target.result);
        if (r.ok) {
          toast('↑ Đã nhập ' + r.count + ' yêu thích', 'success');
          updateFavBadge();
          if (state.route === 'favorites') renderFavorites();
        } else {
          toast('❌ ' + r.msg, 'error');
        }
      };
      reader.readAsText(file);
      this.value = '';
    });

    // Fav search/sort/filters
    var favSearch = $('#favSearch');
    if (favSearch) favSearch.addEventListener('input', debounce(renderFavorites, 200));
    var favSort = $('#favSortSelect');
    if (favSort) favSort.addEventListener('change', renderFavorites);
    var favPrioFilter = $('#favPriorityFilter');
    if (favPrioFilter) favPrioFilter.addEventListener('change', renderFavorites);
    var favStatusFilter = $('#favStatusFilter');
    if (favStatusFilter) favStatusFilter.addEventListener('change', renderFavorites);
    var favCountryFilter = $('#favCountryFilter');
    if (favCountryFilter) favCountryFilter.addEventListener('input', debounce(renderFavorites, 250));

    // Delegated: fav-remove buttons (direct remove without modal)
    document.addEventListener('click', async function (e) {
      var rmBtn = e.target.closest('[data-fav-remove]');
      if (rmBtn) {
        e.preventDefault();
        e.stopPropagation();
        var rmId = rmBtn.getAttribute('data-fav-remove');
        if (!rmId || !window.GCFavs) return;
        if (!confirm('Xóa sàn này khỏi yêu thích?')) return;
        await window.GCFavs.remove(rmId);
        updateFavBadge();
        toast('\uD83D\uDDD1 Đã xóa khỏi yêu thích');
        $$('.star-btn.is-fav[data-fav-site]').forEach(function (sb) {
          try {
            var d = JSON.parse(sb.getAttribute('data-fav-site'));
            if ((d.url || d.n) === rmId) { sb.classList.remove('is-fav'); sb.textContent = '\u2606'; }
          } catch(ex) {}
        });
        if (state.route === 'favorites') renderFavorites();
      }
    });

    // Note modal close
    var noteClose = $('#noteModalClose');
    if (noteClose) noteClose.addEventListener('click', closeNoteModal);
    var noteBackdrop = $('#noteModalBackdrop');
    if (noteBackdrop) noteBackdrop.addEventListener('click', function (e) { if (e.target === this) closeNoteModal(); });

    // Note textarea char count
    var noteTA = $('#noteTextarea');
    if (noteTA) noteTA.addEventListener('input', function () {
      $('#noteCharCount').textContent = this.value.length;
    });

    // Tag input
    var tagInput = $('#tagInput');
    if (tagInput) tagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(this.value);
        this.value = '';
      } else if (e.key === 'Backspace' && !this.value && _noteTags.length) {
        _noteTags.pop();
        renderTagChips();
      }
    });

    // Tag chip remove (delegated)
    document.addEventListener('click', function (e) {
      var rmBtn = e.target.closest('[data-tag-remove]');
      if (rmBtn) {
        var idx = parseInt(rmBtn.getAttribute('data-tag-remove'), 10);
        _noteTags.splice(idx, 1);
        renderTagChips();
        return;
      }
    });

    // Tag suggestions
    $$('.tag-sug').forEach(function (sug) {
      sug.addEventListener('click', function () { addTag(this.getAttribute('data-tag')); });
    });

    // Note save — gather ALL structured fields + success animation
    var noteSave = $('#noteSaveBtn');
    if (noteSave) noteSave.addEventListener('click', function () {
      if (!_noteCurrentId || !window.GCFavs) return;
      var btn = noteSave;
      var orgHTML = btn.innerHTML;
      btn.innerHTML = '<span class="btn-spinner"></span> Đang lưu...';
      btn.disabled = true;

      setTimeout(async function() {
        var statusSel = $('#noteStatus');
        var data = {
          note:        ($('#noteTextarea') ? $('#noteTextarea').value : ''),
          strategy:    ($('#noteStrategy') ? $('#noteStrategy').value : ''),
          opportunity: ($('#noteOpportunity') ? $('#noteOpportunity').value : ''),
          risk:        ($('#noteRisk') ? $('#noteRisk').value : ''),
          target:      ($('#noteTarget') ? $('#noteTarget').value : ''),
          contact:     ($('#noteContact') ? $('#noteContact').value : ''),
          priority:    _notePriority,
          status:      (statusSel ? statusSel.value : 'researching'),
          tags:        _noteTags.slice()
        };
        await window.GCFavs.saveStructured(_noteCurrentId, data);

        /* ── Success animation ── */
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Đã lưu!';
        btn.classList.add('btn-saved');
        btn.disabled = false;

        setTimeout(function () {
          btn.innerHTML = orgHTML;
          btn.classList.remove('btn-saved');
          closeNoteModal();
          toast('💾 Đã lưu ghi chú thành công!', 'success');
          if (state.route === 'favorites') renderFavorites();
          if (state.route === 'directory') renderResults();
        }, 900);
      }, 350);
    });

    // Note delete
    var noteDelete = $('#noteDeleteBtn');
    if (noteDelete) noteDelete.addEventListener('click', async function () {
      if (!_noteCurrentId || !window.GCFavs) return;
      if (!confirm('Xóa sàn này khỏi yêu thích?')) return;
      var deletedId = _noteCurrentId;
      await window.GCFavs.remove(deletedId);
      closeNoteModal();
      updateFavBadge();
      toast('🗑 Đã xóa khỏi yêu thích');
      /* Update any visible star buttons for this site */
      $$('.star-btn.is-fav[data-fav-site]').forEach(function (sb) {
        try {
          var d = JSON.parse(sb.getAttribute('data-fav-site'));
          if ((d.url || d.n) === deletedId) {
            sb.classList.remove('is-fav');
            sb.textContent = '☆';
          }
        } catch(ex) {}
      });
      if (state.route === 'favorites') renderFavorites();
      if (state.route === 'directory') renderResults();
    });

    // Delegated: star buttons + fav edit
    document.addEventListener('click', function (e) {
      var starBtn = e.target.closest('.star-btn[data-fav-site]');
      if (starBtn) { e.preventDefault(); e.stopPropagation(); handleStarClick(starBtn); return; }

      var editBtn = e.target.closest('[data-note-open]');
      if (editBtn) { e.preventDefault(); openNoteModal(editBtn.getAttribute('data-note-open')); return; }
    });

    // Priority buttons in note modal
    document.addEventListener('click', function (e) {
      var prioBtn = e.target.closest('.note-priority-btn');
      if (prioBtn) {
        _notePriority = prioBtn.getAttribute('data-priority');
        $$('.note-priority-btn').forEach(function (b) {
          b.classList.toggle('active', b === prioBtn);
        });
        return;
      }
    });

    // User dropdown toggle
    var menuBtn = $('#authMenuBtn');
    if (menuBtn) menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var dd = $('#authDropdown');
      if (!dd) return;
      var isOpen = !dd.hidden;
      dd.hidden = isOpen;
      menuBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close dropdown on outside click — check the whole auth-widget, not just the pill
    document.addEventListener('click', function (e) {
      var dd = $('#authDropdown');
      var widget = $('#authWidget');
      if (dd && !dd.hidden && widget && !widget.contains(e.target)) {
        dd.hidden = true;
        var mb = $('#authMenuBtn');
        if (mb) mb.setAttribute('aria-expanded', 'false');
      }
    });

    // Second close button in note footer
    var noteClose2 = $('#noteModalClose2');
    if (noteClose2) noteClose2.addEventListener('click', closeNoteModal);

    // Escape closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAuthModal();
        closeNoteModal();
        closePlatformModal();
        var dd = $('#authDropdown');
        if (dd) dd.hidden = true;
      }
    });

    // Subscribe to fav changes
    if (window.GCFavs) window.GCFavs.onChange(function() {
      updateFavBadge();
      if (state.route === 'directory') renderResults();
      if (state.route === 'favorites') renderFavorites();
      if (state.route === 'digital') renderDigital();
    });
    
    // Subscribe to auth changes
    document.addEventListener('gc:authchange', function() {
      updateAuthUI();
      if (state.route === 'directory') renderResults();
      if (state.route === 'favorites') renderFavorites();
    });
  }

  /* ─────────────────────────────────────────── INIT ─────────────── */
  function init() {
    wire();
    wireAuthFav();
    updateAuthUI();
    /* Initialize Firestore favorites sync (in case auth already loaded) */
    if (window.GCFavs && window.GCFavs.init) window.GCFavs.init();
    // Default route
    navigate('overview');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API for debugging
  window.GC = { state: state, data: { sites: ALL_SITES, digital: DIGITAL } };
})();
