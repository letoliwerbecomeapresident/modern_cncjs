import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import Panel from './Panel';
import styles from '../control-deck.styl';

const JogPanel = ({ canJog, jogStep, onCommand, onJog, onSetJogStep }) => {
  const step = Number(jogStep) || 1;
  const steps = [0.1, 1, 10];

  return (
    <Panel
      className={styles.jogPanel}
      title={i18n._('Jog Controls')}
      toolbar={(
        <span>
          {i18n._('Step')}
          {steps.map(value => (
            <button
              key={value}
              type="button"
              className={value === step ? styles.isSelected : ''}
              onClick={() => onSetJogStep(value)}
            >
              {value}
            </button>
          ))}
        </span>
      )}
    >
      <div className={styles.jogContent}>
        <div className={styles.jogGrid}>
          <button type="button" disabled={!canJog} onClick={() => onJog('y', step)}>Y+</button>
          <button
            type="button"
            disabled={!canJog}
            onClick={() => onJog('z', step)}
            aria-label="Z+"
          >
            <i className="fa fa-caret-up" aria-hidden="true" />
          </button>
          <button type="button" disabled={!canJog} onClick={() => onJog('z', step)}>Z+</button>
          <button type="button" disabled={!canJog} onClick={() => onJog('x', -step)}>X-</button>
          <button type="button" disabled={!canJog} onClick={() => onCommand('homing')}>
            <i className="fa fa-home" aria-hidden="true" />
            {i18n._('Home')}
          </button>
          <button type="button" disabled={!canJog} onClick={() => onJog('x', step)}>X+</button>
          <button type="button" disabled={!canJog} onClick={() => onJog('y', -step)}>Y-</button>
          <button
            type="button"
            disabled={!canJog}
            onClick={() => onJog('z', -step)}
            aria-label="Z-"
          >
            <i className="fa fa-caret-down" aria-hidden="true" />
          </button>
          <button type="button" disabled={!canJog} onClick={() => onJog('z', -step)}>Z-</button>
        </div>
        <div className={styles.jogSide}>
          <button type="button" disabled={!canJog} onClick={() => onCommand('rapidOverride', 100)}>
            <span>{i18n._('Rapid')}</span>
            <strong>G0</strong>
          </button>
          <button type="button" disabled={!canJog} onClick={() => onCommand('statusreport')}>
            <span>{i18n._('Status Report')}</span>
            <i className="fa fa-crosshairs" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Panel>
  );
};

JogPanel.propTypes = {
  canJog: PropTypes.bool,
  jogStep: PropTypes.number,
  onCommand: PropTypes.func,
  onJog: PropTypes.func,
  onSetJogStep: PropTypes.func
};

export default JogPanel;
