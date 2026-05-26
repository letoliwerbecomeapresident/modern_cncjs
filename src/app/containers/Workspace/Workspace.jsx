import includes from 'lodash/includes';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import FeederPaused from './modals/FeederPaused';
import FeederWait from './modals/FeederWait';
import ServerDisconnected from './modals/ServerDisconnected';
import ControlDeck from './ControlDeck';
import styles from './index.styl';
import {
  MODAL_NONE,
  MODAL_FEEDER_PAUSED,
  MODAL_FEEDER_WAIT,
  MODAL_SERVER_DISCONNECTED
} from './constants';

const WAIT = '%wait';

class Workspace extends PureComponent {
    static propTypes = {
      ...withRouter.propTypes
    };

    state = {
      modal: {
        name: MODAL_NONE,
        params: {}
      }
    };

    action = {
      openModal: (name = MODAL_NONE, params = {}) => {
        this.setState({
          modal: {
            name: name,
            params: params
          }
        });
      },
      closeModal: () => {
        this.setState({
          modal: {
            name: MODAL_NONE,
            params: {}
          }
        });
      }
    };

    controllerEvents = {
      'connect': () => {
        if (controller.connected) {
          this.action.closeModal();
        } else {
          this.action.openModal(MODAL_SERVER_DISCONNECTED);
        }
      },
      'connect_error': () => {
        if (controller.connected) {
          this.action.closeModal();
        } else {
          this.action.openModal(MODAL_SERVER_DISCONNECTED);
        }
      },
      'disconnect': () => {
        if (controller.connected) {
          this.action.closeModal();
        } else {
          this.action.openModal(MODAL_SERVER_DISCONNECTED);
        }
      },
      'feeder:status': (status) => {
        const { modal } = this.state;
        const { hold, holdReason } = { ...status };

        if (!hold) {
          if (includes([MODAL_FEEDER_PAUSED, MODAL_FEEDER_WAIT], modal.name)) {
            this.action.closeModal();
          }
          return;
        }

        const { err, data, msg } = { ...holdReason };

        if (err) {
          this.action.openModal(MODAL_FEEDER_PAUSED, {
            title: i18n._('Error'),
            message: msg,
          });
          return;
        }

        if (data === WAIT) {
          this.action.openModal(MODAL_FEEDER_WAIT, {
            title: '%wait',
            message: msg,
          });
          return;
        }

        const title = {
          'M0': i18n._('M0 Program Pause'),
          'M1': i18n._('M1 Program Pause'),
          'M2': i18n._('M2 Program End'),
          'M30': i18n._('M30 Program End'),
          'M6': i18n._('M6 Tool Change'),
          'M109': i18n._('M109 Set Extruder Temperature'),
          'M190': i18n._('M190 Set Heated Bed Temperature')
        }[data] || data;

        this.action.openModal(MODAL_FEEDER_PAUSED, {
          title: title,
          message: msg,
        });
      }
    };

    componentDidMount() {
      this.addControllerEvents();
    }

    componentWillUnmount() {
      this.removeControllerEvents();
    }

    addControllerEvents() {
      Object.keys(this.controllerEvents).forEach(eventName => {
        const callback = this.controllerEvents[eventName];
        controller.addListener(eventName, callback);
      });
    }

    removeControllerEvents() {
      Object.keys(this.controllerEvents).forEach(eventName => {
        const callback = this.controllerEvents[eventName];
        controller.removeListener(eventName, callback);
      });
    }

    render() {
      const { style, className } = this.props;
      const { modal } = this.state;

      return (
        <div style={style} className={classNames(className, styles.workspace)}>
          {modal.name === MODAL_FEEDER_PAUSED && (
            <FeederPaused
              title={modal.params.title}
              message={modal.params.message}
              onClose={this.action.closeModal}
            />
          )}
          {modal.name === MODAL_FEEDER_WAIT && (
            <FeederWait
              title={modal.params.title}
              message={modal.params.message}
              onClose={this.action.closeModal}
            />
          )}
          {modal.name === MODAL_SERVER_DISCONNECTED &&
            <ServerDisconnected />}
          <ControlDeck />
        </div>
      );
    }
}

export default withRouter(Workspace);
