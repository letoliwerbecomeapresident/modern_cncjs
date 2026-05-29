/* eslint react/jsx-no-bind: 0 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

// Local reimplementation of @trendmicro/react-paginations TablePagination.
// Preserves the props the Settings tables pass (page, pageLength, totalRecords,
// onPageChange, prevPageRenderer, nextPageRenderer, style) and folds in the
// records / page-length rendering that used to live in the wrapper.

const PAGE_LENGTH_MENU = [10, 25, 50, 100];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const TablePagination = ({
  page = 1,
  pageLength = 10,
  totalRecords = 0,
  pageLengthMenu = PAGE_LENGTH_MENU,
  onPageChange = () => {},
  prevPageRenderer = () => '‹',
  nextPageRenderer = () => '›',
  style
}) => {
  const totalPages = (totalRecords > 0) ? Math.ceil(totalRecords / pageLength) : 1;
  const currentPage = clamp(page, 1, totalPages);
  const from = clamp((currentPage - 1) * pageLength + 1, 1, totalRecords);
  const to = clamp((currentPage - 1) * pageLength + pageLength, 1, totalRecords);
  const prevPageDisabled = currentPage <= 1;
  const nextPageDisabled = currentPage >= totalPages;

  const records = (totalRecords > 0)
    ? i18n._('Records: {{from}} - {{to}} / {{total}}', { from, to, total: totalRecords })
    : i18n._('Records: {{total}}', { total: totalRecords });

  return (
    <div className={styles.tablePagination} style={style}>
      <span className={styles.records}>{records}</span>
      <select
        className={styles.pageLength}
        value={pageLength}
        onChange={(event) => {
          onPageChange({ page: 1, pageLength: Number(event.target.value) });
        }}
      >
        {pageLengthMenu.map(value => (
          <option key={value} value={value}>
            {i18n._('{{pageLength}} per page', { pageLength: value })}
          </option>
        ))}
      </select>
      <span className={styles.pageInfo}>{currentPage} / {totalPages}</span>
      <button
        type="button"
        className={classNames('btn', 'btn-default', 'btn-sm', { disabled: prevPageDisabled })}
        disabled={prevPageDisabled}
        onClick={() => {
          if (!prevPageDisabled) {
            onPageChange({ page: currentPage - 1, pageLength });
          }
        }}
      >
        {prevPageRenderer()}
      </button>
      <button
        type="button"
        className={classNames('btn', 'btn-default', 'btn-sm', { disabled: nextPageDisabled })}
        disabled={nextPageDisabled}
        onClick={() => {
          if (!nextPageDisabled) {
            onPageChange({ page: currentPage + 1, pageLength });
          }
        }}
      >
        {nextPageRenderer()}
      </button>
    </div>
  );
};

TablePagination.propTypes = {
  page: PropTypes.number,
  pageLength: PropTypes.number,
  totalRecords: PropTypes.number,
  pageLengthMenu: PropTypes.array,
  onPageChange: PropTypes.func,
  prevPageRenderer: PropTypes.func,
  nextPageRenderer: PropTypes.func,
  style: PropTypes.object
};
