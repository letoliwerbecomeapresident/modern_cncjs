import isElectron from 'is-electron';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import set from 'lodash/set';
import merge from 'lodash/merge';
import settings from '../config/settings';
import ImmutableStore from '../lib/immutable-store';
import log from '../lib/log';
import defaultState from './defaultState';

const cnc = {
  version: settings.version,
  state: {}
};

const store = new ImmutableStore(defaultState);

const hasElectronBridge = () => {
  return isElectron() && typeof window.require === 'function';
};

const getConfig = async () => {
  let content = '';

  // Check whether the code is running in Electron renderer process
  if (hasElectronBridge()) {
    const electron = window.require('electron');
    content = await electron.ipcRenderer.invoke('read-user-config');
  } else {
    content = localStorage.getItem('cnc') || '{}';
  }

  return content;
};

const persist = async (data) => {
  const { version, state } = { ...data };

  data = {
    version: version || settings.version,
    state: {
      ...store.state,
      ...state
    }
  };

  try {
    const value = JSON.stringify(data, null, 2);

    // Check whether the code is running in Electron renderer process
    if (hasElectronBridge()) {
      const electron = window.require('electron');
      await electron.ipcRenderer.invoke('write-user-config', value);
    } else {
      localStorage.setItem('cnc', value);
    }
  } catch (e) {
    log.error(e);
  }
};

(async () => {
  // Debouncing enforces that a function not be called again until a certain amount of time (e.g. 100ms) has passed without it being called.
  store.on('change', debounce(async (state) => {
    await persist({ state: state });
  }, 100));

  try {
    const text = await getConfig();
    const data = JSON.parse(text);
    cnc.version = get(data, 'version', settings.version);
    cnc.state = get(data, 'state', {});
  } catch (e) {
    set(settings, 'error.corruptedWorkspaceSettings', true);
    log.error(e);
  }

  store.state = merge({}, defaultState, cnc.state || {});
})();

store.getConfig = getConfig;
store.persist = persist;

export default store;
