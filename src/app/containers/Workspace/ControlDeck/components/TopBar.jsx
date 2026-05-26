import classNames from 'classnames';
import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import { formatNumber, formatRuntime, getProgress } from '../lib/formatters';
import styles from '../control-deck.styl';

const Metric = ({ label, children }) => (
  <div className={styles.metric}>
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
);

Metric.propTypes = {
  children: PropTypes.node,
  label: PropTypes.string
};

const TopBar = ({
  canSendCommand,
  controllerType,
  feedrate,
  isConnected,
  machineStatus,
  onCommand,
  overrides,
  positions,
  senderStatus,
  spindle,
  workflowState
}) => {
  const commands = [
    ['cycleStart', 'play', i18n._('Cycle Start'), 'cyclestart'],
    ['feedHold', 'pause', i18n._('Feed Hold'), 'feedhold'],
    ['homing', 'home', i18n._('Homing'), 'homing'],
    ['sleep', 'moon-o', i18n._('Sleep'), 'sleep'],
    ['unlock', 'unlock-alt', i18n._('Unlock'), 'unlock'],
    ['reset', 'undo', i18n._('Reset'), 'reset']
  ];

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <strong>LaserCNC</strong>
        <span>{controllerType || 'GRBL'} {i18n._('Control')}</span>
      </div>
      <div className={styles.topTelemetry}>
        <div className={styles.machineStatus}>
          <div className={styles.statusTitle}>
            <span>{i18n._('Machine Status')}</span>
            <strong>
              <i className="fa fa-dot-circle-o" aria-hidden="true" />
              {machineStatus}
            </strong>
          </div>
          <em>{isConnected ? i18n._('Ready to start') : i18n._('No serial connection')}</em>
        </div>
        <div className={styles.metricGrid}>
          <Metric label={i18n._('Position')}>
            <b>X</b> {formatNumber(get(positions, 'machine.x'))}
            <b>Y</b> {formatNumber(get(positions, 'machine.y'))}
            <b>Z</b> {formatNumber(get(positions, 'machine.z'))}
          </Metric>
          <Metric label={i18n._('Work Time')}>
            {formatRuntime(get(senderStatus, 'elapsedTime', 0))}
          </Metric>
          <Metric label={i18n._('Job Time')}>
            {getProgress(senderStatus) ? getProgress(senderStatus) + '%' : '--:--:--'}
          </Metric>
          <Metric label={i18n._('Feed')}>
            {feedrate || 0} <small>mm/min</small>
          </Metric>
          <Metric label={i18n._('Spindle / Laser')}>
            {spindle || 0} <small>RPM</small>
          </Metric>
          <Metric label={i18n._('Overrides')}>
            {get(overrides, 'feed', 100)} / {get(overrides, 'rapid', 100)} / {get(overrides, 'spindle', 100)}%
          </Metric>
        </div>
      </div>
      <div className={styles.commandBar}>
        {commands.map(item => (
          <button
            key={item[0]}
            type="button"
            className={classNames(styles.commandButton, styles[item[0]])}
            disabled={!canSendCommand}
            onClick={() => onCommand(item[3])}
          >
            <i className={'fa fa-fw fa-' + item[1]} aria-hidden="true" />
            <span>{item[2]}</span>
          </button>
        ))}
      </div>
      <div className={styles.workflowPill}>{workflowState}</div>
    </header>
  );
};

TopBar.propTypes = {
  canSendCommand: PropTypes.bool,
  controllerType: PropTypes.string,
  feedrate: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isConnected: PropTypes.bool,
  machineStatus: PropTypes.string,
  onCommand: PropTypes.func,
  overrides: PropTypes.object,
  positions: PropTypes.object,
  senderStatus: PropTypes.object,
  spindle: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  workflowState: PropTypes.string
};

export default TopBar;
