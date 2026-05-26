import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import styles from '../control-deck.styl';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const overlaps = (a, b) => (
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y
);

const cloneLayout = layout => layout.map(item => ({ ...item }));

const layoutsEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    const item = a[i];
    const other = findById(b, item.id);

    if (!other || item.x !== other.x || item.y !== other.y || item.w !== other.w || item.h !== other.h) {
      return false;
    }
  }

  return true;
};

const findById = (items, id) => {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].id === id) {
      return items[i];
    }
  }

  return null;
};

class ModularDashboard extends PureComponent {
  state = {
    active: null,
    layout: this.resolveLayout(cloneLayout(this.props.layout), null)
  };

  componentDidMount() {
    const layout = this.resolveLayout(cloneLayout(this.props.layout), null);

    if (!layoutsEqual(layout, this.props.layout)) {
      this.props.onLayoutChange(cloneLayout(layout));
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.layout !== this.props.layout && !this.state.active) {
      this.setState({ layout: this.resolveLayout(cloneLayout(nextProps.layout), null) });
    }
  }

  componentWillUnmount() {
    this.removeWindowListeners();
    this.restoreSelection();
  }

  setDashboardRef = (node) => {
    this.dashboard = node;
  };

  getItemSpec(id) {
    return findById(this.props.items, id) || {};
  }

  getLayoutItem(layout, id) {
    return findById(layout, id);
  }

  getCellSize() {
    const rect = this.dashboard.getBoundingClientRect();

    return {
      width: rect.width / this.props.columns,
      height: rect.height / this.props.rows
    };
  }

  getNormalizedLayout(layout) {
    return layout.map(item => {
      const spec = this.getItemSpec(item.id);
      const minW = spec.minW || 3;
      const minH = spec.minH || 3;
      const w = clamp(item.w, minW, this.props.columns);
      const h = clamp(item.h, minH, this.props.rows);

      return {
        ...item,
        w,
        h,
        x: clamp(item.x, 0, this.props.columns - w),
        y: clamp(item.y, 0, this.props.rows - h)
      };
    });
  }

  compactLayout(layout, activeId) {
    const compacted = cloneLayout(layout);
    const ordered = compacted
      .filter(item => item.id !== activeId)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    ordered.forEach(item => {
      let nextY = item.y;
      while (nextY > 0) {
        const candidate = { ...item, y: nextY - 1 };
        const hasCollision = compacted.some(other => other.id !== item.id && overlaps(candidate, other));

        if (hasCollision) {
          break;
        }
        nextY -= 1;
      }
      item.y = nextY;
    });

    return compacted;
  }

  resolveLayout(layout, activeId) {
    let resolved = this.getNormalizedLayout(layout);

    for (let pass = 0; pass < resolved.length * 4; pass += 1) {
      let moved = false;
      const ordered = resolved
        .slice()
        .sort((a, b) => {
          if (a.id === activeId) {
            return -1;
          }
          if (b.id === activeId) {
            return 1;
          }
          return (a.y - b.y) || (a.x - b.x);
        });

      for (let i = 0; i < ordered.length; i += 1) {
        for (let j = i + 1; j < ordered.length; j += 1) {
          const source = ordered[i];
          const target = ordered[j];

          if (!overlaps(source, target)) {
            continue;
          }

          const nextY = source.y + source.h;
          if (nextY + target.h <= this.props.rows) {
            target.y = nextY;
          } else {
            target.y = Math.max(0, this.props.rows - target.h);
            target.x = clamp(source.x + source.w, 0, this.props.columns - target.w);
          }
          moved = true;
        }
      }

      if (!moved) {
        break;
      }
      resolved = this.getNormalizedLayout(resolved);
    }

    return this.compactLayout(resolved, activeId);
  }

  updateActiveItem(event) {
    const { active } = this.state;
    if (!active) {
      return;
    }

    const cell = this.getCellSize();
    const deltaX = Math.round((event.clientX - active.startX) / cell.width);
    const deltaY = Math.round((event.clientY - active.startY) / cell.height);
    const layout = cloneLayout(active.startLayout);
    const item = this.getLayoutItem(layout, active.id);
    const spec = this.getItemSpec(active.id);

    if (!item) {
      return;
    }

    if (active.mode === 'resize') {
      const minW = spec.minW || 3;
      const minH = spec.minH || 3;
      item.w = clamp(active.startItem.w + deltaX, minW, this.props.columns - item.x);
      item.h = clamp(active.startItem.h + deltaY, minH, this.props.rows - item.y);
    } else {
      item.x = clamp(active.startItem.x + deltaX, 0, this.props.columns - item.w);
      item.y = clamp(active.startItem.y + deltaY, 0, this.props.rows - item.h);
    }

    this.setState({
      layout: this.resolveLayout(layout, active.id)
    });
  }

