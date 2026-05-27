import classNames from 'classnames';
import React from 'react';
import styles from './SectionGroup.styl';

const SectionGroup = ({ className, children, ...rest }) => (
  <div className={classNames(styles.sectionGroup, className)} {...rest}>
    {children}
  </div>
);

export default SectionGroup;
