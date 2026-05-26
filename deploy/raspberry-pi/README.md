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

## tmpfs dla `/tmp` (oszczednosc cykli zapisu microSD)

Dopisz do `/etc/fstab`:

```
tmpfs   /tmp    tmpfs   defaults,noatime,nosuid,size=64M    0  0
```

Reboot. Dla Pi Zero W `size=64M` to bezpieczny rozmiar.

## Diagnostyka

```bash
# RAM zuzywany przez cncjs:
pmap -x $(pgrep -f cncjs) | tail -1

# CPU/RAM live:
htop -p $(pgrep -f cncjs)

# I/O karty SD:
iostat -x 1
```
