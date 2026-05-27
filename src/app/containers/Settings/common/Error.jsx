import classNames from 'classnames';
import React from 'react';
import styles from './Error.styl';

const Error = ({ className, children, ...rest }) => (
  <div className={classNames(styles.error, className)} {...rest}>
    {children}
  </div>
);

export default Error;
