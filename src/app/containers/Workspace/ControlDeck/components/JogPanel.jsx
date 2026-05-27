import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import Panel from './Panel';
import styles from '../control-deck.styl';

class JogPanel extends PureComponent {
  static propTypes = {
    canJog: PropTypes.bool,
    jogStep: PropTypes.number,
    onCommand: PropTypes.func,
    onJog: PropTypes.func,
    onSetJogStep: PropTypes.func
  };

  handleSetStep = (value) => () => this.props.onSetJogStep(value);

  handleJog = (axis, sign) => () => {
    const step = Number(this.props.jogStep) || 1;
    this.props.onJog(axis, sign * step);
  };

  handleHome = () => this.props.onCommand('homing');

  handleRapid = () => this.props.onCommand('rapidOverride', 100);

  handleStatus = () => this.props.onCommand('statusreport');

  render() {
    const { canJog, jogStep } = this.props;
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
                onClick={this.handleSetStep(value)}
              >
                {value}
              </button>
            ))}
          </span>
        )}
      >
        <div className={styles.jogContent}>
          <div className={styles.jogGrid}>
            <button type="button" disabled={!canJog} onClick={this.handleJog('y', 1)}>Y+</button>
            <button
              type="button"
              disabled={!canJog}
              onClick={this.handleJog('z', 1)}
              aria-label="Z+"
            >
              <i className="fa fa-caret-up" aria-hidden="true" />
            </button>
            <button type="button" disabled={!canJog} onClick={this.handleJog('z', 1)}>Z+</button>
            <button type="button" disabled={!canJog} onClick={this.handleJog('x', -1)}>X-</button>
            <button type="button" disabled={!canJog} onClick={this.handleHome}>
              <i className="fa fa-home" aria-hidden="true" />
              {i18n._('Home')}
            </button>
            <button type="button" disabled={!canJog} onClick={this.handleJog('x', 1)}>X+</button>
            <button type="button" disabled={!canJog} onClick={this.handleJog('y', -1)}>Y-</button>
            <button
              type="button"
              disabled={!canJog}
              onClick={this.handleJog('z', -1)}
              aria-label="Z-"
            >
              <i className="fa fa-caret-down" aria-hidden="true" />
            </button>
            <button type="button" disabled={!canJog} onClick={this.handleJog('z', -1)}>Z-</button>
          </div>
          <div className={styles.jogSide}>
            <button type="button" disabled={!canJog} onClick={this.handleRapid}>
              <span>{i18n._('Rapid')}</span>
              <strong>G0</strong>
            </button>
            <button type="button" disabled={!canJog} onClick={this.handleStatus}>
              <span>{i18n._('Status Report')}</span>
              <i className="fa fa-crosshairs" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Panel>
    );
  }
}

export default JogPanel;
