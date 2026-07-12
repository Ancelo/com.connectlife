'use strict';

const Homey = require('homey');

class ConnectLifeApp extends Homey.App {
  async onInit() {
    this.log('ConnectLife (Unofficial) app has been initialized');

    this.homey.flow
      .getActionCard('refresh_status')
      .registerRunListener(async (args) => {
        await args.device.refreshStatus();
      });
  }
}

module.exports = ConnectLifeApp;