  handleMouseMove = (event) => {
    event.preventDefault();
    this.updateActiveItem(event);
  };

  handleMouseUp = () => {
    const { onLayoutChange } = this.props;
    const { layout } = this.state;

    this.removeWindowListeners();
    this.restoreSelection();
    this.setState({ active: null });
    onLayoutChange(cloneLayout(layout));
  };

  addWindowListeners() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  removeWindowListeners() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  preventSelection() {
    this.previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
  }

  restoreSelection() {
    if (typeof this.previousUserSelect === 'string') {
      document.body.style.userSelect = this.previousUserSelect;
      this.previousUserSelect = null;
    }
  }

  startInteraction(id, mode, event) {
    if (event.button !== 0 || !this.dashboard) {
      return;
    }

    const layout = cloneLayout(this.state.layout);
    const item = this.getLayoutItem(layout, id);

    if (!item) {
      return;
    }

    event.preventDefault();
    this.preventSelection();
    this.addWindowListeners();
    this.setState({
      active: {
        id,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startItem: { ...item },
        startLayout: layout
      }
    });
  }

  handleModuleMouseDown = (id, event) => {
    const interactive = event.target.closest('button, a, input, textarea, select, [role="button"]');
    const header = event.target.closest('[data-panel-header]');

    if (!header || interactive) {
      return;
    }

    this.startInteraction(id, 'drag', event);
  };

  handleResizeMouseDown = (id, event) => {
    this.startInteraction(id, 'resize', event);
  };

  renderGuide() {
    const { active, layout } = this.state;
    if (!active) {
      return null;
    }

    const item = this.getLayoutItem(layout, active.id);
    if (!item) {
      return null;
    }

    return (
      <div
        className={styles.dropGuide}
        style={{
          left: (item.x / this.props.columns * 100) + '%',
          top: (item.y / this.props.rows * 100) + '%',
          width: (item.w / this.props.columns * 100) + '%',
          height: (item.h / this.props.rows * 100) + '%'
        }}
      />
    );
  }

  renderItem(item) {
    const layoutItem = this.getLayoutItem(this.state.layout, item.id);
    if (!layoutItem) {
      return null;
    }

    const { active } = this.state;
    const isActive = active && active.id === item.id;

    return (
      <div
        key={item.id}
        role="presentation"
        className={classNames(styles.moduleItem, { [styles.isMoving]: isActive })}
        onMouseDown={event => this.handleModuleMouseDown(item.id, event)}
        style={{
          left: (layoutItem.x / this.props.columns * 100) + '%',
          top: (layoutItem.y / this.props.rows * 100) + '%',
          width: (layoutItem.w / this.props.columns * 100) + '%',
          height: (layoutItem.h / this.props.rows * 100) + '%'
        }}
      >
        <div className={styles.moduleFrame}>
          {item.children}
          <button
            type="button"
            className={styles.resizeHandle}
            onMouseDown={event => this.handleResizeMouseDown(item.id, event)}
            aria-label={i18n._('Size')}
          />
        </div>
      </div>
    );
  }

  render() {
    const { active } = this.state;

    return (
      <div
        ref={this.setDashboardRef}
        className={classNames(styles.modularDashboard, { [styles.isEditingLayout]: !!active })}
      >
        <div
          className={styles.supportGrid}
          style={{
            backgroundSize: (100 / this.props.columns) + '% ' + (100 / this.props.rows) + '%'
          }}
        />
        {this.renderGuide()}
        {this.props.items.map(item => this.renderItem(item))}
      </div>
    );
  }
}

ModularDashboard.propTypes = {
  columns: PropTypes.number,
  items: PropTypes.arrayOf(PropTypes.shape({
    children: PropTypes.node,
    id: PropTypes.string.isRequired,
    minH: PropTypes.number,
    minW: PropTypes.number
  })).isRequired,
  layout: PropTypes.arrayOf(PropTypes.shape({
    h: PropTypes.number.isRequired,
    id: PropTypes.string.isRequired,
    w: PropTypes.number.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  })).isRequired,
  onLayoutChange: PropTypes.func,
  rows: PropTypes.number
};

ModularDashboard.defaultProps = {
  columns: 24,
  onLayoutChange: () => {},
  rows: 24
};

export default ModularDashboard;
