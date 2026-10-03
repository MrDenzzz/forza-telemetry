# 0008. Hosting: one VPS behind its own nginx, a replayed drive, images from CI

**English** · [Русский](0008-hosting-on-a-vps.ru.md)

- Status: Accepted
- Date: 2026-10-03

## Context

The project needs a public demo that works at any hour, while nobody plays the game. Its parts have different needs:

- **The API** needs PostgreSQL and long-lived WebSocket connections.
- **The live stream** comes from the game over UDP on a player's own network. A public server never receives it.
- **The demo page** plays a gameplay video of about 130 MB.

Many of the people who will open the demo are in Russia, where Vercel's domains have not been reliably reachable.

The author already rents a small VPS: 2 CPUs, 4 GB of memory, a 30 GB disk. Its nginx already serves another site on ports 80 and 443. Other services run on the same host, one of them in a Docker container. Whatever is added must leave all of that as it is.

## Decision

- **Everything runs on the VPS with Docker Compose:**
  - PostgreSQL;
  - a one-off `migrate` container;
  - the API;
  - the Next.js server.

  The containers publish their ports on `127.0.0.1` only.

- **The host's nginx is the entry point.** One more config file gives the stack its two domains, proxies the `/live` WebSocket, and serves the demo media from disk. The file is named so that it sorts last: an existing site stays the default server on port 443.
- **TLS comes from certbot in webroot mode.** One certificate covers both names, and its own renewal settings carry a reload hook. certbot never edits nginx's configuration.
- **The API replays a recorded drive.** It plays the drive in a loop as the live stream (`TELEMETRY_SOURCE=replay`), with the drive's original timing. The live stream says that its source is a recording, so the dashboards show it. Nothing is recorded in this mode (`RECORD_SESSIONS=false`). Instead, `migrate` imports the same drive into the history once. The import is skipped when sessions already cover that span of time.
- **CI builds the images and publishes them to GHCR.** The server only pulls them:
  - the images are public;
  - they are tagged `latest` and with the commit SHA;
  - they fit any domain: the web container reads the public API address at run time.
- **The demo video lives on the server's disk**, next to its telemetry track. It is in neither git nor the images. It is encoded as AV1 with an H.264 copy for browsers without AV1. The track is served pre-compressed.
- **The disk is protected.** Each container's log is capped at 3 × 10 MB through Docker's `local` driver, without changing Docker's own settings. These sites keep no access log, and old images are pruned after an update.

## Consequences

- **One machine is a single point of failure.** That is acceptable for a demo. The database holds only the imported drive, which `migrate` recreates, so it needs no backups.
- **Deploying is a manual `docker compose pull && docker compose up -d`.** No server key is stored in CI. For a demo that changes now and then, that trade is worth it.
- **The sites are served over HTTP/1.1.** With the nginx 1.18 on the host, `http2` on a listen line would switch the whole port, the existing site included.
- **The video has to be produced and uploaded by hand.** [docs/deploy.md](../deploy.md) lists the commands: the clip, the offset between video and telemetry, the track export.
- **The steps are written down** in [docs/deploy.md](../deploy.md), and the nginx config is kept in [deploy/nginx](../../deploy/nginx/forza-telemetry.conf).

## Alternatives considered

- **Vercel for the web app, the VPS for the API.** It would bring a CDN and preview deployments for free. But the WebSocket API has to live on the VPS anyway, Vercel's reachability from Russia is uncertain, and the demo would be split across two platforms.
- **Caddy or Traefik in the compose stack, for automatic TLS.** Either one needs ports 80 and 443, which the host's nginx holds. Put behind that nginx, it would only add a hop.
- **Building the images on the server.** That needs the whole toolchain and a build cache on a 30 GB disk, and builds are slow on 2 CPUs. CI already builds the images for every commit.
- **Deploying from CI over SSH.** Deploys would be automatic, but GitHub would hold a key to a server that also runs other services.
- **Keeping the video in the repository (Git LFS) or in the web image.** Either would make every clone or pull hundreds of megabytes larger, and the video changes on its own schedule, not with the code.
- **Streaming the live demo from a recorder on a PC.** It would show real driving, but the demo would depend on that PC being on.
