/**
 * Firebase конфигурация.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  КАК НАСТРОИТЬ:                                          ║
 * ║                                                           ║
 * ║  1. Зайдите на https://console.firebase.google.com        ║
 * ║  2. Создайте новый проект (или используйте существующий)  ║
 * ║  3. В консоли: Build → Realtime Database → Create Database║
 * ║     - Выберите регион (eur3 для Европы)                   ║
 * ║     - Начните в "test mode" (потом настроите правила)      ║
 * ║  4. В консоли: Project Settings (шестерёнка) →            ║
 * ║     General → Your apps → Add web app (</>)               ║
 * ║  5. Скопируйте значения firebaseConfig сюда               ║
 * ╚═══════════════════════════════════════════════════════════╝
 */
var FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
