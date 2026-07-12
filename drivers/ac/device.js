'use strict';

const Homey = require('homey');

// ConnectLife AC (device type 009) properties and value encodings, confirmed
// from the reference data dictionaries and the live statusList dumps.
const PROP = {
  POWER: 't_power',
  TARGET_TEMP: 't_temp',
  INDOOR_TEMP: 'f_temp_in',
  WORK_MODE: 't_work_mode',
  FAN_SPEED: 't_fan_speed',
  SWING_UD: 't_up_down',
};

const WORK_MODE_BY_ID = { 0: 'fan_only', 1: 'heat', 2: 'cool', 3: 'dry', 4: 'auto' };
const WORK_MODE_ID = { fan_only: 0, heat: 1, cool: 2, dry: 3, auto: 4 };

// Fan speeds are 0/5/6/7/8/9 (not contiguous).
const FAN_BY_ID = { 0: 'auto', 5: 'low', 6: 'mid_low', 7: 'medium', 8: 'mid_high', 9: 'high' };
const FAN_ID = { auto: 0, low: 5, mid_low: 6, medium: 7, mid_high: 8, high: 9 };

class ConnectLifeACDevice extends Homey.Device {
  async onInit() {
    this.log('ConnectLife AC device initialized:', this.getName());

    this._puid = this.getStore().puid;
    this._deviceId = this.getData().id;

    // Migration for devices paired before these capabilities existed.
    for (const cap of ['ac_mode', 'fan_mode', 'swing_vertical']) {
      if (!this.hasCapability(cap)) {
        await this.addCapability(cap).catch((err) => this.error(`addCapability ${cap}:`, err.message));
      }
    }

    this.registerCapabilityListener('onoff', this._onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', this._onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('ac_mode', this._onCapabilityAcMode.bind(this));
    this.registerCapabilityListener('fan_mode', this._onCapabilityFanMode.bind(this));
    this.registerCapabilityListener('swing_vertical', this._onCapabilitySwing.bind(this));

    try {
      await this.refreshStatus();
    } catch (err) {
      this.error('Initial status fetch failed:', err.message);
      await this.setUnavailable(err.message).catch(() => {});
    }

    this._configurePolling();
  }

  async onDeleted() {
    if (this._pollTimer) this.homey.clearInterval(this._pollTimer);
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.includes('poll_interval')) this._configurePolling();
  }

  _configurePolling() {
    if (this._pollTimer) {
      this.homey.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    const minutes = Number(this.getSetting('poll_interval')) || 0;
    if (minutes <= 0) return;
    this._pollTimer = this.homey.setInterval(() => {
      this.refreshStatus().catch((err) => this.error('Background poll failed:', err.message));
    }, minutes * 60 * 1000);
  }

  // -------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------

  async refreshStatus() {
    const api = this.driver.getApi();
    const appliances = await api.getAppliances();
    const mine = appliances.find((a) => a.deviceId === this._deviceId);
    if (!mine) throw new Error('Appliance not found on the account');
    await this._sync(mine.statusList || {});
    if (!this.getAvailable()) await this.setAvailable().catch(this.error);
    return mine.statusList;
  }

  async _sync(statusList) {
    const num = (key) => {
      const v = statusList[key];
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? undefined : n;
    };
    const set = async (cap, value) => {
      if (value === undefined) return;
      if (this.getCapabilityValue(cap) !== value) await this.setCapabilityValue(cap, value).catch(this.error);
    };

    await set('measure_temperature', num(PROP.INDOOR_TEMP));
    await set('target_temperature', num(PROP.TARGET_TEMP));

    const power = num(PROP.POWER);
    if (power !== undefined) await set('onoff', power !== 0);

    const mode = WORK_MODE_BY_ID[num(PROP.WORK_MODE)];
    if (mode) await set('ac_mode', mode);

    const fan = FAN_BY_ID[num(PROP.FAN_SPEED)];
    if (fan) await set('fan_mode', fan);

    const swing = num(PROP.SWING_UD);
    if (swing !== undefined) await set('swing_vertical', swing !== 0);
  }

  async _update(properties) {
    const api = this.driver.getApi();
    await api.updateAppliance(this._puid, properties);
  }

  // -------------------------------------------------------------------
  // Capability listeners
  // -------------------------------------------------------------------

  async _onCapabilityOnoff(value) {
    await this._update({ [PROP.POWER]: value ? '1' : '0' });
  }

  async _onCapabilityTargetTemperature(value) {
    await this._update({ [PROP.TARGET_TEMP]: String(Math.round(value)) });
  }

  async _onCapabilityAcMode(value) {
    const id = WORK_MODE_ID[value];
    if (id === undefined) throw new Error(`Unsupported mode: ${value}`);
    // Choosing a mode implies the unit should run, so power it on in the same call.
    await this._update({ [PROP.WORK_MODE]: String(id), [PROP.POWER]: '1' });
    if (this.getCapabilityValue('onoff') !== true) {
      await this.setCapabilityValue('onoff', true).catch(this.error);
    }
  }

  async _onCapabilityFanMode(value) {
    const id = FAN_ID[value];
    if (id === undefined) throw new Error(`Unsupported fan speed: ${value}`);
    await this._update({ [PROP.FAN_SPEED]: String(id) });
  }

  async _onCapabilitySwing(value) {
    await this._update({ [PROP.SWING_UD]: value ? '1' : '0' });
  }
}

module.exports = ConnectLifeACDevice;
