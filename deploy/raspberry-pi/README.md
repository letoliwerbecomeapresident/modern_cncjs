# Deploy cncjs na Raspberry Pi

Konfiguracja docelowa: **Pi Zero W** (ARMv6, single-core 1 GHz, 512 MB RAM). Plik `cncjs.service` zawiera komentarze z wariantami dla Pi 3B+ i Pi 4.

## Założenia

- Build aplikacji robisz na laptopie (`yarn build`), nie na Pi (OOM + brak prebuilt Node ARMv6).
- Wgrywasz na Pi albo globalnie (`yarn global add cncjs` / `npm i -g cncjs`) albo jako repo + `yarn install --production`.
- UI oglądasz z laptopa/tabletu w LAN; Pi tylko serwuje.

## Instalacja

```bash
# Skopiuj unit na Pi:
sudo cp cncjs.service /etc/systemd/system/cncjs.service

# (Opcjonalnie) edytuj jesli uzywasz wariantu z repo lub innego portu:
sudo nano /etc/systemd/system/cncjs.service

sudo systemctl daemon-reload
sudo systemctl enable cncjs
sudo systemctl start cncjs
```

## Weryfikacja

```bash
systemctl status cncjs
journalctl -u cncjs -f         # live log
journalctl -u cncjs --since "1 hour ago"
```

## Tuning per-platforma

W `[Service]` ustaw `NODE_OPTIONS` i `MemoryMax`:

| Platforma | RAM total | NODE_OPTIONS                       | MemoryMax |
|-----------|-----------|------------------------------------|-----------|
| Pi Zero W | 512 MB    | `--max-old-space-size=256`         | `384M`    |
| Pi 3B+    | 1 GB      | `--max-old-space-size=512`         | `768M`    |
| Pi 4 2 GB | 2 GB      | (pomin)                            | `1536M`   |
| Pi 4 4 GB+| 4–8 GB    | (pomin)                            | (pomin)   |

Bez `MemoryMax` proces dostanie OOM-kill od jadra i moze pociagnac system. Z `MemoryMax` systemd ubije sam proces; `Restart=on-failure` go podniesie.

## Rotacja logow

`journald` rotuje automatycznie. Limit rozmiaru w `/etc/systemd/journald.conf`:

```ini
[Journal]
SystemMaxUse=100M
SystemKeepFree=200M
MaxRetentionSec=30day
```

`sudo systemctl restart systemd-journald` po zmianie.

## tmpfs (oszczednosc cykli zapisu microSD)

Karta SD znosi ~100k cykli zapisu na komorke. cncjs pisze w trzy miejsca poza dist/:

| Sciezka                    | Co tam jest                              | Czestotliwosc zapisu              |
|----------------------------|------------------------------------------|-----------------------------------|
| `/tmp`                     | uploady G-code (multiparty), tmp i18next | sporadyczne, malo bajtow          |
| `~/.cncjs-sessions/`       | session-file-store (express-session)     | **na kazdy request HTTP** (resave:true) |
| journald (`/var/log/journal/`) | logi cncjs (stdout/stderr)               | per-event, ale z compaction       |

`journald` ma wbudowany SystemMaxUse/rotation, wiec to jest OK. Sesje sa hot path — **kazdy** request UI zapisuje plik sesji. Warto na tmpfs.

Dopisz do `/etc/fstab`:

```
tmpfs   /tmp                     tmpfs   defaults,noatime,nosuid,size=64M  0  0
tmpfs   /home/pi/.cncjs-sessions tmpfs   defaults,noatime,nosuid,uid=pi,gid=pi,mode=700,size=16M  0  0
```

Reboot. `size=64M` dla `/tmp` to bezpieczny rozmiar pod uploady G-code do ~50 MB. `size=16M` dla sesji w zupelnosci wystarcza (kazda sesja to par KB). `uid/gid=pi` zeby user `pi` mial wlasciciela katalogu.

**Uwaga:** sesje sa ulotne — restart Pi = wszyscy uzytkownicy musza sie zalogowac ponownie. Dla warsztatowego single-user setupu bez znaczenia.

Sprawdzenie po reboocie:

