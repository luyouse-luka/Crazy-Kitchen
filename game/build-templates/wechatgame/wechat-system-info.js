function install(api) {
  if (![api.getDeviceInfo, api.getWindowInfo, api.getAppBaseInfo].every(value => typeof value === 'function')) return false;
  const device = api.getDeviceInfo();
  const app = api.getAppBaseInfo();
  // Cocos 3.8's adapters still call the deprecated combined API during startup.
  api.getSystemInfoSync = function () {
    return Object.assign({}, device, app, api.getWindowInfo());
  };
  return true;
}

module.exports = { install };
