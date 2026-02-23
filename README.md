# Городской убийца

Детективная настольная игра для двух игроков в браузере. Режим «Логика»: аналитическое противостояние Убийцы и Детектива.

## Стек

- Чистый JavaScript (ES-модули)
- Vite 7 — сборщик и dev-сервер
- Нет бэкенда, нет базы данных

---

## Запуск без Docker

### Требования

- Node.js >= 18 (рекомендуется LTS 20 или 22)
- npm >= 9

### Разработка (dev-сервер с hot reload)

```bash
# 1. Клонировать репозиторий
git clone <url> game
cd game

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер
npm run dev
```

Открыть в браузере: **http://localhost:5173**

- `http://localhost:5173/` — главное меню
- `http://localhost:5173/map.html` — игровое поле

### Production-сборка

```bash
# Собрать статику в папку dist/
npm run build

# Посмотреть собранную версию локально
npm run preview
```

После `npm run build` папка `dist/` готова для деплоя на любой статик-сервер.  
Файлы `data/*.json` автоматически копируются в `dist/data/` через Vite-плагин в `vite.config.js`.

---

## Запуск с Docker

### Требования

- Docker Desktop >= 24 (Windows/macOS) или Docker Engine (Linux)

### Сборка образа

```bash
docker build -t urban-killer .
```

### Запуск контейнера

```bash
docker run -d -p 8080:80 --name game urban-killer
```

Открыть в браузере:

- **http://localhost:8080** — главное меню
- **http://localhost:8080/map.html** — игровое поле

### Остановка и удаление контейнера

```bash
docker stop game && docker rm game
```

### Пересборка после изменений

```bash
docker stop game && docker rm game
docker build -t urban-killer .
docker run -d -p 8080:80 --name game urban-killer
```

---

## Структура проекта

```
game/
├── index.html              — главное меню
├── map.html                — игровое поле
├── src/
│   ├── main.js             — инициализация карты, игровой цикл
│   ├── start_game.js       — стартовая страница
│   ├── style/global.css
│   └── scripts/
│       ├── api.js          — REST API (заглушки)
│       ├── move.js         — формирование ходов
│       ├── check.js        — проверки допустимости
│       ├── rules_game.js   — правила режима «Логика»
│       ├── initialization_game.js — подготовка партии
│       └── receiving_data.js — DOM-утилиты карты
├── data/
│   ├── characters.json     — 24 персонажа
│   ├── districts.json      — 16 районов (4×4)
│   ├── motives.json        — 12 мотивов (6 для режима «Логика»)
│   ├── building.json       — 8 зданий с привязкой к районам
│   ├── social_group.json   — 9 соцгрупп
│   └── game_state_example.json — эталон формата состояния
├── Dockerfile
├── nginx.conf
├── vite.config.js
└── ARCHITECTURE.md         — архитектура проекта
```

---

## Игра (режим «Логика»)

Убийца совершает 5 убийств, соблюдая выбранный мотив. Детектив после пятого убийства называет личность убийцы и мотив. Оба ответа верны — побеждает Детектив; иначе — Убийца.

Подробнее — в [ARCHITECTURE.md](ARCHITECTURE.md).
