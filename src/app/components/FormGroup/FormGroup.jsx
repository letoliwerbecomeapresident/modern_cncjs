import classNames from 'classnames';
import React from 'react';
import styles from './FormGroup.styl';

const FormGroup = ({ className, children, ...rest }) => (
  <div className={classNames(styles.formGroup, className)} {...rest}>
    {children}
  </div>
);

export default FormGroup;
