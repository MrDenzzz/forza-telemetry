# Деплой демо

[English](deploy.md) · **Русский**

Публичное демо работает на одном небольшом VPS в Docker Compose, за собственным nginx сервера:

- сайт: [forza.mrdenzzz.ru](https://forza.mrdenzzz.ru);
- его API: [forza-api.mrdenzzz.ru](https://forza-api.mrdenzzz.ru/health).

Почему устроено именно так, объясняет [ADR 0008](adr/0008-hosting-on-a-vps.ru.md).

```
браузер ── https ──▶ nginx на хосте (:443)
                       ├─ forza.mrdenzzz.ru      ─▶ 127.0.0.1:3000  web ──▶ api (история, на сервере)
                       │    └─ /media/            ─▶ файлы на диске (видео демо и его телеметрия)
                       └─ forza-api.mrdenzzz.ru  ─▶ 127.0.0.1:4000  api ──▶ postgres
```

## Что запущено

| Сервис     | Образ                     | Роль                                                                                                         |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `postgres` | `postgres:17-alpine`      | История сессий.                                                                                              |
| `migrate`  | `forza-telemetry-migrate` | Запускается при каждом старте: применяет миграции, затем импортирует демо-заезд в историю, если его там нет. |
| `api`      | `forza-telemetry-api`     | Проигрывает демо-заезд по кругу как live-поток (`TELEMETRY_SOURCE=replay`) и отдаёт историю.                 |
| `web`      | `forza-telemetry-web`     | Дашборды, история и страница демо.                                                                           |

В этом режиме API ничего не записывает (`RECORD_SESSIONS=false`), а клиенты знают, что поток — это запись. Заезд — [deploy/demo/hokubu-race.ftr.gz](../deploy/demo/hokubu-race.ftr.gz): гонка, снятая для видео демо, три круга трассы Hokubu, вырезанная из её записи командой [`pnpm trim`](../tools/replayer/README.ru.md#обрезка-записи).

CI собирает образы на каждый пуш в `main` и публикует их в GHCR с тегами `latest` и SHA коммита. Образы не привязаны к домену: контейнер web берёт публичный адрес API из `PUBLIC_API_URL` в `.env`, когда рендерит страницу.

## Что нужно

- **Linux-сервер** с Docker Engine и плагином Compose. На Ubuntu: `apt install docker.io docker-compose-v2`.
- **nginx и certbot** на хосте.
- **DNS-записи A** для обоих имён.
- **Около 2 ГБ диска:** 1,3 ГБ на образы, 240 МБ на медиа демо.

## Первый деплой

### 1. Стек

Положите `compose.yaml` и `.env.example` из репозитория в `/srv/forza-telemetry`, затем:

```sh
cd /srv/forza-telemetry
mv .env.example .env && chmod 600 .env
# В .env: POSTGRES_PASSWORD=$(openssl rand -hex 24), PUBLIC_API_URL=https://forza-api.mrdenzzz.ru
docker compose pull
docker compose up -d
curl -s http://127.0.0.1:4000/health    # "source":"recording"
```

Контейнеры слушают только `127.0.0.1`. Достучаться до них можно только через nginx.

### 2. nginx и TLS

Конфиг — [deploy/nginx/forza-telemetry.conf](../deploy/nginx/forza-telemetry.conf). Установите его как `/etc/nginx/sites-available/zz-forza-telemetry` и сделайте ссылку из `sites-enabled`.

Префикс `zz-` важен. Сервер по умолчанию на порту — первый блок, который его слушает, и им должен остаться сайт, который был там раньше.

Блокам HTTPS нужен уже выпущенный сертификат, поэтому установка идёт в три прохода:

1. Установите из файла только блок порта 80 и выполните `nginx -t && systemctl reload nginx`.
2. Выпустите один сертификат на оба имени:

   ```sh
   certbot certonly --webroot -w /var/www/letsencrypt \
     --cert-name forza.mrdenzzz.ru -d forza.mrdenzzz.ru -d forza-api.mrdenzzz.ru \
     --deploy-hook "systemctl reload nginx"
   ```

   - **`--webroot`, а не `--nginx`:** certbot не трогает конфигурацию nginx.
   - **Хук** сохраняется только в настройках продления этого сертификата.
   - **Продление** выполняет systemd-таймер certbot.

3. Установите файл целиком и снова выполните `nginx -t && systemctl reload nginx`.

Что делает конфиг:

- **`/live` проксируется как WebSocket**, с таймаутом чтения в час.
- **Журнала доступа** для этих сайтов нет.
- **В строках listen нет `http2`.** До nginx 1.25 он включается на весь порт, вместе с другими сайтами на нём.

### 3. Медиа демо

Страница демо играет видео геймплея, поверх которого нарисован дашборд. Файлы не лежат ни в git, ни в образах. Они хранятся в `/srv/forza-telemetry/media/demo`, и nginx отдаёт их по пути `/media/demo/`. Веб-приложение берёт их по адресу из `NEXT_PUBLIC_DEMO_MEDIA_URL`, по умолчанию `/media/demo`.

| Файл                    | Содержимое                                                                       |
| ----------------------- | -------------------------------------------------------------------------------- |
| `demo-1080p60.av1.webm` | Геймплей со звуком: AV1, 10 бит, около 5,4 Мбит/с, и Opus. 135 МБ.               |
| `demo-720p60.h264.mp4`  | Копия для браузеров без AV1, например Safari на старых iPhone: 109 МБ.           |
| `demo-poster.jpg`       | Картинка, которая видна, пока видео не заиграло.                                 |
| `track.json`            | Телеметрия, привязанная ко времени видео.                                        |
| `track.json.gz`         | Сжатая копия телеметрии. nginx отдаёт её вместо `track.json`: 0,7 МБ вместо 5,9. |

Файлы делаются из записи экрана (OBS) и записи телеметрии, сделанной одновременно с ней.

Сначала найдите сдвиг между двумя часами. Сравните скорость на HUD игры с записанной там, где она меняется быстрее всего, при резком торможении: там 1 км/ч — это около 10 мс. HUD отбрасывает дробную часть, дашборд тоже. В текущем демо часы видео опережают часы записи на 4,76 с. Поэтому клип, вырезанный на секундах 22,0–218,5 видео, — это секунды 17,24–213,74 записи.

```sh
SRC=capture.mp4
ffmpeg -ss 22 -to 218.5 -i "$SRC" -an -c:v libsvtav1 -preset 5 -crf 52 -g 120 \
  -pix_fmt yuv420p10le -svtav1-params tune=0 demo-1080p60.av1.webm
ffmpeg -ss 22 -to 218.5 -i "$SRC" -an -vf scale=1280:720 -c:v libx264 -preset slow -crf 28 \
  -profile:v high -pix_fmt yuv420p -movflags +faststart demo-720p60.h264.mp4
ffmpeg -ss 25 -i "$SRC" -frames:v 1 -vf scale=1280:720 demo-poster.jpg

pnpm --filter @ft/api build
node apps/api/dist/export-demo-track.js drive.ftr.gz --from 17.24 --to 213.74 > track.json
gzip -9 -k track.json
```

Страница указывает кодек AV1 точно (`av01.0.09M.10`: профиль Main, уровень 4.1, 10 бит), потому что голый `av01` браузеры отвергают. Если кодирование изменится, `ffprobe` покажет новые профиль и уровень. Обновите строку в `apps/web/src/demo/demo-player.tsx` под них.

## Обновление

```sh
cd /srv/forza-telemetry
docker compose pull && docker compose up -d
docker image prune -f    # удаляет предыдущие версии
```

Чтобы закрепить версию, укажите в `.env` `IMAGE_TAG` равным SHA коммита.

## Диск и логи

- **Логи контейнеров** идут через драйвер Docker `local`: 3 файла по 10 МБ на сервис, задано в `compose.yaml`. Собственные настройки Docker не меняются, поэтому другие контейнеры на хосте не затронуты.
- **nginx** не пишет журнал доступа для этих сайтов.
- **Старые образы** удаляются после каждого обновления (`docker image prune -f`).
- **База** хранит только импортированный демо-заезд. Бэкапы не нужны: `migrate` создаёт её заново.

## Удаление

```sh
cd /srv/forza-telemetry && docker compose down --volumes --rmi all
rm /etc/nginx/sites-enabled/zz-forza-telemetry /etc/nginx/sites-available/zz-forza-telemetry
nginx -t && systemctl reload nginx
certbot delete --cert-name forza.mrdenzzz.ru
```

## На другом домене

1. Замените имена в конфиге nginx и в команде certbot.
2. Укажите в `.env` адрес своего API в `PUBLIC_API_URL`. Образы остаются теми же.
