# Deploying the demo

**English** · [Русский](deploy.ru.md)

The hosted demo runs on one small VPS with Docker Compose, behind the server's own nginx:

- the site: [forza.mrdenzzz.ru](https://forza.mrdenzzz.ru);
- its API: [forza-api.mrdenzzz.ru](https://forza-api.mrdenzzz.ru/health).

[ADR 0008](adr/0008-hosting-on-a-vps.md) explains why it is set up this way.

```
browser ── https ──▶ nginx on the host (:443)
                       ├─ forza.mrdenzzz.ru      ─▶ 127.0.0.1:3000  web ──▶ api (history, server side)
                       │    └─ /media/            ─▶ files on disk (demo video and its telemetry)
                       └─ forza-api.mrdenzzz.ru  ─▶ 127.0.0.1:4000  api ──▶ postgres
```

## What runs

| Service    | Image                     | Role                                                                                                              |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `postgres` | `postgres:17-alpine`      | The session history.                                                                                              |
| `migrate`  | `forza-telemetry-migrate` | Runs once per start: applies migrations, then imports the demo drive into the history unless it is already there. |
| `api`      | `forza-telemetry-api`     | Replays the demo drive in a loop as the live stream (`TELEMETRY_SOURCE=replay`) and serves the history.           |
| `web`      | `forza-telemetry-web`     | The dashboards, the history and the demo page.                                                                    |

The API records nothing in this mode (`RECORD_SESSIONS=false`), and clients are told the stream is a recording. The drive is [deploy/demo/hokubu-race.ftr.gz](../deploy/demo/hokubu-race.ftr.gz): the race filmed for the demo video, three laps of the Hokubu circuit, cut from its recording with [`pnpm trim`](../tools/replayer/README.md#trimming-a-recording).

CI builds the images on every push to `main` and publishes them to GHCR, tagged `latest` and with the commit SHA. The images are not tied to a domain: the web container reads the public API address from `PUBLIC_API_URL` in `.env` as it renders a page.

## Requirements

- **A Linux server** with Docker Engine and the Compose plugin. On Ubuntu: `apt install docker.io docker-compose-v2`.
- **nginx and certbot** on the host.
- **DNS A records** for both names.
- **About 2 GB of disk:** 1.3 GB for the images, 240 MB for the demo media.

## First deployment

### 1. The stack

Put `compose.yaml` and `.env.example` from the repository into `/srv/forza-telemetry`, then:

```sh
cd /srv/forza-telemetry
mv .env.example .env && chmod 600 .env
# In .env: POSTGRES_PASSWORD=$(openssl rand -hex 24), PUBLIC_API_URL=https://forza-api.mrdenzzz.ru
docker compose pull
docker compose up -d
curl -s http://127.0.0.1:4000/health    # "source":"recording"
```

The containers listen on `127.0.0.1` only. Nothing reaches them except through nginx.

### 2. nginx and TLS

The config is [deploy/nginx/forza-telemetry.conf](../deploy/nginx/forza-telemetry.conf). Install it as `/etc/nginx/sites-available/zz-forza-telemetry` and link it from `sites-enabled`.

The `zz-` prefix matters. nginx's default server on a port is the first block that listens on it, and that has to stay the site that was there before.

The HTTPS blocks need the certificate to exist, so the install takes three passes:

1. Install only the port 80 block from the file, then run `nginx -t && systemctl reload nginx`.
2. Issue one certificate for both names:

   ```sh
   certbot certonly --webroot -w /var/www/letsencrypt \
     --cert-name forza.mrdenzzz.ru -d forza.mrdenzzz.ru -d forza-api.mrdenzzz.ru \
     --deploy-hook "systemctl reload nginx"
   ```

   - **`--webroot` rather than `--nginx`:** certbot leaves the nginx configuration alone.
   - **The hook** is saved in this certificate's renewal settings only.
   - **Renewal** is done by certbot's systemd timer.

3. Install the whole file, then run `nginx -t && systemctl reload nginx` again.

What the config does:

- **`/live` is proxied as a WebSocket**, with a read timeout of an hour.
- **There is no access log** for these sites.
- **The listen lines leave out `http2`.** Before nginx 1.25 it switches the whole port, the other sites on it included.

### 3. The demo media

The demo page plays a gameplay video with the dashboard drawn over it. The files are kept out of git and out of the images. They live in `/srv/forza-telemetry/media/demo`, and nginx serves them at `/media/demo/`. The web app reads them from `NEXT_PUBLIC_DEMO_MEDIA_URL`, which defaults to `/media/demo`.

| File                    | Contents                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `demo-1080p60.av1.webm` | The gameplay with its sound: AV1, 10-bit, about 5.4 Mbit/s, and Opus. 135 MB.                  |
| `demo-720p60.h264.mp4`  | A copy for browsers without AV1, such as Safari on older iPhones: 109 MB.                      |
| `demo-poster.jpg`       | The picture shown until the video plays.                                                       |
| `track.json`            | The telemetry, timed to the video.                                                             |
| `track.json.gz`         | A compressed copy of the telemetry. nginx serves it in place of `track.json`: 0.7 MB, not 5.9. |

The files are made from a screen capture (OBS) and the telemetry recording made alongside it.

First find the offset between the two clocks. Compare the speed in the game's HUD with the recorded speed where it changes fastest, under hard braking: there 1 km/h is about 10 ms. The HUD drops the fraction, and so does the dashboard. In the current demo the video's clock is 4.76 s ahead of the recording's. So the clip cut at seconds 22.0–218.5 of the video is seconds 17.24–213.74 of the recording.

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

The page names the AV1 codec exactly (`av01.0.09M.10`: Main profile, level 4.1, 10-bit), because browsers turn down a bare `av01`. If the encoding changes, `ffprobe` shows the new profile and level. Update the string in `apps/web/src/demo/demo-player.tsx` to match.

## Updating

```sh
cd /srv/forza-telemetry
docker compose pull && docker compose up -d
docker image prune -f    # removes the previous versions
```

To pin a version, set `IMAGE_TAG` in `.env` to a commit SHA.

## Disk and logs

- **Container logs** go through Docker's `local` driver: 3 files of 10 MB per service, set in `compose.yaml`. Docker's own settings stay untouched, so other containers on the host are not affected.
- **nginx** writes no access log for these sites.
- **Old images** are removed after each update (`docker image prune -f`).
- **The database** holds only the imported demo drive. It needs no backups: `migrate` recreates it.

## Removing

```sh
cd /srv/forza-telemetry && docker compose down --volumes --rmi all
rm /etc/nginx/sites-enabled/zz-forza-telemetry /etc/nginx/sites-available/zz-forza-telemetry
nginx -t && systemctl reload nginx
certbot delete --cert-name forza.mrdenzzz.ru
```

## On another domain

1. Replace the names in the nginx config and in the certbot command.
2. Set `PUBLIC_API_URL` in `.env` to your API's address. The images stay the same.
