# capture-daemon

A loopback bridge that lets the admin console **run a capture with one click**
instead of copy-pasting a command into a terminal.

## Why it exists

The admin console is served from `https://www.constello.xyz`; the capture scripts
run on your machine. A web page can't shell out, so this daemon listens on
`http://127.0.0.1:4599` and the console's **Run** buttons POST to it. It then runs
the exact same commands the Copy-command blocks show.

It only runs a fixed set of commands built from structured params (never an
arbitrary string), binds to loopback only, and gates callers by origin.

## Run it

```sh
cd apps/capture-daemon
npm start          # keep it running while you fulfil readings
```

Then in the admin console click **Run on this machine** on a pending Pinterest or
X entry. The capture prints its progress in this daemon's terminal.

## Browser support

Works in **Chrome / Edge** (they allow `https://…` → `http://localhost` and we
answer the Private Network Access preflight). **Safari / Firefox** block it — there,
use the **Copy command** fallback that's still shown beside each button.

## Config (env)

| var             | default                                                  |
| --------------- | -------------------------------------------------------- |
| `PORT`          | `4599`                                                   |
| `PINTEREST_DIR` | `~/Documents/constello build/apps/pinterest-capture`     |
| `TWITTER_DIR`   | `~/Documents/twitter-preservation`                       |
| `ALLOW_ORIGIN`  | extra origin to allow (prod + localhost already allowed) |

The X bridge needs the admin password: the console sends the one it already holds,
or set `CONSTELLO_ADMIN_PASSWORD` in this daemon's env as a fallback.

## Routes

- `GET /health` → `{ ok: true }`
- `POST /pinterest` `{ boardUrl }`
- `POST /x-bridge` `{ handle, constellationId, adminPassword }`
