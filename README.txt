Control your ConnectLife air conditioners from Homey.

ConnectLife is the cloud platform used by air conditioners from Hisense, Gorenje, ASKO, ATAG and ETNA (the ConnectLife mobile app). This app connects Homey to that cloud so you can control your AC units directly and use them in Flows.

FEATURES
- Power on/off
- Target temperature (16-32 C)
- Mode: cool, heat, dry (dehumidify), fan only, auto
- Fan speed: auto, low, medium-low, medium, medium-high, high
- Vertical swing on/off
- Current (indoor) temperature
- Flow cards: triggers, conditions and actions for mode, fan speed and swing

HOW IT WORKS
Add a device, choose ConnectLife, and sign in with your ConnectLife account (the same username and password as the ConnectLife app). Your air conditioners are discovered automatically. Only the account's refresh token is stored, never your password.

The app talks to the ConnectLife cloud, which does not push updates and dislikes frequent polling, so device state refreshes after each command. To pick up changes made from the remote or the ConnectLife app, use the "Refresh status from cloud" Flow action, or enable a long background-refresh interval in the device settings (off by default).

UNOFFICIAL
This is a community-built app. It is not affiliated with, authorised or endorsed by ConnectLife, Hisense, Gorenje, ASKO, ATAG or ETNA. All trademarks belong to their respective owners.

Open source (GPL-3.0-or-later): https://github.com/Ancelo/com.connectlife
It is a port of the GPLv3 Python library github.com/oyvindwe/connectlife, based on github.com/bilan/connectlife-api-connector.
