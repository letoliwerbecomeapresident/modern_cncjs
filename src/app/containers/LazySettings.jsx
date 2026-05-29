import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import log from 'app/lib/log';

class LazySettings extends PureComponent {
    state = { Comp: null };

    _unmounted = false;

    componentDidMount() {
      import(/* webpackChunkName: "settings" */ './Settings')
        .then(mod => {
          if (this._unmounted) {
            return;
          }
          this.setState({ Comp: mod.default });
        })
        .catch(err => {
          log.error('Failed to load settings', err);
        });
    }

    componentWillUnmount() {
      this._unmounted = true;
    }

    render() {
      const { Comp } = this.state;
      if (!Comp) {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: '#888',
              fontSize: '14px'
            }}
          >
            {i18n._('Loading...')}
          </div>
        );
      }
      return <Comp {...this.props} />;
    }
}

export default LazySettings;
