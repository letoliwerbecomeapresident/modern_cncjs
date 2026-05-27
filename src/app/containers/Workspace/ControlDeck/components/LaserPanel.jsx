import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import Panel from './Panel';
import styles from '../control-deck.styl';

class LaserPanel extends PureComponent {
  static propTypes = {
    airAssistOn: PropTypes.bool,
    canClick: PropTypes.bool,
    canFrame: PropTypes.bool,
    frameFeedrate: PropTypes.number,
    laserMode: PropTypes.string,
    onFrame: PropTypes.func,
    onGCode: PropTypes.func,
    onLaserTest: PropTypes.func,
    onPowerChange: PropTypes.func,
    onSetFrameFeedrate: PropTypes.func,
    onSetLaserMode: PropTypes.func,
    onSpindleStart: PropTypes.func,
    onSpindleStop: PropTypes.func,
    onToggleAirAssist: PropTypes.func,
    power: PropTypes.number,
    spindleRunning: PropTypes.bool
  };

  handleSetEngrave = () => this.props.onSetLaserMode('engrave');

  handleSetCut = () => this.props.onSetLaserMode('cut');

  handleTestOn = () => this.props.onLaserTest(true);

  handleTestOff = () => this.props.onLaserTest(false);

  handleGCode = (command) => () => this.props.onGCode(command);

  render() {
    const {
      airAssistOn,
      canClick,
      canFrame,
      frameFeedrate,
      laserMode,
      onFrame,
      onPowerChange,
      onSetFrameFeedrate,
      onSpindleStart,
      onSpindleStop,
      onToggleAirAssist,
      power,
      spindleRunning
    } = this.props;

    return (
      <Panel
        className={styles.laserPanel}
        title={i18n._('Laser Control')}
        toolbar={<span className={styles.readyBadge}>{canClick ? i18n._('Ready') : i18n._('Disconnected')}</span>}
      >
        <div className={styles.laserRows}>
          <label>{i18n._('Power')}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={power}
            onChange={onPowerChange}
          />
          <strong>{power}%</strong>
          <label>{i18n._('Speed')}</label>
          <input
            type="range"
            min="100"
            max="3000"
            step="100"
            value={frameFeedrate}
            onChange={onSetFrameFeedrate}
          />
          <strong>{frameFeedrate} <small>mm/min</small></strong>
          <label>{i18n._('Air Assist')}</label>
          <button
            type="button"
            className={airAssistOn ? styles.toggleOn : ''}
            disabled={!canClick}
            onClick={onToggleAirAssist}
            aria-label={i18n._('Air Assist')}
          >
            <span />
          </button>
          <strong>{airAssistOn ? i18n._('On') : i18n._('Off')}</strong>
        </div>
        <div className={styles.laserMode}>
          <label>{i18n._('Mode')}</label>
          <button
            type="button"
            className={laserMode === 'engrave' ? styles.isSelected : ''}
            onClick={this.handleSetEngrave}
          >
            {i18n._('Engrave')}
          </button>
          <button
            type="button"
            className={laserMode === 'cut' ? styles.isSelected : ''}
            onClick={this.handleSetCut}
          >
            {i18n._('Cut')}
          </button>
          <button type="button" disabled={!canFrame} onClick={onFrame}>
            <i className="fa fa-square-o" aria-hidden="true" />
            {i18n._('Frame')}
          </button>
          <button type="button" disabled={!canClick} onClick={this.handleTestOn}>
            <i className="fa fa-asterisk" aria-hidden="true" />
            {i18n._('Test Fire')}
          </button>
        </div>
        <div className={styles.presetRow}>
          <button type="button" disabled={!canClick} onClick={spindleRunning ? onSpindleStop : onSpindleStart}>
            <i className={'fa fa-' + (spindleRunning ? 'power-off' : 'play')} aria-hidden="true" />
            {spindleRunning ? i18n._('Laser Off') : i18n._('Laser On')}
          </button>
          <button type="button" disabled={!canClick} onClick={this.handleTestOff}>
            <i className="fa fa-stop" aria-hidden="true" />
            {i18n._('Stop Test')}
          </button>
          {['M3', 'M4', 'M5'].map(command => (
            <button
              key={command}
              type="button"
              disabled={!canClick}
              onClick={this.handleGCode(command)}
            >
              {command}
            </button>
          ))}
        </div>
      </Panel>
    );
  }
}

export default LaserPanel;
