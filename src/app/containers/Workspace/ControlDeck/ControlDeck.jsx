import get from 'lodash/get';
import map from 'lodash/map';
import reverse from 'lodash/reverse';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import api from 'app/api';
import { WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING } from 'app/constants';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import log from 'app/lib/log';
import WidgetConfig from 'app/widgets/WidgetConfig';
import AxesPanel from './components/AxesPanel';
import ConnectionPanel from './components/ConnectionPanel';
import ConsolePanel from './components/ConsolePanel';
import FilesPanel from './components/FilesPanel';
import FooterStatus from './components/FooterStatus';
import JobStatusPanel from './components/JobStatusPanel';
import JogPanel from './components/JogPanel';
import LaserPanel from './components/LaserPanel';
import ModularDashboard from './components/ModularDashboard';
import SideNav from './components/SideNav';
import StatusMonitors from './components/StatusMonitors';
import TopBar from './components/TopBar';
import VisualizerPanel from './components/LazyVisualizerPanel';
import styles from './control-deck.styl';

const DEFAULT_BAUDRATES = [
  250000,
  115200,
  76800,
  57600,
  38400,
  19200,
  9600,
  2400
];

const DEFAULT_DASHBOARD_LAYOUT = [
  { id: 'connection', x: 0, y: 0, w: 5, h: 10 },
  { id: 'files', x: 0, y: 10, w: 5, h: 14 },
  { id: 'visualizer', x: 5, y: 0, w: 12, h: 16 },
  { id: 'console', x: 5, y: 16, w: 7, h: 8 },
  { id: 'job', x: 12, y: 16, w: 5, h: 8 },
  { id: 'axes', x: 17, y: 0, w: 7, h: 7 },
  { id: 'jog', x: 17, y: 7, w: 7, h: 6 },
  { id: 'laser', x: 17, y: 13, w: 7, h: 7 },
  { id: 'status', x: 17, y: 20, w: 7, h: 4 }
];

class ControlDeck extends PureComponent {
  connectionConfig = new WidgetConfig('connection');

  dashboardConfig = new WidgetConfig('controlDeck');

  state = this.getInitialState();

