import extend from 'lodash/extend';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import merge from 'lodash/merge';
import set from 'lodash/set';
import unset from 'lodash/unset';
import events from 'events';

class ImmutableStore extends events.EventEmitter {
    state = {};

    constructor(state = {}) {
      super();

      this.state = state;
    }

    get(key, defaultValue) {
      return (key === undefined) ? this.state : get(this.state, key, defaultValue);
    }

    set(key, value) {
      const prevValue = this.get(key);
      if (typeof value === 'object' && isEqual(value, prevValue)) {
        return this.state;
      }
      if (value === prevValue) {
        return this.state;
      }

      this.state = merge({}, this.state, set({}, key, value));
      this.emit('change', this.state);
      return this.state;
    }

    unset(key) {
      let state = extend({}, this.state);
      unset(state, key);
      this.state = state;
      this.emit('change', this.state);
      return this.state;
    }

    replace(key, value) {
      const prevValue = this.get(key);
      if (typeof value === 'object' && isEqual(value, prevValue)) {
        return this.state;
      }
      if (value === prevValue) {
        return this.state;
      }

      this.unset(key);
      this.set(key, value);
      return this.state;
    }

    clear() {
      this.state = {};
      this.emit('change', this.state);
      return this.state;
    }
}

export default ImmutableStore;
