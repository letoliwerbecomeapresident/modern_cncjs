import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import { formatNumber } from '../lib/formatters';
import Panel from './Panel';
import styles from '../control-deck.styl';

const getDelta = (axis, positions) => {
  const machine = Number(positions.machine[axis]);
  const work = Number(positions.work[axis]);

  if (!Number.isFinite(machine) || !Number.isFinite(work)) {
    return null;
  }

  return machine - work;
};

const AxesPanel = ({ canJog, onMove, positions }) => (
  <Panel className={styles.axesPanel} title={i18n._('Axes')}>
    <div className={styles.tabs}>
      <button type="button" className={styles.activeTab}>{i18n._('Axes')}</button>
      <button type="button">{i18n._('MDI')}</button>
    </div>
    <div className={styles.axisTable}>
      <div className={styles.axisHead}>
        <span>{i18n._('Axis')}</span>
        <span>{i18n._('Machine Position')}</span>
        <span>{i18n._('Work Position')}</span>
        <span>{i18n._('DTG')}</span>
      </div>
      {['x', 'y', 'z'].map(axis => (
        <div className={styles.axisRow} key={axis}>
          <b className={styles[axis]}>{axis.toUpperCase()}</b>
          <strong>{formatNumber(positions.machine[axis])}</strong>
          <strong>{formatNumber(positions.work[axis])}</strong>
          <span>{formatNumber(getDelta(axis, positions))} <small>mm</small></span>
          <button
            type="button"
            disabled={!canJog}
            onClick={() => onMove({ [axis]: 0 })}
            title={i18n._('Move To Zero')}
            aria-label={i18n._('Move To Zero')}
          >
            <i className="fa fa-crosshairs" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  </Panel>
);

AxesPanel.propTypes = {
  canJog: PropTypes.bool,
  onMove: PropTypes.func,
  positions: PropTypes.object
};

AxesPanel.defaultProps = {
  positions: {
    machine: {},
    work: {}
  }
};

export default AxesPanel;
