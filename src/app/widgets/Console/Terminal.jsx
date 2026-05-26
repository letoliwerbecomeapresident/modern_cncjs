import cx from 'classnames';
import trimEnd from 'lodash/trimEnd';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import History from './History';
import styles from './index.styl';

// Minimal SGR parser for chalk output. Handles foreground colors (30-37, 90-97,
// 39 reset) and bold (1, 22, 0). Anything else is dropped silently.
// eslint-disable-next-line no-control-regex
const SGR_RE = /\[([0-9;]*)m/g;

const FG_CLASS = {
  30: 'fgBlack',
  31: 'fgRed',
  32: 'fgGreen',
  33: 'fgYellow',
  34: 'fgBlue',
  35: 'fgMagenta',
  36: 'fgCyan',
  37: 'fgWhite',
  90: 'fgGray',
  91: 'fgRedBright',
  92: 'fgGreenBright',
  93: 'fgYellowBright',
  94: 'fgBlueBright',
  95: 'fgMagentaBright',
  96: 'fgCyanBright',
  97: 'fgWhiteBright'
};

const parseSgr = (text) => {
  if (!text) {
    return [];
  }
  const segments = [];
  let lastIndex = 0;
  let cur = { fg: null, bold: false };
  SGR_RE.lastIndex = 0;
  let match = SGR_RE.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), fg: cur.fg, bold: cur.bold });
    }
    const codes = match[1].length > 0 ? match[1].split(';') : ['0'];
    for (let k = 0; k < codes.length; ++k) {
      const n = Number(codes[k]);
      if (n === 0) {
        cur = { fg: null, bold: false };
      } else if (n === 1) {
        cur = { ...cur, bold: true };
      } else if (n === 22) {
        cur = { ...cur, bold: false };
      } else if (n === 39) {
        cur = { ...cur, fg: null };
      } else if (FG_CLASS[n]) {
        cur = { ...cur, fg: FG_CLASS[n] };
      }
    }
    lastIndex = SGR_RE.lastIndex;
    match = SGR_RE.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), fg: cur.fg, bold: cur.bold });
  }
  return segments;
};

const renderSegments = (segments) => segments.map((seg, i) => {
  const className = cx({
    [styles[seg.fg]]: !!seg.fg,
    [styles.bold]: seg.bold
  });
  if (!className) {
    return seg.text;
  }
  return <span key={i} className={className}>{seg.text}</span>;
});

class TerminalWrapper extends PureComponent {
    static propTypes = {
      cols: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      rows: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      cursorBlink: PropTypes.bool,
      scrollback: PropTypes.number,
      tabStopWidth: PropTypes.number,
      onData: PropTypes.func,
      className: PropTypes.string,
      style: PropTypes.object
    };

    static defaultProps = {
      cols: 'auto',
      rows: 'auto',
      cursorBlink: true,
      scrollback: 1000,
      tabStopWidth: 4,
      onData: () => {}
    };

    prompt = '> ';

    history = new History(1000);

    state = {
      lines: [],
      input: ''
    };

    _lineSeq = 0;

    _scrollEl = null;

    _inputEl = null;

    _historyCommand = '';

    _followBottom = true;

    appendLines = (texts) => {
      if (!texts || !texts.length) {
        return;
      }
      const { scrollback } = this.props;
      const cap = Math.max(1, Number(scrollback) || 1000);
      const next = this.state.lines.slice();
      for (let i = 0; i < texts.length; ++i) {
        const raw = String(texts[i]);
        const parts = raw.split(/\r?\n/);
        for (let j = 0; j < parts.length; ++j) {
          next.push({ id: ++this._lineSeq, segments: parseSgr(parts[j]) });
        }
      }
      if (next.length > cap) {
        next.splice(0, next.length - cap);
      }
      this.setState({ lines: next });
    };

    writeln = (line) => {
      this.appendLines([line]);
    };

    // Public method for the batched read path in widgets/Console/index.jsx.
    // Single setState per batch — caller already throttles to 20 Hz.
    writeBatch = (lines) => {
      this.appendLines(lines);
    };

