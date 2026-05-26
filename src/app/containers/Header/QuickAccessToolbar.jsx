import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class QuickAccessToolbar extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    command = {
      'cyclestart': () => {
        controller.command('cyclestart');
      },
      'feedhold': () => {
        controller.command('feedhold');
      },
      'homing': () => {
        controller.command('homing');
      },
      'sleep': () => {
        controller.command('sleep');
      },
      'unlock': () => {
        controller.command('unlock');
      },
      'reset': () => {
        controller.command('reset');
      },
    };

    render() {
      return (
        <div role="toolbar" aria-label="Quick access toolbar" className={styles.quickAccessToolbar}>
          <ul className="nav navbar-nav">
            <li className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className="btn btn-success"
                onClick={this.command.cyclestart}
                title={i18n._('Cycle Start')}
              >
                <i aria-hidden="true" className="fa fa-repeat" />
                <span>{i18n._('Cycle Start')}</span>
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={this.command.feedhold}
                title={i18n._('Feedhold')}
              >
                <i aria-hidden="true" className="fa fa-hand-paper-o" />
                <span>{i18n._('Feedhold')}</span>
              </button>
            </li>
            <li className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.command.homing}
                title={i18n._('Homing')}
              >
                <i aria-hidden="true" className="fa fa-home" />
                <span>{i18n._('Homing')}</span>
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={this.command.sleep}
                title={i18n._('Sleep')}
              >
                <i aria-hidden="true" className="fa fa-bed" />
                <span>{i18n._('Sleep')}</span>
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={this.command.unlock}
                title={i18n._('Unlock')}
              >
                <i aria-hidden="true" className="fa fa-unlock-alt" />
                <span>{i18n._('Unlock')}</span>
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={this.command.reset}
                title={i18n._('Reset')}
              >
                <i aria-hidden="true" className="fa fa-undo" />
                <span>{i18n._('Reset')}</span>
              </button>
            </li>
          </ul>
        </div>
      );
    }
}

export default QuickAccessToolbar;
