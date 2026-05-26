import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import ConnectionControl from 'app/widgets/Connection/Connection';
import Panel from './Panel';
import styles from '../control-deck.styl';

const ConnectionPanel = ({ actions, state }) => (
  <Panel
    className={styles.connectionPanel}
    title={i18n._('Connect')}
    toolbar={<i className="fa fa-info-circle" aria-hidden="true" />}
  >
    <ConnectionControl state={state} actions={actions} />
  </Panel>
);

ConnectionPanel.propTypes = {
  actions: PropTypes.object,
  state: PropTypes.object
};

export default ConnectionPanel;