    clear = () => {
      this.setState({ lines: [] });
    };

    // No-op: DOM layout follows the container; xterm-style fit() is unnecessary.
    resize = () => {};

    selectAll = () => {
      if (!this._scrollEl) {
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(this._scrollEl);
      const sel = window.getSelection();
      if (!sel) {
        return;
      }
      sel.removeAllRanges();
      sel.addRange(range);
    };

    clearSelection = () => {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
      }
    };

    handleInputChange = (e) => {
      this.setState({ input: e.target.value });
      this._historyCommand = '';
    };

    handleKeyDown = (e) => {
      const { onData } = this.props;

      if (e.key === 'Enter') {
        e.preventDefault();
        const buffer = trimEnd(this.state.input);
        if (buffer.length > 0) {
          this._historyCommand = '';
          this.history.resetIndex();
          this.history.push(buffer);
          this.appendLines([this.prompt + buffer]);
        } else {
          this.appendLines([this.prompt]);
        }
        onData(buffer + '\n');
        this.setState({ input: '' });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this._historyCommand) {
          this._historyCommand = this.history.current() || '';
        } else if (this.history.index > 0) {
          this._historyCommand = this.history.back() || '';
        }
        this.setState({ input: this._historyCommand });
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._historyCommand = this.history.forward() || '';
        this.setState({ input: this._historyCommand });
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this._historyCommand = '';
        this.setState({ input: '' });
        return;
      }

      // Non-printable with Ctrl/Meta — forward raw control char so controllers
      // can receive things like Ctrl+X (real-time reset on Grbl).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key && e.key.length === 1) {
        const code = e.key.toUpperCase().charCodeAt(0);
        if (code >= 64 && code <= 95) {
          e.preventDefault();
          onData(String.fromCharCode(code - 64));
        }
      }
    };

    handlePaste = (e) => {
      const data = (e.clipboardData || window.clipboardData) && (e.clipboardData || window.clipboardData).getData('text');
      if (!data) {
        return;
      }
      const normalized = String(data).replace(/(\r\n|\r|\n)/g, '\n');
      if (normalized.indexOf('\n') === -1) {
        // Single-line paste — let the input handle it natively.
        return;
      }
      e.preventDefault();
      const lines = normalized.split('\n');
      const { onData } = this.props;
      const echoed = [];
      for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();
        if (line.length) {
          onData(line + '\n');
          echoed.push(this.prompt + line);
        }
      }
      if (echoed.length) {
        this.appendLines(echoed);
      }
    };

    handleScroll = () => {
      const el = this._scrollEl;
      if (!el) {
        return;
      }
      this._followBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
    };

    componentDidUpdate(prevProps, prevState) {
      if (prevState.lines !== this.state.lines && this._followBottom && this._scrollEl) {
        this._scrollEl.scrollTop = this._scrollEl.scrollHeight;
      }
    }

    render() {
      const { className, style, cursorBlink } = this.props;
      const { lines, input } = this.state;

      return (
        <div
          className={cx(className, styles.terminalContainer)}
          style={style}
        >
          <div
            ref={el => {
              this._scrollEl = el;
            }}
            role="log"
            aria-live="polite"
            aria-label="Console output"
            className={styles.terminalOutput}
            onScroll={this.handleScroll}
          >
            {lines.map(line => (
              <div key={line.id} className={styles.terminalLine}>
                {renderSegments(line.segments)}
              </div>
            ))}
          </div>
          <div className={styles.terminalInputRow}>
            <span className={styles.terminalPrompt}>{this.prompt}</span>
            <input
              ref={el => {
                this._inputEl = el;
              }}
              type="text"
              className={cx(styles.terminalInput, { [styles.cursorBlink]: cursorBlink })}
              value={input}
              onChange={this.handleInputChange}
              onKeyDown={this.handleKeyDown}
              onPaste={this.handlePaste}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      );
    }
}

export default TerminalWrapper;
