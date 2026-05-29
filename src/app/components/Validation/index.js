import PropTypes from 'prop-types';
import React, { Component } from 'react';
import validationContextTypes from './context';
import Form from './Form';

// Local reimplementation of the subset of @trendmicro/react-validation that this
// codebase uses (Form, Input, Select, Textarea). Public API is preserved:
//   - Form ref exposes getValues() and validate(name?, callback)
//   - controls accept `validations` (array of (value, props, components) => node|null)
//   - the error node is rendered below the control once it has been blurred + changed

const shallowEqualObjects = (a, b) => {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(key => a[key] === b[key]);
};

const shallowEqualArrays = (a, b) => {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

class FormControl extends Component {
    static contextTypes = validationContextTypes;

    static propTypes = {
      element: PropTypes.oneOf(['input', 'select', 'textarea']),
      validations: PropTypes.arrayOf(PropTypes.func),
      onChange: PropTypes.func,
      onBlur: PropTypes.func
    };

    static defaultProps = {
      element: 'input',
      validations: []
    };

    componentDidMount() {
      this.context.$validation.register(this);
    }

    componentWillReceiveProps(nextProps) {
      const { validations, ...props } = this.props;
      const { validations: nextValidations, ...otherProps } = nextProps;

      if (!shallowEqualObjects(props, otherProps) || !shallowEqualArrays(validations, nextValidations)) {
        this.context.$validation.setProps(this, nextProps);
      }
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
      return nextContext !== this.context;
    }

    componentWillUnmount() {
      this.context.$validation.unregister(this);
    }

    handleChange = (event) => {
      if (event.persist) {
        event.persist();
      }

      if (this.props.onChange) {
        this.props.onChange(event);
      }

      this.context.$validation.setProps(this, {
        checked: event.target.checked,
        value: event.target.value,
        changed: true
      });
    };

    handleBlur = (event) => {
      if (event.persist) {
        event.persist();
      }

      if (this.props.onBlur) {
        this.props.onBlur(event);
      }

      this.context.$validation.setProps(this, {
        value: event.target.value,
        blurred: true
      });
    };

    render() {
      const props = this.context.$validation.getProps(this);

      if (!props) {
        return null;
      }

      const { element, validations, error, blurred, changed, ...rest } = props; // eslint-disable-line no-unused-vars

      return (
        <div>
          {React.createElement(element, {
            ...rest,
            onChange: this.handleChange,
            onBlur: this.handleBlur
          })}
          {blurred && changed && error}
        </div>
      );
    }
}

const Input = props => <FormControl {...props} element="input" />;
const Select = props => <FormControl {...props} element="select" />;
const Textarea = props => <FormControl {...props} element="textarea" />;

export {
  Form,
  Input,
  Select,
  Textarea
};
