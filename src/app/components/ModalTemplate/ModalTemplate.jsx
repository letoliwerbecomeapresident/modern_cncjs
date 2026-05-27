import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FlexContainer, Row, Col } from '../GridSystem';
import styles from './ModalTemplate.styl';

const ModalTemplate = ({ type, children, templateStyle }) => (
  <FlexContainer>
    <Row>
      <Col width="auto">
        {type === 'error' && <i className={classNames(styles.icon, styles.error)} />}
        {type === 'warning' && <i className={classNames(styles.icon, styles.warning)} />}
        {type === 'info' && <i className={classNames(styles.icon, styles.info)} />}
        {type === 'success' && <i className={classNames(styles.icon, styles.success)} />}
      </Col>
      <Col style={templateStyle}>
        {children}
      </Col>
    </Row>
  </FlexContainer>
);

ModalTemplate.propTypes = {
  type: PropTypes.oneOf([
    'error',
    'warning',
    'info',
    'success'
  ]),
  templateStyle: PropTypes.object,
};

export default ModalTemplate;
