import PropTypes from 'prop-types';

// Shared legacy-context shape between the Form provider and its form controls.
const validationContextTypes = {
  $validation: PropTypes.shape({
    register: PropTypes.func.isRequired,
    unregister: PropTypes.func.isRequired,
    setProps: PropTypes.func.isRequired,
    getProps: PropTypes.func.isRequired
  })
};

export default validationContextTypes;
