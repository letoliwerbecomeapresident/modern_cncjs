import classNames from 'classnames';
import React from 'react';
import styles from './Ellipsis.styl';

const Ellipsis = ({ className, children, ...rest }) => (
  <div className={classNames(styles.ellipsis, className)} {...rest}>
    {children}
  </div>
);

const EllipsisBlock = ({ className, children, ...rest }) => (
  <div
    className={classNames(styles.ellipsis, styles.ellipsisBlock, className)}
    {...rest}
  >
    {children}
  </div>
);

const EllipsisInlineBlock = ({ className, children, ...rest }) => (
  <div
    className={classNames(styles.ellipsis, styles.ellipsisInlineBlock, className)}
    {...rest}
  >
    {children}
  </div>
);

export {
  EllipsisBlock,
  EllipsisInlineBlock
};
export default Ellipsis;
