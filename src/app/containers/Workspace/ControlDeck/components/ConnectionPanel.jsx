import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import ConnectionControl from 'app/widgets/Connection/Connection';
import Panel from './Panel';
import styles from '../control-deck.styl';

class ConnectionPanel extends PureComponent {
  static propTypes = {
    actions: PropTypes.object,
    state: PropTypes.object
  };

  render() {
    const { actions, state } = this.props;
    return (
      <Panel
        className={styles.connectionPanel}
        title={i18n._('Connect')}
        toolbar={<i className="fa fa-info-circle" aria-hidden="true" />}
      >
        <ConnectionControl state={state} actions={actions} />
      </Panel>
    );
  }
}

export default ConnectionPanel;
