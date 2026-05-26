import classNames from 'classnames';
import React from 'react';
import i18n from 'app/lib/i18n';
import styles from '../control-deck.styl';

const SideNav = () => {
  const items = [
    ['th-large', i18n._('Dashboard')],
    ['folder', i18n._('Files')],
    ['crosshairs', i18n._('Jog')],
    ['wrench', i18n._('Tools')],
    ['sun-o', i18n._('Laser')],
    ['code', i18n._('Macros')],
    ['gear', i18n._('Settings')]
  ];

  return (
    <nav className={styles.sideNav} aria-label={i18n._('Workspace navigation')}>
      {items.map((item, index) => (
        <button
          key={item[1]}
          type="button"
          className={classNames({ [styles.activeNavItem]: index === 0 })}
        >
          <i className={'fa fa-fw fa-' + item[0]} aria-hidden="true" />
          <span>{item[1]}</span>
        </button>
      ))}
    </nav>
  );
};

export default SideNav;
