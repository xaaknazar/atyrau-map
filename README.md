# Цифровая карта прокуратуры города Атырау

Интерактивная веб-карта для мониторинга безопасности городской среды города Атырау. Отображает проблемные точки: слепые зоны (без камер видеонаблюдения), заброшенные здания и неосвещённые улицы.

## Возможности

- **Интерактивная карта** на базе Leaflet с кластеризацией маркеров
- **Тепловая карта** для визуализации плотности проблемных зон
- **3 слоя карты** — улицы, спутник, тёмная тема
- **Двуязычный интерфейс** — русский / қазақша
- **Поиск** по улицам и координатам
- **Категории точек**: слепые зоны, заброшенные здания, неосвещённые улицы
- **Админ-панель** для управления точками (добавление, удаление, модерация)
- **Обратная связь** — граждане могут предлагать проблемные точки
- **PWA** — установка как приложение на телефон
- **Firebase Realtime Database** — данные синхронизируются в реальном времени

## Технологии

- HTML / CSS / JavaScript (без фреймворков)
- [Leaflet](https://leafletjs.com/) — интерактивная карта
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) — кластеризация
- [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) — тепловая карта
- [Firebase Realtime Database](https://firebase.google.com/docs/database) — облачное хранилище данных

## Структура проекта

```
├── index.html              # Главная страница с картой
├── admin-points.html       # Админ-панель управления точками
├── manifest.json           # PWA-манифест
├── css/
│   └── style.css           # Стили приложения
├── js/
│   ├── app.js              # Основная логика приложения
│   ├── data.js             # Слой хранения данных (Firebase / localStorage)
│   ├── firebase-config.js  # Конфигурация Firebase (заполнить свои данные)
│   ├── i18n.js             # Локализация (рус / қаз)
│   └── photos.js           # Работа с фотографиями точек
└── images/                 # Иконки и изображения
```

## Установка и запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/xaaknazar/atyrau-map.git
cd atyrau-map
```

### 2. Настроить Firebase

1. Создайте проект на [Firebase Console](https://console.firebase.google.com)
2. Включите **Realtime Database** (Build → Realtime Database → Create Database)
3. В настройках проекта создайте веб-приложение и скопируйте конфигурацию
4. Вставьте свои данные в `js/firebase-config.js`:

```js
var FIREBASE_CONFIG = {
    apiKey: "ваш_api_key",
    authDomain: "ваш_проект.firebaseapp.com",
    databaseURL: "https://ваш_проект-default-rtdb.firebaseio.com",
    projectId: "ваш_проект",
    storageBucket: "ваш_проект.firebasestorage.app",
    messagingSenderId: "ваш_sender_id",
    appId: "ваш_app_id"
};
```

### 3. Задать пароль администратора

Замените `YOUR_ADMIN_PASSWORD` на свой пароль в двух файлах:
- `js/app.js` — строка 5
- `admin-points.html` — строка 557

### 4. Запустить

Откройте `index.html` в браузере или используйте любой локальный сервер:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

> Без Firebase приложение работает в offline-режиме с localStorage.

## Скриншот

![Карта](images/placeholders/logos.jpeg)

## Лицензия

MIT
