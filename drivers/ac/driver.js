'use strict';

const Homey = require('homey');
const connectlife = require('../../lib/connectlife-api');

const SETTING_REFRESH_TOKEN = 'connectlife_refresh_token';

class ConnectLifeACDriver extends Homey.Driver {
  async onInit() {
    this.log('ConnectLife AC driver initialized');
  }

  // Single shared API client for the whole account (all AC devices), built from
  // the stored refresh token. Coalesced token handling lives in the client.
  getApi() {
    if (this._api) return this._api;
    const refreshToken = this.homey.settings.get(SETTING_REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('Not signed in to ConnectLife; please re-pair a device.');
    }
    this._api = this._buildApi({ refreshToken });
    return this._api;
  }

  _buildApi(opts) {
    return new connectlife.ConnectLifeApi(
      Object.assign(
        {
          onTokens: ({ refreshToken }) => {
            if (refreshToken) this.homey.settings.set(SETTING_REFRESH_TOKEN, refreshToken);
          },
        },
        opts
      )
    );
  }

  async onPair(session) {
    this.log('onPair() called - pairing session started');
    let api = null;
    let appliances = []; // raw AC appliance objects

    session.setHandler('login', async (data) => {
      const username = ((data && data.username) || '').trim();
      const password = (data && data.password) || '';
      this.log('login handler: credentials for', username || '(empty)');
      if (!username || !password) throw new Error('Enter your ConnectLife account username and password.');

      api = this._buildApi({ username, password });
      await api.login(); // full Gigya + OAuth flow; throws on bad credentials
      this.log('login handler: ConnectLife login OK');

      // Persist the refresh token and adopt this client as the shared one.
      this.homey.settings.set(SETTING_REFRESH_TOKEN, api.getRefreshToken());
      this._api = api;

      const all = await api.getAppliances();
      appliances = all.filter((a) => a.deviceTypeCode === connectlife.DEVICE_TYPE_AC);
      this.log(`login handler: ${all.length} appliances, ${appliances.length} air conditioners`);
      if (!appliances.length) throw new Error('No air conditioners found on this ConnectLife account.');
      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!appliances.length) throw new Error('Not logged in.');
      return appliances.map((a) => {
        const name = (a.deviceNickName || a.deviceTypeName || a.deviceId || '').trim() || a.deviceId;
        // Log the raw property set so we can finalise the capability mapping
        // for this specific model (feature code) — properties are device-specific.
        this.log(`AC "${name}" [type=${a.deviceTypeCode} feature=${a.deviceFeatureCode}] statusList:`,
          JSON.stringify(a.statusList));
        return {
          name,
          data: { id: a.deviceId },
          store: { puid: a.puid, deviceFeatureCode: a.deviceFeatureCode },
        };
      });
    });
  }
}

module.exports = ConnectLifeACDriver;
