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
    apiKey: "AIzaSyCF5fVec-C06SXqlpH1a0RwC_V_0myllmM",
    authDomain: "atyrau-map.firebaseapp.com",
    databaseURL: "https://atyrau-map-default-rtdb.firebaseio.com",
    projectId: "atyrau-map",
    storageBucket: "atyrau-map.firebasestorage.app",
    messagingSenderId: "591737071306",
    appId: "1:591737071306:web:ed38bf498b319b320a3633"
};
