/* ═══════════════════════════════════════════════════════════════════
   GlobalCommerce — Auth System v4.1 (Firebase)
   ──────────────────────────────────────────────────────────────────
   - Firebase Authentication (Email + Password)
   - Session persistence handled automatically by Firebase SDK
   - Cross-device sync: login on any device, same account
   - Password reset via email
   - Email verification on register
   - Same public API as v3 (GCAuth.*) — drop-in replacement
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ──────────────────────────── FIREBASE REF ── */
  function getFireAuth() { return firebase.auth(); }
  function getFirestore() { return firebase.firestore(); }

  /* ──────────────────────────── DEBUG LOGGER ── */
  var LOG_PREFIX = '[GCAuth]';
  function log()  { var a = [LOG_PREFIX]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.log.apply(console, a); }
  function warn() { var a = [LOG_PREFIX]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.warn.apply(console, a); }
  function err()  { var a = [LOG_PREFIX]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.error.apply(console, a); }

  /* ──────────────────────────── FIREBASE HEALTH CHECK ── */
  function checkFirebaseInit() {
    try {
      if (typeof firebase === 'undefined') {
        err('Firebase SDK is NOT loaded. Check CDN script tags in index.html.');
        return false;
      }
      if (!firebase.apps || firebase.apps.length === 0) {
        err('Firebase app is NOT initialized. Check firebase-config.js.');
        return false;
      }
      var cfg = firebase.app().options;
      if (!cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
        err('Firebase API key is still a placeholder. Fill in firebase-config.js with your real project credentials.');
        return false;
      }
      if (!cfg.projectId || cfg.projectId === 'YOUR_PROJECT_ID') {
        err('Firebase projectId is still a placeholder. Fill in firebase-config.js with your real project credentials.');
        return false;
      }
      log('Firebase initialized OK. Project:', cfg.projectId, '| Auth domain:', cfg.authDomain);
      return true;
    } catch (e) {
      err('Firebase health check threw:', e.message);
      return false;
    }
  }

  /* ──────────────────────────── ERROR TRANSLATIONS ── */
  function currentDomain() {
    try { return window.location.hostname || 'unknown'; } catch(e) { return 'unknown'; }
  }

  var ERROR_MAP = {
    'auth/user-not-found':        'Email không tồn tại. Hãy đăng ký tài khoản mới.',
    'auth/wrong-password':        'Sai mật khẩu. Vui lòng thử lại.',
    'auth/invalid-credential':    'Email hoặc mật khẩu không đúng.',
    'auth/email-already-in-use':  'Email này đã được đăng ký. Hãy đăng nhập.',
    'auth/invalid-email':         'Địa chỉ email không hợp lệ.',
    'auth/weak-password':         'Mật khẩu quá yếu. Cần ít nhất 6 ký tự.',
    'auth/too-many-requests':     'Quá nhiều lần thử. Vui lòng chờ vài phút rồi thử lại.',
    'auth/network-request-failed':'Lỗi kết nối mạng. Kiểm tra internet và thử lại.',
    'auth/user-disabled':         'Tài khoản này đã bị vô hiệu hóa.',
    'auth/operation-not-allowed': 'Phương thức đăng nhập Email/Password chưa được bật. Vào Firebase Console → Authentication → Sign-in method → Email/Password → Enable.',
    'auth/requires-recent-login': 'Cần đăng nhập lại để thực hiện thao tác này.',
    'auth/invalid-api-key':       'API key Firebase không hợp lệ. Kiểm tra file firebase-config.js.'
  };

  function translateError(e) {
    var code = (e && e.code) || '';
    err('Firebase error code:', code, '| message:', (e && e.message) || '');
    var domain = currentDomain();
    /* Domain-specific errors: show the exact domain to add in Firebase Console */
    if (code === 'auth/unauthorized-domain' || code === 'auth/configuration-not-found') {
      err('Current domain:', domain, '— needs to be added to Firebase Authorized Domains.');
      return 'Domain "' + domain + '" chưa được phép. Vào Firebase Console → Authentication → Settings → Authorized domains → Add domain → nhập "' + domain + '".';
    }
    return ERROR_MAP[code] || (e && e.message) || 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }



  /* ──────────────────────────── EVENT ── */
  function emitChange(type) {
    log('Emitting gc:authchange →', type);
    try {
      document.dispatchEvent(new CustomEvent('gc:authchange', { detail: { type: type } }));
    } catch(e) {}
  }

  /* ──────────────────────────── API ── */
  var Auth = {
    _user: null,       /* { uid, email, displayName } */
    _ready: false,     /* true once onAuthStateChanged fires for the first time */
    _readyCallbacks: [],

    /* ── Called once: boots Firebase Auth listener ── */
    boot: function () {
      log('Booting...');
      var healthy = checkFirebaseInit();
      if (!healthy) {
        warn('Skipping Firebase Auth boot due to initialization errors above.');
        Auth._ready = true; /* mark ready so the app doesn't hang */
        return;
      }

      /* Configure session persistence: LOCAL = survives browser restarts */
      getFireAuth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(function () { log('Session persistence set to LOCAL'); })
        .catch(function (e) {
          warn('Could not set persistence (may already be set):', e.message);
        });

      /* Auth state listener — fires immediately with current user */
      getFireAuth().onAuthStateChanged(function (firebaseUser) {
        if (firebaseUser) {
          log('Auth state → logged in | uid:', firebaseUser.uid,
              '| email:', firebaseUser.email,
              '| emailVerified:', firebaseUser.emailVerified);
          Auth._user = {
            uid:           firebaseUser.uid,
            email:         firebaseUser.email || '',
            displayName:   firebaseUser.displayName || (firebaseUser.email || '').split('@')[0] || 'User',
            emailVerified: firebaseUser.emailVerified
          };
          emitChange('login');
        } else {
          log('Auth state → logged out');
          Auth._user = null;
          emitChange('logout');
        }

        /* Mark as ready and flush queued callbacks */
        if (!Auth._ready) {
          log('Auth is now ready');
          Auth._ready = true;
          var cbs = Auth._readyCallbacks.slice();
          Auth._readyCallbacks = [];
          cbs.forEach(function (cb) { try { cb(); } catch(e) {} });
        }
      }, function (error) {
        err('onAuthStateChanged error:', error.code, error.message);
      });
    },

    /* Run fn when auth state is known (immediately if already ready) */
    onReady: function (fn) {
      if (Auth._ready) { try { fn(); } catch(e) {} }
      else { Auth._readyCallbacks.push(fn); }
    },

    /* ── Getters ── */
    loggedIn:      function () { return !!Auth._user; },
    displayName:   function () { return Auth._user ? Auth._user.displayName : ''; },
    email:         function () { return Auth._user ? Auth._user.email : ''; },
    userKey:       function () { return Auth._user ? Auth._user.uid : '__anon__'; },
    emailVerified: function () { return Auth._user ? !!Auth._user.emailVerified : false; },
    avatar:        function () {
      if (!Auth._user) return '?';
      return (Auth._user.displayName || Auth._user.email || 'U').charAt(0).toUpperCase();
    },

    /* ── Register new account ── */
    register: async function (email, displayName, password) {
      log('register() called | email:', email, '| displayName:', displayName || '(none)');

      /* ── Step 1: Local validation ── */
      if (!email || !password) {
        warn('register() validation failed: missing email or password');
        return { ok: false, msg: 'Vui lòng nhập email và mật khẩu.' };
      }
      email = email.trim().toLowerCase();
      displayName = (displayName || '').trim() || email.split('@')[0];
      if (password.length < 6) {
        warn('register() validation failed: password too short (' + password.length + ' chars)');
        return { ok: false, msg: 'Mật khẩu cần ít nhất 6 ký tự.' };
      }

      /* ── Step 2: Check Firebase is ready ── */
      if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
        err('register() failed: Firebase not initialized');
        return { ok: false, msg: 'Firebase chưa được khởi động. Kiểm tra file firebase-config.js.' };
      }

      try {
        /* ── Step 3: Create Firebase Auth user ── */
        log('register() → calling createUserWithEmailAndPassword...');
        var cred = await getFireAuth().createUserWithEmailAndPassword(email, password);
        log('register() → Firebase user created | uid:', cred.user.uid);

        /* ── Step 4: Set display name ── */
        log('register() → updating displayName to:', displayName);
        await cred.user.updateProfile({ displayName: displayName });
        log('register() → displayName updated');

        /* ── Step 5: Send verification email ── */
        log('register() → sending email verification...');
        try {
          await cred.user.sendEmailVerification();
          log('register() → verification email sent to:', email);
        } catch (verifyErr) {
          /* Non-fatal: account was created, just log the warning */
          warn('register() → verification email failed (non-fatal):', verifyErr.code, verifyErr.message);
        }

        /* ── Step 6: Save user profile to Firestore ── */
        log('register() → saving profile to Firestore...');
        await getFirestore().collection('users').doc(cred.user.uid).set({
          email:       email,
          displayName: displayName,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
        log('register() → Firestore profile saved');

        /* onAuthStateChanged will update Auth._user automatically */
        log('register() → complete! ✅');
        return { ok: true, emailVerificationSent: true };

      } catch (e) {
        err('register() → caught error:', e.code, e.message);
        return { ok: false, msg: translateError(e) };
      }
    },

    /* ── Login ── */
    login: async function (email, password) {
      log('login() called | email:', email);
      if (!email || !password) return { ok: false, msg: 'Vui lòng nhập đầy đủ thông tin.' };
      email = email.trim().toLowerCase();

      if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
        err('login() failed: Firebase not initialized');
        return { ok: false, msg: 'Firebase chưa được khởi động. Kiểm tra file firebase-config.js.' };
      }

      try {
        log('login() → calling signInWithEmailAndPassword...');
        await getFireAuth().signInWithEmailAndPassword(email, password);
        log('login() → success ✅');
        /* onAuthStateChanged will update Auth._user automatically */
        return { ok: true };
      } catch (e) {
        err('login() → caught error:', e.code, e.message);
        return { ok: false, msg: translateError(e) };
      }
    },

    /* ── Logout ── */
    logout: function () {
      log('logout() called');
      return getFireAuth().signOut().catch(function (e) {
        err('logout() error:', e);
      });
    },

    /* ── Password reset ── */
    resetPassword: async function (email) {
      log('resetPassword() called | email:', email);
      if (!email) return { ok: false, msg: 'Vui lòng nhập địa chỉ email.' };
      email = email.trim().toLowerCase();
      try {
        await getFireAuth().sendPasswordResetEmail(email);
        log('resetPassword() → email sent ✅');
        return { ok: true };
      } catch (e) {
        err('resetPassword() → error:', e.code, e.message);
        return { ok: false, msg: translateError(e) };
      }
    }
  };

  Auth.boot();
  window.GCAuth = Auth;
  log('window.GCAuth is ready');
})();
