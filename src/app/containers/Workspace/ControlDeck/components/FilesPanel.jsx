import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Dropzone from 'react-dropzone';
import i18n from 'app/lib/i18n';
import Panel from './Panel';
import styles from '../control-deck.styl';

class FilesPanel extends PureComponent {
  static propTypes = {
    activeFileName: PropTypes.string,
    isLoading: PropTypes.bool,
    onDrop: PropTypes.func,
    onLoadFile: PropTypes.func,
    onRefresh: PropTypes.func,
    watchFiles: PropTypes.array
  };

  static defaultProps = {
    watchFiles: []
  };

  handleFileInputChange = (event) => {
    const files = Array.prototype.slice.call(event.target.files || []);
    this.props.onDrop(files);
    event.target.value = null;
  };

  handleLoadFile = (file) => () => this.props.onLoadFile(file);

  render() {
    const { activeFileName, isLoading, onDrop, onRefresh, watchFiles } = this.props;
    const visibleFiles = watchFiles.filter(file => file.type === 'f').slice(0, 6);

    return (
      <Panel
        className={styles.filesPanel}
        title={i18n._('Files')}
        toolbar={(
          <span>
            <button
              type="button"
              onClick={onRefresh}
              title={i18n._('Refresh')}
              aria-label={i18n._('Refresh')}
            >
              <i className="fa fa-refresh" aria-hidden="true" />
            </button>
            <label className={styles.toolbarUpload} title={i18n._('Upload')} aria-label={i18n._('Upload')}>
              <i className="fa fa-upload" aria-hidden="true" />
              <input type="file" onChange={this.handleFileInputChange} />
            </label>
          </span>
        )}
      >
        <div className={styles.searchBox}>
          <i className="fa fa-search" aria-hidden="true" />
          <span>{i18n._('Search files...')}</span>
        </div>
        <div className={styles.fileList}>
          {isLoading && <div className={styles.fileRow}>{i18n._('Loading...')}</div>}
          {!isLoading && visibleFiles.length === 0 && (
            <div className={styles.emptyFileList}>{i18n._('No files in watch directory')}</div>
          )}
          {visibleFiles.map(file => (
            <button
              key={file.name}
              type="button"
              className={classNames(styles.fileRow, { [styles.selectedFile]: file.name === activeFileName })}
              onClick={this.handleLoadFile(file)}
            >
              <i className="fa fa-file-code-o" aria-hidden="true" />
              <span>{file.name}</span>
              <small>{file.mtime || ''}</small>
            </button>
          ))}
        </div>
        <Dropzone
          className={styles.uploadTarget}
          disablePreview
          multiple={false}
          onDrop={onDrop}
        >
          <span>{i18n._('Drag & drop G-code here')}</span>
          <strong>{i18n._('or click to upload')}</strong>
        </Dropzone>
      </Panel>
    );
  }
}

export default FilesPanel;
