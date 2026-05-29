import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Local reimplementation of the subset of @trendmicro/react-table that this
// codebase uses. Flat column model only (no nested headers, sorting, fixed
// header/columns or loaders — none of which the Settings tables rely on).
//
// Column shape: { title, key, className, render(value, row, index) }
// Props: { data, columns, rowKey, title, emptyText, bordered, justified }

const renderNode = (node, ...args) => (
  (typeof node === 'function') ? node(...args) : node
);

const Table = ({
  bordered = true,
  justified = true,
  data = [],
  columns = [],
  rowKey,
  title,
  emptyText
}) => {
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index);
    }
    if (typeof rowKey === 'string') {
      return row[rowKey];
    }
    return index;
  };

  return (
    <div>
      {renderNode(title)}
      <table
        className={classNames('table', { 'table-bordered': bordered })}
        style={{ tableLayout: justified ? 'fixed' : 'auto' }}
      >
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.key || index} className={column.className}>
                {renderNode(column.title)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.length === 0) ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: 'center', padding: '20px' }}
              >
                {renderNode(emptyText)}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex)}>
                {columns.map((column, colIndex) => {
                  const value = column.key ? row[column.key] : undefined;
                  return (
                    <td key={column.key || colIndex} className={column.className}>
                      {(typeof column.render === 'function')
                        ? column.render(value, row, rowIndex)
                        : value}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

Table.propTypes = {
  bordered: PropTypes.bool,
  justified: PropTypes.bool,
  data: PropTypes.array,
  columns: PropTypes.array,
  rowKey: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  title: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  emptyText: PropTypes.oneOfType([PropTypes.func, PropTypes.node])
};

export default Table;
