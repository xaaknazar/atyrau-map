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
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};
