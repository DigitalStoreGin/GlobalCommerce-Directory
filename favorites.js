/* ═══════════════════════════════════════════════════════════════════
   GlobalCommerce — Favorites Manager v4.0 (Firebase / Firestore)
   ──────────────────────────────────────────────────────────────────
   - Firestore real-time sync: changes appear on ALL devices instantly
   - Local in-memory cache for sync reads (GCFavs.has / GCFavs.all)
   - Optimistic updates: UI responds immediately, Firestore writes async
   - Batch import support
   - Same public API as v3 — drop-in replacement
   - Data path: users/{uid}/favorites/{favId}
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ──────────────────────────── FIRESTORE HELPERS ── */
  function db()       { return firebase.firestore(); }
  function favsRef(uid) {
    return db().collection('users').doc(uid).collection('favorites');
  }

  /* ──────────────────────────── LOCAL CACHE ── */
  /* In-memory mirror of Firestore data — kept up-to-date by onSnapshot.
     Allows synchronous reads (has / all / get) just like localStorage. */
  var _cache       = {};   /* { [id]: favoriteObject } */
  var _unsubscribe = null; /* current Firestore listener cleanup fn */
  var _currentUid  = null; /* uid of the currently subscribed user */

  /* ──────────────────────────── REAL-TIME SYNC ── */
  function startSync(uid) {
    /* Tear down any previous listener */
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
    _cache      = {};
    _currentUid = uid;

    if (!uid) { Fav._emit(); return; } /* logged out — clear cache */

    /* Subscribe to Firestore — fires immediately with initial data,
       then again whenever any favorite is added / changed / removed */
    _unsubscribe = favsRef(uid).onSnapshot(
      function (snap) {
        _cache = {};
        snap.forEach(function (doc) {
          _cache[doc.id] = Object.assign({ id: doc.id }, doc.data());
        });
        Fav._emit();
      },
      function (err) {
        /* This fires if Firestore rules deny access (e.g. after logout) */
        if (err.code !== 'permission-denied') {
          console.warn('GC Firestore sync error:', err.code, err.message);
        }
        _cache = {};
        Fav._emit();
      }
    );
  }

  /* React to login / logout */
  document.addEventListener('gc:authchange', function (e) {
    var type = e.detail && e.detail.type;
    var uid  = (window.GCAuth && window.GCAuth.loggedIn())
               ? window.GCAuth.userKey()
               : null;

    if (uid !== _currentUid) {
      /* Clear cache immediately so stale data is never shown */
      _cache = {};
      startSync(uid);
    }

    if (type === 'logout') {
      /* Hard-clear to be safe */
      _cache = {};
      Fav._emit();
    }
  });

  /* ──────────────────────────── PUBLIC API ── */
  var Fav = {

    /* ── Synchronous reads (from local cache) ── */

    all: function () {
      return Object.keys(_cache)
        .map(function (k) { return _cache[k]; })
        .sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    },

    has: function (id) { return !!_cache[id]; },

    get: function (id) { return _cache[id] || null; },

    /* ── Add / update a favorite ── */
    add: async function (site, note, tags) {
      var uid = window.GCAuth ? window.GCAuth.userKey() : null;
      if (!uid || uid === '__anon__') return;

      var id   = site.url || site.n;
      var prev = _cache[id] || {};

      var data = {
        id:         id,
        n:          site.n          || '',
        url:        site.url        || '',
        f:          site.f          || '',
        c:          site.c          || '',
        g:          site.g          || '',
        t:          site.t          || '',
        traffic:    site.traffic    || '',
        fee:        site.fee        || '',
        feat:       site.feat       || '',
        note:       note    !== undefined ? note    : (prev.note    || ''),
        tags:       tags    !== undefined ? tags    : (prev.tags    || []),
        strategy:   prev.strategy   || '',
        opportunity:prev.opportunity|| '',
        risk:       prev.risk       || '',
        target:     prev.target     || '',
        contact:    prev.contact    || '',
        priority:   prev.priority   || 'high',
        status:     prev.status     || 'researching',
        savedAt:    prev.savedAt    || Date.now(),
        updatedAt:  Date.now()
      };

      /* Optimistic update: reflect change in cache immediately */
      _cache[id] = data;
      Fav._emit();

      /* Persist to Firestore (async) */
      try {
        await favsRef(uid).doc(id).set(data);
      } catch (e) {
        console.error('GC favorites.add error:', e);
      }
    },

    /* ── Remove a favorite ── */
    remove: async function (id) {
      var uid = window.GCAuth ? window.GCAuth.userKey() : null;
      if (!uid || uid === '__anon__') return;

      /* Optimistic delete */
      delete _cache[id];
      Fav._emit();

      try {
        await favsRef(uid).doc(id).delete();
      } catch (e) {
        console.error('GC favorites.remove error:', e);
      }
    },

    /* ── Toggle ── */
    toggle: async function (site) {
      var id = site.url || site.n;
      if (Fav.has(id)) { await Fav.remove(id); return false; }
      await Fav.add(site);
      return true;
    },

    /* ── Save structured note / metadata ── */
    saveStructured: async function (id, data) {
      var uid = window.GCAuth ? window.GCAuth.userKey() : null;
      if (!uid || uid === '__anon__' || !_cache[id]) return;

      /* Fields that may be updated */
      var fields = ['note', 'strategy', 'opportunity', 'risk',
                    'target', 'contact', 'priority', 'status', 'tags'];

      /* Merge into local cache */
      fields.forEach(function (f) {
        if (data.hasOwnProperty(f)) _cache[id][f] = data[f];
      });
      _cache[id].updatedAt = Date.now();
      Fav._emit();

      /* Build Firestore update payload */
      var update = { updatedAt: _cache[id].updatedAt };
      fields.forEach(function (f) {
        if (data.hasOwnProperty(f)) update[f] = data[f];
      });

      try {
        await favsRef(uid).doc(id).update(update);
      } catch (e) {
        console.error('GC favorites.saveStructured error:', e);
      }
    },

    /* ── JSON export (downloads file) ── */
    exportJSON: function () {
      var uid = window.GCAuth ? window.GCAuth.userKey() : 'anon';
      var payload = {
        user:      uid,
        exported:  new Date().toISOString(),
        version:   4,
        favorites: Fav.all()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'gc_favorites_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /* ── JSON import (merge into Firestore via batch) ── */
    importJSON: async function (jsonStr) {
      var uid = window.GCAuth ? window.GCAuth.userKey() : null;
      if (!uid || uid === '__anon__') return { ok: false, msg: 'Chưa đăng nhập.' };

      try {
        var obj   = JSON.parse(jsonStr);
        var items = obj.favorites || (Array.isArray(obj) ? obj : []);
        var valid = items.filter(function (it) { return it.id && it.url; });
        if (!valid.length) return { ok: false, msg: 'File không chứa dữ liệu yêu thích hợp lệ.' };

        /* Firestore batch supports up to 500 ops at a time */
        var CHUNK = 400;
        for (var i = 0; i < valid.length; i += CHUNK) {
          var chunk = valid.slice(i, i + CHUNK);
          var batch = db().batch();
          chunk.forEach(function (it) {
            batch.set(favsRef(uid).doc(it.id), it);
          });
          await batch.commit();
        }

        return { ok: true, count: valid.length };
      } catch (e) {
        console.error('GC favorites.importJSON error:', e);
        return { ok: false, msg: 'File JSON không hợp lệ hoặc đã xảy ra lỗi khi nhập.' };
      }
    },

    /* ── Initialize: start sync if user is already logged in ── */
    init: function () {
      /* GCAuth.boot() may have already fired before GCFavs loaded.
         Check current auth state now and start sync if needed. */
      if (window.GCAuth && window.GCAuth.loggedIn()) {
        startSync(window.GCAuth.userKey());
      }
    },

    /* ── Event system ── */
    _cbs: [],
    onChange: function (fn) { Fav._cbs.push(fn); },
    _emit:    function ()   { Fav._cbs.forEach(function (fn) { try { fn(); } catch(e) {} }); }
  };

  window.GCFavs = Fav;
})();
