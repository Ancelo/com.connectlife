'use strict';

const Homey = require('homey');

class ConnectLifeApp extends Homey.App {
  async onInit() {
    this.log('ConnectLife (Unofficial) app has been initialized');

    // --- Actions ---
    this.homey.flow.getActionCard('refresh_status')
      .registerRunListener(async (args) => args.device.refreshStatus());

    this.homey.flow.getActionCard('set_ac_mode')
      .registerRunListener(async (args) => args.device.triggerCapabilityListener('ac_mode', args.mode));

    this.homey.flow.getActionCard('set_fan_mode')
      .registerRunListener(async (args) => args.device.triggerCapabilityListener('fan_mode', args.fan));

    this.homey.flow.getActionCard('set_swing')
      .registerRunListener(async (args) => args.device.triggerCapabilityListener('swing_vertical', args.state === 'on'));

    // --- Conditions ---
    this.homey.flow.getConditionCard('ac_mode_is')
      .registerRunListener(async (args) => args.device.getCapabilityValue('ac_mode') === args.mode);

    this.homey.flow.getConditionCard('fan_mode_is')
      .registerRunListener(async (args) => args.device.getCapabilityValue('fan_mode') === args.fan);

    this.homey.flow.getConditionCard('swing_is_on')
      .registerRunListener(async (args) => args.device.getCapabilityValue('swing_vertical') === true);
  }
}

module.exports = ConnectLifeApp;
