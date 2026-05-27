import classNames from 'classnames';
import React from 'react';
import styles from './TabularForm.styl';

const TabularForm = ({ className, children, ...rest }) => (
  <div className={classNames(styles.tabularForm, className)} {...rest}>
    {children}
  </div>
);

TabularForm.Row = ({ className, children, ...rest }) => (
  <div className={classNames(styles.row, className)} {...rest}>
    {children}
  </div>
);

TabularForm.Col = ({ className, condensed, nowrap, children, ...rest }) => (
  <div
    className={classNames(
      styles.col,
      {
        [styles.condensed]: condensed,
        [styles.nowrap]: nowrap,
      },
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export default TabularForm;