```bash
mount | grep tmpfs
# spodziewane: tmpfs on /tmp type tmpfs (...)
#              tmpfs on /home/pi/.cncjs-sessions type tmpfs (...)
```

## HTTP/2 (reverse proxy nginx)

Po split-chunks (P0.3) initial load to ~12 plikow JS/CSS + kilka async chunkow (visualizer, settings). Na HTTP/1.1 przegladarka otwiera ograniczona pule polaczen (6/host) i serializuje reszte. **HTTP/2 multiplexuje wszystkie te requesty na jednym polaczeniu** — przy tylu malych chunkach roznica w czasie do pierwszego renderu jest realna na Pi-WiFi.

cncjs (Express HTTP/1.1) **nie serwuje HTTP/2 bezposrednio**. Standardowy uklad: nginx na Pi terminuje TLS + HTTP/2 od przegladarki i proxuje do `127.0.0.1:8000` po HTTP/1.1. (HTTP/2 wymaga TLS — przegladarki nie robia h2 po czystym http.)

> Jesli serwujesz cncjs goło po LAN bez nginx — zostaje HTTP/1.1 + keep-alive (default Express), co jest OK. Ten krok ma sens dopiero gdy stawiasz reverse proxy.

### Certyfikat (LAN, self-signed)

Bez publicznego DNS wystarczy self-signed na adres IP Pi:

```bash
sudo mkdir -p /etc/nginx/certs
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/certs/cncjs.key \
  -out /etc/nginx/certs/cncjs.crt \
  -subj "/CN=cncjs.local" \
  -addext "subjectAltName=IP:192.168.1.50"   # <- IP Twojego Pi
```

Przegladarka pokaze ostrzezenie o niezaufanym certyfikacie (raz, do zaakceptowania) — dla warsztatowego LAN bez znaczenia.

### Konfiguracja nginx

`sudo apt install nginx`, potem `/etc/nginx/sites-available/cncjs`:

```nginx
upstream cncjs {
    server 127.0.0.1:8000;
    keepalive 16;
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;   # wymus HTTPS (h2 wymaga TLS)
}

server {
    listen 443 ssl;
    http2 on;                                # nginx >= 1.25.1 ; starsze: `listen 443 ssl http2;`
    server_name _;

    ssl_certificate     /etc/nginx/certs/cncjs.crt;
    ssl_certificate_key /etc/nginx/certs/cncjs.key;

    # Pliki sa juz precompresowane brotli/gzip przez Express (express-static-gzip).
    # Nie wlaczaj gzip w nginx — przepuszcza Accept-Encoding do upstreamu (default).

    location / {
        proxy_pass http://cncjs;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO — WebSocket upgrade. Przegladarka i tak otwiera WS po HTTP/1.1
    # (nginx nie proxuje WS po h2), wiec upgrade headers sa konieczne.
    location /socket.io/ {
        proxy_pass http://cncjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 86400s;            # dlugo zyjace polaczenie statusu maszyny
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cncjs /etc/nginx/sites-enabled/cncjs
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

cncjs slucha dalej na `127.0.0.1:8000` (mozesz zbindowac tylko do loopback w `cncjs.service`: `ExecStart=... --host 127.0.0.1 --port 8000`, zeby goły port nie byl wystawiony w LAN).

### Weryfikacja

```bash
# Protokol HTTP/2 dla statyku:
curl -k -sI --http2 https://192.168.1.50/ | grep -i "^HTTP"
# spodziewane: HTTP/2 200

# WebSocket Socket.IO (upgrade dziala):
curl -k -sI https://192.168.1.50/socket.io/?EIO=4\&transport=polling | grep -i "^HTTP"
# spodziewane: HTTP/2 200 (polling fallback) — a transport=websocket zestawia sie w UI
```

W DevTools → Network kolumna **Protocol** powinna pokazac `h2` dla wszystkich chunkow JS/CSS.

## Diagnostyka

```bash
# RAM zuzywany przez cncjs:
pmap -x $(pgrep -f cncjs) | tail -1

# CPU/RAM live:
htop -p $(pgrep -f cncjs)

# I/O karty SD:
iostat -x 1
```
