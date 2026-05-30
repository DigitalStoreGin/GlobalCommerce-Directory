/* ═══════════════════════════════════════════════════════════════════
   GlobalCommerce — Firebase Configuration
   ──────────────────────────────────────────────────────────────────
   BƯỚC QUAN TRỌNG: Thay thế các giá trị bên dưới bằng thông tin
   Firebase project của bạn.

   Cách lấy thông tin:
   1. Vào https://console.firebase.google.com
   2. Chọn project của bạn
   3. Project Settings (⚙️) → General → Your apps → Web app
   4. Copy firebaseConfig object vào đây
   ═══════════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey:            "AIzaSyCRBBdiNDFtUnFCgq6-VXYpH58yyigSFYE",
  authDomain:        "globalcommerce-directory.firebaseapp.com",
  projectId:         "globalcommerce-directory",
  storageBucket:     "globalcommerce-directory.firebasestorage.app",
  messagingSenderId: "82890836334",
  appId:             "1:82890836334:web:9fe77c93e358e7bd66597f",
  measurementId:     "G-RMC54BBWVQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Enable Firestore offline persistence (for better UX)
firebase.firestore().enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open — persistence only works in one tab at a time
      console.warn('GC: Firestore persistence disabled (multiple tabs).');
    } else if (err.code === 'unimplemented') {
      // Browser does not support persistence
      console.warn('GC: Firestore persistence not supported in this browser.');
    }
  });
