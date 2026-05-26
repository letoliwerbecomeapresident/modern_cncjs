import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import VisualizerWidget from 'app/widgets/Visualizer';
import Panel from './Panel';
import styles from '../control-deck.styl';

const noop = () => {};

const formatSize = (bbox) => {
  if (!bbox) {
    return '--';
  }

  const x = Math.abs(Number(bbox.max.x) - Number(bbox.min.x)) || 0;
  const y = Math.abs(Number(bbox.max.y) - Number(bbox.min.y)) || 0;
  const z = Math.abs(Number(bbox.max.z) - Number(bbox.min.z)) || 0;

  return [x, y, z].map(value => value.toFixed(1)).join(' x ') + ' mm';
};

const VisualizerPanel = ({ activeFileName, bbox, onSetWorkCoordinateSystem, workCoordinateSystem }) => {
  const widgetProps = {
    onFork: noop,
    onRemove: noop,
    sortable: {
      handleClassName: styles.hiddenWidgetControl,
      filterClassName: styles.hiddenWidgetControl
    }
  };

  return (
    <Panel className={styles.visualizerPanel} title={i18n._('Workspace')}>
      <div className={styles.visualizerTopline}>
        <div className={styles.fileChip}>
          <span />
          <strong>{activeFileName || i18n._('No file loaded')}</strong>
          <i className="fa fa-angle-down" aria-hidden="true" />
        </div>
        <div className={styles.viewMode}>
          {['G54', 'G55', 'G56', 'G57'].map(wcs => (
            <button
              key={wcs}
              type="button"
              className={workCoordinateSystem === wcs ? styles.isSelected : ''}
              onClick={() => onSetWorkCoordinateSystem(wcs)}
            >
              {wcs}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.visualizerFrame}>
        <VisualizerWidget widgetId="visualizer" {...widgetProps} />
      </div>
      <div className={styles.visualizerFooter}>
        <span>{i18n._('Workspace')}: <strong>{workCoordinateSystem}</strong></span>
        <span>{i18n._('Size')}: <strong>{formatSize(bbox)}</strong></span>
        <span>{i18n._('File')}: <strong>{activeFileName || '--'}</strong></span>
      </div>
    </Panel>
  );
};

VisualizerPanel.propTypes = {
  activeFileName: PropTypes.string,
  bbox: PropTypes.object,
  onSetWorkCoordinateSystem: PropTypes.func,
  workCoordinateSystem: PropTypes.string
};

export default VisualizerPanel;
