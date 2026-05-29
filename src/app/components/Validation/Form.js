import React, { PureComponent } from 'react';
import validationContextTypes from './context';

const ensureArray = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const noop = () => {};

// Form provider for the local @trendmicro/react-validation reimplementation.
// Tracks registered controls in state, exposes getValues() and validate().
class Form extends PureComponent {
    static childContextTypes = validationContextTypes;

    state = {
      components: []
    };

    getChildContext() {
      return {
        $validation: {
          register: this.register,
          unregister: this.unregister,
          setProps: this.setProps,
          getProps: this.getProps
        }
      };
    }

    register = (component) => {
      if (!(component && component.props)) {
        return;
      }

      const hasCheckedProperty = component.props.type === 'radio' || component.props.type === 'checkbox';

      this.setState(state => ({
        components: [
          ...state.components,
          {
            component,
            props: {
              ...component.props,
              value: component.props.value || '',
              ...(hasCheckedProperty ? { checked: !!component.props.checked } : {})
            }
          }
        ]
      }), () => {
        this.invalidate();
      });
    };

    unregister = (component) => {
      this.setState(state => ({
        components: state.components.filter(c => c.component !== component)
      }), () => {
        this.invalidate();
      });
    };

    setProps = (component, props) => {
      this.setState(state => ({
        components: state.components.map((c) => {
          // Update component props
          if (c.component === component) {
            return { ...c, props: { ...c.props, ...props } };
          }

          // Uncheck other radio buttons in the same group
          if (c.props.type === 'radio' && c.component.props.name === component.props.name) {
            return { ...c, props: { ...c.props, checked: false } };
          }

          return c;
        })
      }), () => {
        this.invalidate();
      });
    };

    getProps = (component) => {
      const found = this.state.components.find(c => c.component === component);
      return found ? found.props : null;
    };

    invalidate = (callback = noop) => {
      const done = (typeof callback === 'function') ? callback : noop;
      const errors = [];

      this.setState((state) => {
        const componentsByName = state.components.reduce((acc, c) => {
          const name = c.props.name;
          if (!acc[name]) {
            acc[name] = [];
          }
          acc[name].push(c.props);
          return acc;
        }, {});

        return {
          components: state.components.map((c) => {
            const validations = ensureArray(c.props.validations);
            let error = null;

            for (const validation of validations) {
              error = validation(c.props.value, c.props, componentsByName);
              if (error) {
                errors.push({ ...c.props, error });
                break;
              }
            }

            return { ...c, props: { ...c.props, error } };
          })
        };
      }, () => {
        if (errors.length > 0) {
          done(errors);
        } else {
          done();
        }
      });
    };

    validate = (name = '', callback = noop) => {
      let fieldName = name;
      let done = callback;

      if (typeof fieldName === 'function') {
        done = fieldName;
        fieldName = '';
      }
      if (typeof done !== 'function') {
        done = noop;
      }

      this.setState(state => ({
        components: state.components.map((c) => {
          if (!fieldName || fieldName === c.props.name) {
            return { ...c, props: { ...c.props, blurred: true, changed: true } };
          }
          return c;
        })
      }), () => {
        this.invalidate(done);
      });
    };

    getValues() {
      return this.state.components.reduce((values, c) => {
        const { type, name, value, checked } = c.props;

        if ((type === 'radio' || type === 'checkbox') && !checked) {
          values[name] = values[name] || '';
          return values;
        }

        if (!Object.prototype.hasOwnProperty.call(values, name)) {
          values[name] = value;
        } else {
          values[name] = ('' + values[name]) ? ensureArray(values[name]).concat(value) : value;
        }

        return values;
      }, {});
    }

    get errors() {
      return this.state.components
        .filter(c => !!c.props.error)
        .map(c => c.props);
    }

    render() {
      const { onValidate, ...props } = this.props; // eslint-disable-line no-unused-vars
      return <form {...props} />;
    }
}

export default Form;
