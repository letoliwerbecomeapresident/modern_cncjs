import React from 'react';
import i18n from 'app/lib/i18n';
import ConsoleWidget from 'app/widgets/Console';
import Panel from './Panel';
import styles from '../control-deck.styl';

const noop = () => {};

const ConsolePanel = () => {
  const widgetProps = {
    onFork: noop,
    onRemove: noop,
    sortable: {
      handleClassName: styles.hiddenWidgetControl,
      filterClassName: styles.hiddenWidgetControl
    }
  };

  return (
    <Panel
      className={styles.consolePanel}
      title={i18n._('Console')}
    >
      <ConsoleWidget widgetId="console" {...widgetProps} />
    </Panel>
  );
};

export default ConsolePanel;