  controllerEvents = {
    'serialport:list': (ports) => {
      this.stopLoading();
      this.setState({
        ports: ports || [],
        port: this.pickPort(ports)
      });
    },
    'serialport:open': (options) => {
      const { controllerType, port, baudrate } = { ...options };
      this.setState({
        connected: true,
        connecting: false,
        controllerType: controllerType || this.state.controllerType,
        port: port || this.state.port,
        baudrate: baudrate || this.state.baudrate
      });
    },
    'serialport:close': () => {
      this.setState({
        connected: false,
        connecting: false,
        controllerState: {},
        workflowState: 'idle',
        feederStatus: {},
        senderStatus: {}
      });
      controller.listPorts();
    },
    'serialport:error': (options) => {
      const { port } = { ...options };
      this.setState({
        connecting: false,
        connected: false,
        alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port })
      });
    },
    'controller:settings': (controllerType, controllerSettings) => {
      this.setState({
        controllerType,
        controllerSettings: controllerSettings || {}
      });
    },
    'controller:state': (controllerType, controllerState) => {
      this.setState({
        controllerType,
        controllerState: controllerState || {}
      });
    },
    'workflow:state': (workflowState) => {
      this.setState({ workflowState: workflowState || 'idle' });
    },
    'feeder:status': (feederStatus) => {
      this.setState({ feederStatus: feederStatus || {} });
    },
    'sender:status': (senderStatus) => {
      this.setState({
        senderStatus: senderStatus || {},
        activeFileName: this.getFileName(get(senderStatus, 'name')) || this.state.activeFileName
      });
    },
    'gcode:load': (name) => {
      if (typeof name === 'string') {
        this.setState({ activeFileName: this.getFileName(name) });
      }
    },
    'gcode:unload': () => {
      this.setState({
        activeFileName: '',
        gcodeBBox: null,
        senderStatus: {}
      });
    }
  };

  actions = {
    clearAlert: () => {
      this.setState({ alertMessage: '' });
    },
    changeController: (controllerType) => {
      this.setState({ controllerType });
    },
    onChangePortOption: (option) => {
      this.setState({
        alertMessage: '',
        port: get(option, 'value', '')
      });
    },
    onChangeBaudrateOption: (option) => {
      this.setState({
        alertMessage: '',
        baudrate: get(option, 'value', 115200)
      });
    },
    toggleAutoReconnect: (event) => {
      this.setState({ autoReconnect: event.target.checked });
    },
    toggleRTSCTSFlowControl: (event) => {
      this.setState({
        connection: {
          ...this.state.connection,
          serial: {
            ...this.state.connection.serial,
            rtscts: event.target.checked
          }
        }
      });
    },
    toggleDTRPin: (event) => {
      const checked = event.target.checked;
      this.setState({
        connection: {
          ...this.state.connection,
          serial: {
            ...this.state.connection.serial,
            pin: {
              ...this.state.connection.serial.pin,
              dtr: checked ? true : null
            }
          }
        }
      });
    },
    setDTR: () => {
      this.setSerialPin('dtr', true);
    },
    clearDTR: () => {
      this.setSerialPin('dtr', false);
    },
    toggleRTSPin: (event) => {
      const checked = event.target.checked;
      this.setState({
        connection: {
          ...this.state.connection,
          serial: {
            ...this.state.connection.serial,
            pin: {
              ...this.state.connection.serial.pin,
              rts: checked ? true : null
            }
          }
        }
      });
    },
    setRTS: () => {
      this.setSerialPin('rts', true);
    },
    clearRTS: () => {
      this.setSerialPin('rts', false);
    },
    handleRefreshPorts: () => {
      this.refreshPorts();
    },
    handleOpenPort: () => {
      this.openPort();
    },
    handleClosePort: () => {
      this.closePort();
    }
  };

  componentDidMount() {
    this.addControllerEvents();
    this.addPubsubEvents();
    this.refreshPorts();
    this.fetchWatchFiles();
  }

  componentWillUnmount() {
    this.removeControllerEvents();
    this.removePubsubEvents();
    this.stopLoading();
  }

  componentDidUpdate(prevProps, prevState) {
    const { controllerType, port, baudrate, autoReconnect, connection } = this.state;

    if (controllerType !== prevState.controllerType && controllerType) {
      this.connectionConfig.set('controller.type', controllerType);
    }
    if (port !== prevState.port && port) {
      this.connectionConfig.set('port', port);
    }
    if (baudrate !== prevState.baudrate && baudrate) {
      this.connectionConfig.set('baudrate', baudrate);
    }
    if (autoReconnect !== prevState.autoReconnect) {
      this.connectionConfig.set('autoReconnect', autoReconnect);
    }
    if (connection !== prevState.connection) {
      this.connectionConfig.set('connection.serial.rtscts', get(connection, 'serial.rtscts', false));
      this.connectionConfig.set('connection.serial.pin.dtr', get(connection, 'serial.pin.dtr', null));
      this.connectionConfig.set('connection.serial.pin.rts', get(connection, 'serial.pin.rts', null));
    }
  }

  getInitialState() {
    const configuredController = this.connectionConfig.get('controller.type');
    const loadedController = controller.loadedControllers[0] || 'Grbl';
    const controllerType = controller.type || configuredController || loadedController;

    return {
      loading: false,
      connecting: false,
      connected: !!controller.port,
      ports: [],
      baudrates: reverse(sortBy(uniq(controller.baudrates.concat(DEFAULT_BAUDRATES)))),
      controllerType,
      port: controller.port || this.connectionConfig.get('port') || '',
      baudrate: this.connectionConfig.get('baudrate') || 115200,
      autoReconnect: this.connectionConfig.get('autoReconnect'),
      connection: {
        serial: {
          rtscts: this.connectionConfig.get('connection.serial.rtscts'),
          pin: {
            dtr: this.connectionConfig.get('connection.serial.pin.dtr'),
            rts: this.connectionConfig.get('connection.serial.pin.rts')
          }
        }
      },
      alertMessage: '',
      controllerSettings: controller.settings || {},
      controllerState: controller.state || {},
      workflowState: get(controller, 'workflow.state', 'idle'),
      feederStatus: {},
      senderStatus: {},
      activeFileName: '',
      gcodeBBox: null,
      watchFiles: [],
      watchPath: '',
      isLoadingWatchFiles: false,
      jogStep: this.dashboardConfig.get('jog.step', 1),
      laserMode: this.dashboardConfig.get('laser.mode', 'engrave'),
      laserPower: this.dashboardConfig.get('laser.power', 10),
      laserDuration: this.dashboardConfig.get('laser.duration', 500),
      laserMaxS: this.dashboardConfig.get('laser.maxS', 1000),
      frameFeedrate: this.dashboardConfig.get('laser.frameFeedrate', 1200),
      dashboardLayout: this.getDashboardLayout()
    };
  }

  getDashboardLayout() {
    const savedLayout = this.dashboardConfig.get('layout', []);

    return DEFAULT_DASHBOARD_LAYOUT.map(defaultItem => {
      let savedItem = null;

      for (let i = 0; i < (savedLayout || []).length; i += 1) {
        if (savedLayout[i].id === defaultItem.id) {
          savedItem = savedLayout[i];
          break;
        }
      }

      const hasSavedPosition = savedItem &&
        Number.isFinite(savedItem.x) &&
        Number.isFinite(savedItem.y) &&
        Number.isFinite(savedItem.w) &&
        Number.isFinite(savedItem.h);

      if (!hasSavedPosition) {
        return { ...defaultItem };
      }

      return {
        ...defaultItem,
        x: savedItem.x,
        y: savedItem.y,
        w: savedItem.w,
        h: savedItem.h
      };
    });
  }

  setSerialPin(pin, value) {
    this.setState({
      connection: {
        ...this.state.connection,
        serial: {
          ...this.state.connection.serial,
          pin: {
            ...this.state.connection.serial.pin,
            [pin]: value
          }
        }
      }
    });
  }

  addControllerEvents() {
    Object.keys(this.controllerEvents).forEach(eventName => {
      controller.addListener(eventName, this.controllerEvents[eventName]);
    });
  }

  removeControllerEvents() {
    Object.keys(this.controllerEvents).forEach(eventName => {
      controller.removeListener(eventName, this.controllerEvents[eventName]);
    });
  }

  addPubsubEvents() {
    this.pubsubTokens = [
      pubsub.subscribe('gcode:bbox', (msg, bbox) => {
        this.setState({ gcodeBBox: bbox || null });
      }),
      pubsub.subscribe('gcode:load', (msg, data = {}) => {
        this.setState({
          activeFileName: this.getFileName(data.name || this.state.activeFileName)
        });
      }),
      pubsub.subscribe('gcode:unload', () => {
        this.setState({
          activeFileName: '',
          gcodeBBox: null,
          senderStatus: {}
        });
      })
    ];
  }

  removePubsubEvents() {
    (this.pubsubTokens || []).forEach(token => {
      pubsub.unsubscribe(token);
    });
    this.pubsubTokens = [];
  }

  startLoading() {
    this.stopLoading();
    this.setState({ loading: true });
    this.loadingTimer = setTimeout(() => {
      this.setState({ loading: false });
    }, 5000);
  }

  stopLoading() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.state.loading) {
      this.setState({ loading: false });
    }
  }

  pickPort(ports) {
    const configured = this.state.port || this.connectionConfig.get('port') || '';
    const available = map(ports, 'port');

    if (available.indexOf(configured) >= 0) {
      return configured;
    }

    return configured || get(ports, '[0].port', '');
  }

  refreshPorts() {
    this.startLoading();
    controller.listPorts();
  }

  openPort() {
    const { port, baudrate, controllerType, connection } = this.state;

    if (!port || !baudrate) {
      return;
    }

    this.setState({ connecting: true });
    controller.openPort(port, {
      controllerType,
      baudrate,
      rtscts: get(connection, 'serial.rtscts', false),
      pin: {
        dtr: get(connection, 'serial.pin.dtr', null),
        rts: get(connection, 'serial.pin.rts', null)
      }
    }, (err) => {
      if (!err) {
        return;
      }
      this.setState({
        alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port }),
        connecting: false,
        connected: false
      });
      log.error(err);
    });
  }

  closePort() {
    const port = this.state.port || controller.port;
    this.setState({
      connecting: false,
      connected: false
    });
    controller.closePort(port, (err) => {
      if (err) {
        log.error(err);
        return;
      }
      controller.listPorts();
    });
  }

  fetchWatchFiles = () => {
    this.setState({ isLoadingWatchFiles: true });
    api.watch.getFiles({ path: '' })
      .then((res) => {
        const body = res.body || {};
        this.setState({
          watchFiles: body.files || [],
          watchPath: body.path || '',
          isLoadingWatchFiles: false
        });
      })
      .catch(() => {
        this.setState({
          watchFiles: [],
          isLoadingWatchFiles: false
        });
      });
  };

  loadWatchFile = (file) => {
    const name = get(file, 'name', '');
    const fullPath = [this.state.watchPath, name].filter(Boolean).join('/');

    if (!fullPath) {
      return;
    }

    controller.command('watchdir:load', fullPath, (err) => {
      if (err) {
        log.error(err);
      }
    });
    this.setState({ activeFileName: this.getFileName(name) });
  };

  onDrop = (files) => {
    const file = files && files[0];
    const port = this.state.port || controller.port;

    if (!file || !port) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = (event) => {
      const { result, error } = event.target;

      if (error) {
        log.error(error);
        return;
      }

      api.loadGCode({
        port,
        name: file.name,
        gcode: result
        })
        .then((res) => {
          const { name = '', gcode = '' } = { ...res.body };
          controller.command('gcode:load', name, gcode, {});
          this.setState({ activeFileName: this.getFileName(name || file.name) });
        })
        .catch((res) => {
          log.error('Failed to upload G-code file', res);
        });
    };

    reader.readAsText(file);
  };

  command = (command, ...args) => {
    controller.command(command, ...args);
  };

  gcode = (gcode) => {
    controller.command('gcode', gcode);
  };

  jog = (axis, distance) => {
    if (!this.canJog()) {
      return;
    }
    controller.command('gcode', 'G91');
    controller.command('gcode', 'G0 ' + axis.toUpperCase() + distance);
    controller.command('gcode', 'G90');
  };

  move = (params = {}) => {
    const words = Object.keys(params).map(axis => axis.toUpperCase() + params[axis]).join(' ');

    if (!this.canJog() || !words) {
      return;
    }
    controller.command('gcode', 'G0 ' + words);
  };

  laserTest = (enabled) => {
    if (enabled) {
      controller.command('lasertest:on', this.state.laserPower, this.state.laserDuration, this.state.laserMaxS);
      return;
    }
    controller.command('lasertest:off');
  };

  setJogStep = (value) => {
    const jogStep = Number(value) || 1;
    this.dashboardConfig.set('jog.step', jogStep);
    this.setState({ jogStep });
  };

  setLaserPower = (event) => {
    const laserPower = Number(event.target.value) || 0;
    this.dashboardConfig.set('laser.power', laserPower);
    this.setState({ laserPower });
  };

  setFrameFeedrate = (event) => {
    const frameFeedrate = Number(event.target.value) || 0;
    this.dashboardConfig.set('laser.frameFeedrate', frameFeedrate);
    this.setState({ frameFeedrate });
  };

  setLaserMode = (laserMode) => {
    this.dashboardConfig.set('laser.mode', laserMode);
    this.setState({ laserMode });
  };

  toggleAirAssist = () => {
    controller.command('gcode', this.isAirAssistOn() ? 'M9' : 'M8');
  };

  startSpindle = () => {
    const s = Math.round(this.state.laserMaxS * (this.state.laserPower / 100));
    controller.command('gcode', (this.state.laserMode === 'cut' ? 'M4' : 'M3') + ' S' + s);
  };

  stopSpindle = () => {
    controller.command('gcode', 'M5');
  };

  frameJob = () => {
    const { gcodeBBox, frameFeedrate } = this.state;

    if (!this.canJog() || !gcodeBBox) {
      return;
    }

    const minX = Number(get(gcodeBBox, 'min.x', 0)) || 0;
    const minY = Number(get(gcodeBBox, 'min.y', 0)) || 0;
    const maxX = Number(get(gcodeBBox, 'max.x', 0)) || 0;
    const maxY = Number(get(gcodeBBox, 'max.y', 0)) || 0;
    const feedrate = Number(frameFeedrate) || 1200;

    [
      'G90',
      'G0 X' + minX + ' Y' + minY,
      'G1 F' + feedrate + ' X' + maxX + ' Y' + minY,
      'G1 X' + maxX + ' Y' + maxY,
      'G1 X' + minX + ' Y' + maxY,
      'G1 X' + minX + ' Y' + minY
    ].forEach(gcode => controller.command('gcode', gcode));
  };

  workflowCommand = (command) => {
    const { workflowState } = this.state;

    if (command === 'run') {
      controller.command(workflowState === WORKFLOW_STATE_PAUSED ? 'gcode:resume' : 'gcode:start');
    }
    if (command === 'pause') {
      controller.command('gcode:pause');
    }
    if (command === 'stop') {
      controller.command('gcode:stop', { force: true });
    }
    if (command === 'unload') {
      controller.command('gcode:unload');
      pubsub.publish('gcode:unload');
    }
  };

  setWorkCoordinateSystem = (wcs) => {
    controller.command('gcode', wcs);
  };

  getPositions() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return {
        machine: get(controllerState, 'sr.mpos', {}),
        work: get(controllerState, 'sr.wpos', {})
      };
    }

    if (controllerType === 'Marlin') {
      const pos = get(controllerState, 'pos', {});
      return {
        machine: pos,
        work: pos
      };
    }

    return {
      machine: get(controllerState, 'status.mpos', {}),
      work: get(controllerState, 'status.wpos', {})
    };
  }

  getMachineStatus() {
    const { controllerState, workflowState } = this.state;
    return get(controllerState, 'status.activeState') ||
      get(controllerState, 'sr.machineState') ||
      workflowState ||
      'idle';
  }

  getFileName(filePath = '') {
    const parts = String(filePath || '').split(/[\\/]/);
    return parts[parts.length - 1] || '';
  }

  getWorkCoordinateSystem() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return get(controllerState, 'sr.modal.wcs') || 'G54';
    }
    if (controllerType === 'Marlin') {
      return get(controllerState, 'modal.wcs') || 'G54';
    }

    return get(controllerState, 'parserstate.modal.wcs') || 'G54';
  }

  getModalCoolant() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return get(controllerState, 'sr.modal.coolant') || '';
    }
    if (controllerType === 'Marlin') {
      return get(controllerState, 'modal.coolant') || '';
    }

    return get(controllerState, 'parserstate.modal.coolant') || '';
  }

  getModalSpindle() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return get(controllerState, 'sr.modal.spindle') || '';
    }
    if (controllerType === 'Marlin') {
      return get(controllerState, 'modal.spindle') || '';
    }

    return get(controllerState, 'parserstate.modal.spindle') || '';
  }

  getFeedrate() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return get(controllerState, 'sr.feedrate', 0);
    }
    if (controllerType === 'Marlin') {
      return get(controllerState, 'feedrate', 0);
    }

    return get(controllerState, 'status.currentFeedrate') ||
      get(controllerState, 'status.feedrate', 0);
  }

  getSpindleSpeed() {
    const { controllerType, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return get(controllerState, 'sr.sps', 0);
    }
    if (controllerType === 'Marlin') {
      return get(controllerState, 'spindle', 0);
    }

    return get(controllerState, 'status.spindle') ||
      get(controllerState, 'parserstate.spindle') ||
      0;
  }

  getOverrides() {
    const { controllerType, controllerSettings, controllerState } = this.state;

    if (controllerType === 'TinyG') {
      return {
        feed: Math.round((Number(get(controllerSettings, 'mfo', 1)) || 1) * 100),
        rapid: Math.round((Number(get(controllerSettings, 'mto', 1)) || 1) * 100),
        spindle: Math.round((Number(get(controllerSettings, 'sso', 1)) || 1) * 100)
      };
    }
    if (controllerType === 'Marlin') {
      return {
        feed: get(controllerState, 'ovF', 100),
        rapid: 100,
        spindle: get(controllerState, 'ovS', 100)
      };
    }
    if (controllerType === 'Smoothie') {
      return {
        feed: get(controllerState, 'status.ovF') || get(controllerState, 'status.feedrateOverride', 100),
        rapid: 100,
        spindle: get(controllerState, 'status.ovS') || 100
      };
    }

    return {
      feed: get(controllerState, 'status.ov[0]', 100),
      rapid: get(controllerState, 'status.ov[1]', 100),
      spindle: get(controllerState, 'status.ov[2]', 100)
    };
  }

  isAirAssistOn() {
    const accessoryState = get(this.state.controllerState, 'status.accessoryState', '');
    const coolant = this.getModalCoolant();

    return String(accessoryState).indexOf('F') >= 0 ||
      String(coolant).indexOf('M8') >= 0;
  }

  getStatusMonitors() {
    const { controllerState } = this.state;
    const pinState = get(controllerState, 'status.pinState', '');
    const activeState = this.getMachineStatus();
    const limitPins = ['X', 'Y', 'Z', 'A'].filter(pin => String(pinState).indexOf(pin) >= 0);
    const doorOpen = String(pinState).indexOf('D') >= 0 || activeState === 'Door';
    const coolant = this.getModalCoolant();
    const temperature = get(controllerState, 'status.currentTemperature') ||
      get(controllerState, 'extruder.deg') ||
      get(controllerState, 'heatedBed.deg');

    return {
      limits: limitPins.length ? limitPins.join(' ') : i18n._('Clear'),
      door: doorOpen ? i18n._('Open') : i18n._('Closed'),
      waterFlow: i18n._('Unknown'),
      airAssist: this.isAirAssistOn() ? i18n._('On') : i18n._('Off'),
      exhaust: String(coolant).indexOf('M7') >= 0 ? i18n._('On') : i18n._('Unknown'),
      laserTemp: temperature ? (temperature + ' C') : i18n._('Unknown')
    };
  }

  canSendCommand() {
    return !!controller.port;
  }

  canJog() {
    return this.canSendCommand() && this.state.workflowState !== WORKFLOW_STATE_RUNNING;
  }

  getConnectionState() {
    return {
      ...this.state,
      connected: this.state.connected || !!controller.port
    };
  }

  setDashboardLayout = (layout) => {
    this.dashboardConfig.set('layout', layout);
    this.setState({ dashboardLayout: layout });
  };

  getDashboardItems(positions) {
    const {
      activeFileName,
      feederStatus,
      gcodeBBox,
      isLoadingWatchFiles,
      jogStep,
      laserMode,
      laserPower,
      frameFeedrate,
      senderStatus,
      watchFiles,
      workflowState
    } = this.state;

    return [
      {
        id: 'connection',
        minW: 5,
        minH: 10,
        children: <ConnectionPanel actions={this.actions} state={this.getConnectionState()} />
      },
      {
        id: 'files',
        minW: 4,
        minH: 8,
        children: (
          <FilesPanel
            activeFileName={activeFileName}
            isLoading={isLoadingWatchFiles}
            onDrop={this.onDrop}
            onLoadFile={this.loadWatchFile}
            onRefresh={this.fetchWatchFiles}
            watchFiles={watchFiles}
          />
        )
      },
      {
        id: 'visualizer',
        minW: 7,
        minH: 9,
        children: (
          <VisualizerPanel
            activeFileName={activeFileName}
            bbox={gcodeBBox}
            onSetWorkCoordinateSystem={this.setWorkCoordinateSystem}
            workCoordinateSystem={this.getWorkCoordinateSystem()}
          />
        )
      },
      {
        id: 'console',
        minW: 5,
        minH: 5,
        children: <ConsolePanel />
      },
      {
        id: 'job',
        minW: 5,
        minH: 8,
        children: (
          <JobStatusPanel
            activeFileName={activeFileName}
            canRun={this.canSendCommand() && !!activeFileName && workflowState !== WORKFLOW_STATE_RUNNING}
            canPause={this.canSendCommand() && workflowState === WORKFLOW_STATE_RUNNING}
            canStop={this.canSendCommand() && workflowState === WORKFLOW_STATE_PAUSED}
            feederStatus={feederStatus}
            onWorkflowCommand={this.workflowCommand}
            senderStatus={senderStatus}
            workflowState={workflowState}
          />
        )
      },
      {
        id: 'axes',
        minW: 7,
        minH: 8,
        children: (
          <AxesPanel
            canJog={this.canJog()}
            onMove={this.move}
            positions={positions}
          />
        )
      },
      {
        id: 'jog',
        minW: 5,
        minH: 8,
        children: (
          <JogPanel
            canJog={this.canJog()}
            jogStep={jogStep}
            onCommand={this.command}
            onJog={this.jog}
            onSetJogStep={this.setJogStep}
          />
        )
      },
      {
        id: 'laser',
        minW: 5,
        minH: 7,
        children: (
          <LaserPanel
            airAssistOn={this.isAirAssistOn()}
            canClick={this.canSendCommand()}
            canFrame={this.canJog() && !!gcodeBBox}
            frameFeedrate={frameFeedrate}
            laserMode={laserMode}
            power={laserPower}
            spindleRunning={Boolean(this.canSendCommand() && this.getModalSpindle() && this.getModalSpindle() !== 'M5')}
            onFrame={this.frameJob}
            onGCode={this.gcode}
            onLaserTest={this.laserTest}
            onPowerChange={this.setLaserPower}
            onSetFrameFeedrate={this.setFrameFeedrate}
            onSetLaserMode={this.setLaserMode}
            onSpindleStart={this.startSpindle}
            onSpindleStop={this.stopSpindle}
            onToggleAirAssist={this.toggleAirAssist}
          />
        )
      },
      {
        id: 'status',
        minW: 6,
        minH: 7,
        children: <StatusMonitors monitors={this.getStatusMonitors()} />
      }
    ];
  }

  render() {
    const {
      controllerType,
      dashboardLayout,
      senderStatus,
      workflowState
    } = this.state;
    const positions = this.getPositions();

    return (
      <div className={styles.deck}>
        <TopBar
          controllerType={controllerType}
          canSendCommand={this.canSendCommand()}
          feedrate={this.getFeedrate()}
          isConnected={!!controller.port}
          machineStatus={this.getMachineStatus()}
          onCommand={this.command}
          overrides={this.getOverrides()}
          positions={positions}
          senderStatus={senderStatus}
          spindle={this.getSpindleSpeed()}
          workflowState={workflowState}
        />
        <div className={styles.workspaceShell}>
          <SideNav />
          <main className={styles.deckBody}>
            <ModularDashboard
              layout={dashboardLayout}
              items={this.getDashboardItems(positions)}
              onLayoutChange={this.setDashboardLayout}
            />
          </main>
        </div>
        <FooterStatus
          activeFileName={this.state.activeFileName}
          controllerType={controllerType}
          isConnected={!!controller.port}
          onWorkflowCommand={this.workflowCommand}
          port={this.state.port || controller.port}
          workflowState={workflowState || WORKFLOW_STATE_IDLE}
        />
      </div>
    );
  }
}

export default ControlDeck;
