import PropTypes from 'prop-types';
import React from 'react';
import settings from 'app/config/settings';
import i18n from 'app/lib/i18n';
import styles from '../control-deck.styl';

const FooterStatus = ({ activeFileName, controllerType, isConnected, onWorkflowCommand, port, workflowState }) => (
  <footer className={styles.footerBar}>
    <span><strong>{settings.version}</strong> {i18n._('App Version')}</span>
    <span><strong>{controllerType || '--'}</strong> {i18n._('Firmware')}</span>
    <span><strong>{workflowState}</strong> {i18n._('Status')}</span>
    <span><strong>{isConnected ? port : '--'}</strong> {i18n._('Connection')}</span>
    <button type="button" disabled={!activeFileName} onClick={() => onWorkflowCommand('unload')}>
      <i className="fa fa-eject" aria-hidden="true" />
      {i18n._('Unload G-code')}
    </button>
  </footer>
);

FooterStatus.propTypes = {
  activeFileName: PropTypes.string,
  controllerType: PropTypes.string,
  isConnected: PropTypes.bool,
  onWorkflowCommand: PropTypes.func,
  port: PropTypes.string,
  workflowState: PropTypes.string
};

export default FooterStatus;
