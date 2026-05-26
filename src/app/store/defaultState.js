const defaultState = {
  session: {
    name: '',
    token: ''
  },
  workspace: {
    container: {
      default: {
        widgets: ['visualizer']
      },
      primary: {
        show: true,
        widgets: []
      },
      secondary: {
        show: true,
        widgets: []
      }
    },
    machineProfile: {
      id: null
    }
  },
  widgets: {
    connection: {
      minimized: false,
      controller: {
        type: 'Grbl' // Grbl|Marlin|Smoothie|TinyG
      },
      port: '', // will be deprecated in v2
      baudrate: 115200, // will be deprecated in v2
      connection: {
        type: 'serial',
        serial: {
          // RTS/CTS flow control
          rtscts: false,
          pin: {
            // Set DTR line status (default to null)
            dtr: null,
            // Set RTS line status (default to null)
            rts: null,
          },
        },
      },
      autoReconnect: true
    },
    console: {
      minimized: false
    },
    visualizer: {
      minimized: false,

      // 3D View
      disabled: false,
      projection: 'orthographic', // 'perspective' or 'orthographic'
      cameraMode: 'pan', // 'pan' or 'rotate'
      gcode: {
        displayName: true
      },
      objects: {
        limits: {
          visible: true
        },
        coordinateSystem: {
          visible: true
        },
        gridLineNumbers: {
          visible: true
        },
        cuttingTool: {
          visible: true
        }
      }
    }
  }
};

export default defaultState;
