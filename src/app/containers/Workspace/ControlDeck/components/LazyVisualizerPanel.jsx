import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import log from 'app/lib/log';
import Panel from './Panel';
import styles from '../control-deck.styl';

class LazyVisualizerPanel extends PureComponent {
  static propTypes = {
    activeFileName: PropTypes.string,
    bbox: PropTypes.object,
    onSetWorkCoordinateSystem: PropTypes.func,
    workCoordinateSystem: PropTypes.string
  };

  state = { Comp: null };

  _unmounted = false;

  componentDidMount() {
    import(/* webpackChunkName: "visualizer" */ './VisualizerPanel')
      .then(mod => {
        if (this._unmounted) {
          return;
        }
        this.setState({ Comp: mod.default });
      })
      .catch(err => {
        log.error('Failed to load visualizer panel', err);
      });
  }

  componentWillUnmount() {
    this._unmounted = true;
  }

  render() {
    const { Comp } = this.state;
    if (!Comp) {
      return (
        <Panel className={styles.visualizerPanel} title={i18n._('Workspace')}>
          <div
            className={styles.visualizerFrame}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              fontSize: '14px'
            }}
          >
            {i18n._('Loading visualizer…')}
          </div>
        </Panel>
      );
    }
    return <Comp {...this.props} />;
  }
}

export default LazyVisualizerPanel;
