import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import styles from '../control-deck.styl';

const noop = () => {};

const requestPanelFullscreen = (event) => {
  const panel = event.currentTarget.closest('section');
  const requestFullscreen = panel && (
    panel.requestFullscreen ||
    panel.webkitRequestFullscreen ||
    panel.mozRequestFullScreen ||
    panel.msRequestFullscreen
  );

  if (requestFullscreen) {
    requestFullscreen.call(panel);
  }
};

const Panel = ({ children, className, onFilter, onFullscreen, onRemove, showWindowActions, title, toolbar }) => (
  <section className={classNames(styles.panel, className)}>
    {(title || toolbar || showWindowActions) && (
      <div className={styles.panelHeader} data-panel-header>
        {title && <h2>{title}</h2>}
        <div className={styles.panelHeaderActions}>
          {toolbar && <div className={styles.panelToolbar}>{toolbar}</div>}
          {showWindowActions && (
            <div className={styles.windowActions}>
              <button
                type="button"
                onClick={onRemove}
                title={i18n._('Remove')}
                aria-label={i18n._('Remove')}
              >
                <i className="fa fa-trash-o" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onFilter}
                title={i18n._('Filter')}
                aria-label={i18n._('Filter')}
              >
                <i className="fa fa-filter" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onFullscreen}
                title={i18n._('Expand')}
                aria-label={i18n._('Expand')}
              >
                <i className="fa fa-expand" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    <div className={styles.panelBody}>
      {children}
    </div>
  </section>
);

Panel.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  onFilter: PropTypes.func,
  onFullscreen: PropTypes.func,
  onRemove: PropTypes.func,
  showWindowActions: PropTypes.bool,
  title: PropTypes.string,
  toolbar: PropTypes.node
};

Panel.defaultProps = {
  onFilter: noop,
  onFullscreen: requestPanelFullscreen,
  onRemove: noop,
  showWindowActions: true
};

export default Panel;
