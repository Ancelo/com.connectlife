# ConnectLife (Unofficial) — Homey app

Control **ConnectLife** cloud-connected air conditioners from Homey Pro. ConnectLife
is the platform used by **Hisense, Gorenje, ASKO, ATAG and ETNA** appliances (the
ConnectLife mobile app).

> **Unofficial** — this is a community project. It is **not affiliated with,
> authorised or endorsed by** ConnectLife or Hisense.

## Features

- Power on/off
- Target temperature (16–32 °C)
- Mode: cool, heat, dry (dehumidify), fan only, auto
- Fan speed: auto, low, medium-low, medium, medium-high, high
- Vertical swing on/off
- Current (indoor) temperature

State is updated after each command. ConnectLife rate-limits frequent polling, so
background polling is **off by default** — use the *Refresh status* flow action, or
enable a long poll interval in the device settings, to pick up changes made from the
remote or the ConnectLife app.

## Pairing

Add a device → ConnectLife → enter your **ConnectLife account** username and
password. Your air conditioners are discovered automatically. Only the account's
refresh token is stored (not your password); if it expires, re-pair a device.

## Credits & license

This app is a Node.js port of the GPLv3 Python library
[oyvindwe/connectlife](https://github.com/oyvindwe/connectlife), which is itself based
on [bilan/connectlife-api-connector](https://github.com/bilan/connectlife-api-connector).
The ConnectLife AC property mapping follows
[oyvindwe/connectlife-ha](https://github.com/oyvindwe/connectlife-ha).

Licensed under **GPL-3.0-or-later** (see [LICENSE](LICENSE)). Source:
https://github.com/Ancelo/com.connectlife
