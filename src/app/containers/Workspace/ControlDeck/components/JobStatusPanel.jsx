import get from 'lodash/get';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import { formatRuntime, getProgress } from '../lib/formatters';
import Panel from './Panel';
import styles from '../control-deck.styl';

const JobStatusPanel = ({ activeFileName, canPause, canRun, canStop, feederStatus, onWorkflowCommand, senderStatus, workflowState }) => {
  const progress = getProgress(senderStatus);
  const holdReason = get(feederStatus, 'holdReason.msg') || get(senderStatus, 'holdReason.msg') || '';

  return (
    <Panel className={styles.jobPanel} title={i18n._('Job Status')}>
      <div className={styles.tabs}>
        <button type="button" className={styles.activeTab}>{i18n._('Job Status')}</button>
        <button
          type="button"
          disabled={!canRun}
          onClick={() => onWorkflowCommand('run')}
          title={i18n._('Cycle Start')}
          aria-label={i18n._('Cycle Start')}
        >
          <i className="fa fa-play" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={!canPause}
          onClick={() => onWorkflowCommand('pause')}
          title={i18n._('Pause')}
          aria-label={i18n._('Pause')}
        >
          <i className="fa fa-pause" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={!canStop}
          onClick={() => onWorkflowCommand('stop')}
          title={i18n._('Stop')}
          aria-label={i18n._('Stop')}
        >
          <i className="fa fa-stop" aria-hidden="true" />
        </button>
      </div>
      <div className={styles.jobBody}>
        <div className={styles.jobMain}>
          <label>{i18n._('File')}</label>
          <strong>{activeFileName || i18n._('No file loaded')}</strong>
          <label>{i18n._('Progress')}</label>
          <div className={styles.progressBar}>
            <span style={{ width: progress + '%' }} />
          </div>
          <div className={styles.jobTimes}>
            <span>{i18n._('Time Elapsed')}<strong>{formatRuntime(get(senderStatus, 'elapsedTime', 0))}</strong></span>
            <span>{i18n._('Time Remaining')}<strong>{formatRuntime(get(senderStatus, 'remainingTime', 0))}</strong></span>
          </div>
        </div>
        <div className={styles.previewThumb}>
          <i className="fa fa-object-group" aria-hidden="true" />
        </div>
        <dl>
          <dt>{i18n._('Est. Total Time')}</dt>
          <dd>{formatRuntime(get(senderStatus, 'estimatedTime', 0))}</dd>
          <dt>{i18n._('Lines')}</dt>
          <dd>{get(senderStatus, 'total', 0)}</dd>
          <dt>{i18n._('Status')}</dt>
          <dd>{holdReason || workflowState}</dd>
        </dl>
        {holdReason && <div className={styles.jobNotice}>{holdReason}</div>}
      </div>
    </Panel>
  );
};

JobStatusPanel.propTypes = {
  activeFileName: PropTypes.string,
  canPause: PropTypes.bool,
  canRun: PropTypes.bool,
  canStop: PropTypes.bool,
  feederStatus: PropTypes.object,
  onWorkflowCommand: PropTypes.func,
  senderStatus: PropTypes.object,
  workflowState: PropTypes.string
};

JobStatusPanel.defaultProps = {
  feederStatus: {},
  senderStatus: {}
};

export default JobStatusPanel;
