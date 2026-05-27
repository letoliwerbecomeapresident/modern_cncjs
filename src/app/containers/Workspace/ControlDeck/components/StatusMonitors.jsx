import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import Panel from './Panel';
import styles from '../control-deck.styl';

class StatusMonitors extends PureComponent {
  static propTypes = {
    monitors: PropTypes.object
  };

  static defaultProps = {
    monitors: {}
  };

  render() {
    const { monitors } = this.props;
    const monitorItems = [
      ['microchip', i18n._('Limit Switches'), monitors.limits],
      ['lock', i18n._('Door / Interlock'), monitors.door],
      ['tint', i18n._('Water Flow'), monitors.waterFlow],
      ['life-ring', i18n._('Air Assist'), monitors.airAssist],
      ['exchange', i18n._('Exhaust'), monitors.exhaust],
      ['thermometer-half', i18n._('Laser Temp'), monitors.laserTemp]
    ];

    return (
      <Panel className={styles.statusPanel} title={i18n._('Status Monitors')}>
        <div className={styles.monitorGrid}>
          {monitorItems.map(item => (
            <div className={styles.monitor} key={item[1]}>
              <i className={'fa fa-' + item[0]} aria-hidden="true" />
              <span>{item[1]}</span>
              <strong>{item[2]}</strong>
            </div>
          ))}
        </div>
      </Panel>
    );
  }
}

export default StatusMonitors;
