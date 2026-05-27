import classNames from 'classnames';
import React from 'react';
import styles from './SectionTitle.styl';

const SectionTitle = ({ className, children, ...rest }) => (
  <div className={classNames(styles.sectionTitle, className)} {...rest}>
    {children}
  </div>
);

export default SectionTitle;
