import React, {PropTypes} from 'react';
import ReactDOM from 'react-dom';
import { KeyCode } from 'rc-util';
import classnames from 'classnames';
import assign from 'object-assign';
import Animate from 'rc-animate';
import {
  getPropValue, getValuePropValue, isCombobox,
  isMultipleOrTags, isMultipleOrTagsOrCombobox,
  isSingleMode, toArray, getTreeNodesStates,
  flatToHierarchy,
} from './util';
import SelectTrigger from './SelectTrigger';
import _TreeNode from './TreeNode';

function noop() {
}

function filterFn(input, child) {
  return String(getPropValue(child, this.props.treeNodeFilterProp)).indexOf(input) > -1;
}

function saveRef(name, component) {
  this[name] = component;
}

function loopTreeData(data, level = 0) {
  return data.map((item, index) => {
    const pos = `${level}-${index}`;
    const props = {
      title: item.label,
      value: item.value,
      key: item.key || item.value || pos,
    };
    let ret;
    if (item.children && item.children.length) {
      ret = (<_TreeNode {...props}>{loopTreeData(item.children, pos)}</_TreeNode>);
    } else {
      ret = (<_TreeNode {...props} isLeaf={item.isLeaf}/>);
    }
    return ret;
  });
}

const Select = React.createClass({
  propTypes: {
    children: PropTypes.any,
    multiple: PropTypes.bool,
    filterTreeNode: PropTypes.any,
    showSearch: PropTypes.bool,
    disabled: PropTypes.bool,
    showArrow: PropTypes.bool,
    tags: PropTypes.bool,
    transitionName: PropTypes.string,
    animation: PropTypes.string,
    choiceTransitionName: PropTypes.string,
    onClick: PropTypes.func,
    onChange: PropTypes.func,
    onSelect: PropTypes.func,
    onSearch: PropTypes.func,
    searchPlaceholder: PropTypes.string,
    placeholder: PropTypes.any,
    value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
    defaultValue: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
    label: PropTypes.oneOfType([PropTypes.array, PropTypes.any]),
    defaultLabel: PropTypes.oneOfType([PropTypes.array, PropTypes.any]),
    dropdownStyle: PropTypes.object,
    maxTagTextLength: PropTypes.number,
    treeIcon: PropTypes.bool,
    treeLine: PropTypes.bool,
    treeDefaultExpandAll: PropTypes.bool,
    treeCheckable: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.node,
    ]),
    treeNodeLabelProp: PropTypes.string,
    treeNodeFilterProp: PropTypes.string,
    treeData: PropTypes.array,
    loadData: PropTypes.func,
  },

  getDefaultProps() {
    return {
      prefixCls: 'rc-tree-select',
      filterTreeNode: filterFn,
      showSearch: true,
      allowClear: false,
      placeholder: '',
      searchPlaceholder: '',
      defaultValue: [],
      onClick: noop,
      onChange: noop,
      onSelect: noop,
      onSearch: noop,
      showArrow: true,
      dropdownMatchSelectWidth: true,
      dropdownStyle: {},
      notFoundContent: 'Not Found',
      treeIcon: false,
      treeLine: false,
      treeDefaultExpandAll: false,
      treeCheckable: false,
      treeNodeFilterProp: 'value',
      treeNodeLabelProp: 'title',
    };
  },

  getInitialState() {
    const props = this.props;
    let value = [];
    if ('value' in props) {
      value = toArray(props.value);
    } else {
      value = toArray(props.defaultValue);
    }
    if (this.props.treeCheckable) {
      value = getTreeNodesStates(this.renderTreeData() || this.props.children, value).checkedValues;
    }
    const label = this.getLabelFromProps(props, value, 1);
    let inputValue = '';
    if (props.combobox) {
      inputValue = value[0] || '';
    }
    this.saveInputRef = saveRef.bind(this, 'inputInstance');
    return {value, inputValue, label};
  },

  componentWillReceiveProps(nextProps) {
    if ('value' in nextProps) {
      let value = toArray(nextProps.value);
      if (nextProps.treeCheckable) {
        value = getTreeNodesStates(this.renderTreeData(nextProps) || nextProps.children, value).checkedValues;
      }
      const label = this.getLabelFromProps(nextProps, value);
      this.setState({
        value,
        label,
      });
      if (nextProps.combobox) {
        this.setState({
          inputValue: value[0] || '',
        });
      }
    }
  },

  componentDidUpdate() {
    const state = this.state;
    const props = this.props;
    if (state.open && isMultipleOrTags(props)) {
      const inputNode = this.getInputDOMNode();
      if (inputNode.value) {
        inputNode.style.width = '';
        inputNode.style.width = inputNode.scrollWidth + 'px';
      } else {
        inputNode.style.width = '';
      }
    }
  },

  componentWillUnmount() {
    if (this.dropdownContainer) {
      ReactDOM.unmountComponentAtNode(this.dropdownContainer);
      document.body.removeChild(this.dropdownContainer);
      this.dropdownContainer = null;
    }
  },

  onInputChange(event) {
    const val = event.target.value;
    const props = this.props;
    this.setState({
      inputValue: val,
      open: true,
    });
    if (isCombobox(props)) {
      this.fireChange([val], [val]);
    }
    props.onSearch(val);
  },

  onDropdownVisibleChange(open) {
    this.setOpenState(open);
  },

  // combobox ignore
  onKeyDown(event) {
    const props = this.props;
    if (props.disabled) {
      return;
    }
    const keyCode = event.keyCode;
    if (this.state.open && !this.getInputDOMNode()) {
      this.onInputKeyDown(event);
    } else if (keyCode === KeyCode.ENTER || keyCode === KeyCode.DOWN) {
      this.setOpenState(true);
      event.preventDefault();
    }
  },

  onInputKeyDown(event) {
    const props = this.props;
    const state = this.state;
    const keyCode = event.keyCode;
    if (isMultipleOrTags(props) && !event.target.value && keyCode === KeyCode.BACKSPACE) {
      const value = state.value.concat();
      if (value.length) {
        const label = state.label.concat();
        value.pop();
        label.pop();
        this.fireChange(value, label);
      }
      return;
    }

    if (keyCode === KeyCode.DOWN) {
      if (!state.open) {
        this.openIfHasChildren();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    } else if (keyCode === KeyCode.ESC) {
      if (state.open) {
        this.setOpenState(false);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (state.open) {
      // const menu = this.refs.trigger.getPopupEleRefs();
      // if (menu && menu.onKeyDown(event)) {
      //   event.preventDefault();
      //   event.stopPropagation();
      // }
    }
  },

  onSelect(selectedKeys, info) {
    const checkEvt = info.event === 'check';
    if (info.selected === false) {
      this.onDeselect(info);
      return;
    }
    const item = info.node;
    let value = this.state.value;
    let label = this.state.label;
    const props = this.props;
    const selectedValue = getValuePropValue(item);
    const selectedLabel = this.getLabelFromNode(item);
    props.onSelect(selectedValue, item);
    if (isMultipleOrTags(props)) {
      if (checkEvt) {
        // TODO treeCheckable does not support tags/dynamic
        let {checkedNodes} = info;
        value = checkedNodes.map(n => getValuePropValue(n));
        label = checkedNodes.map(n => this.getLabelFromNode(n));
      } else {
        if (value.indexOf(selectedValue) !== -1) {
          return;
        }
        value = value.concat([selectedValue]);
        label = label.concat([selectedLabel]);
      }
      if (!checkEvt && value.indexOf(selectedValue) !== -1) {
        // 设置 multiple 时会有bug。（isValueChange 已有检查，此处注释掉）
        // return;
      }
    } else {
      if (value[0] === selectedValue) {
        this.setOpenState(false);
        return;
      }
      value = [selectedValue];
      label = [selectedLabel];
      this.setOpenState(false);
    }

    const extraInfo = {
      triggerValue: selectedValue,
      triggerNode: item,
    };
    if (checkEvt) {
      extraInfo.checked = info.checked;
      // extraInfo.allCheckedNodes = info.checkedNodes;
      extraInfo.allCheckedNodes = flatToHierarchy(info.checkedNodesPositions);
    } else {
      extraInfo.selected = info.selected;
    }

    this.fireChange(value, label, extraInfo);
    this.setState({
      inputValue: '',
    });
    if (isCombobox(props)) {
      this.setState({
        inputValue: getPropValue(item, props.treeNodeLabelProp),
      });
    }
  },

  onDeselect(info) {
    this.removeSelected(getValuePropValue(info.node));
    if (!isMultipleOrTags(this.props)) {
      this.setOpenState(false);
    }
    this.setState({
      inputValue: '',
    });
  },

  onPlaceholderClick() {
    this.getInputDOMNode().focus();
  },

  onClearSelection(event) {
    const props = this.props;
    const state = this.state;
    if (props.disabled) {
      return;
    }
    event.stopPropagation();
    if (state.inputValue || state.value.length) {
      this.fireChange([], []);
      this.setOpenState(false);
      this.setState({
        inputValue: '',
      });
    }
  },

  getLabelBySingleValue(children, value) {
    if (value === undefined) {
      return null;
    }
    let label = null;
    const loop = (childs) => {
      React.Children.forEach(childs, (item) => {
        if (item.props.children) {
          loop(item.props.children);
        }
        if (getValuePropValue(item) === value) {
          label = this.getLabelFromNode(item);
        }
      });
    };
    loop(children, 0);
    return label;
  },

  getLabelFromNode(child) {
    return getPropValue(child, this.props.treeNodeLabelProp);
  },

  getLabelFromProps(props, value, init) {
    let label = [];
    if ('label' in props) {
      label = toArray(props.label);
    } else if (init && 'defaultLabel' in props) {
      label = toArray(props.defaultLabel);
    } else {
      label = this.getLabelByValue(this.renderTreeData(props) || props.children, value);
    }
    return label;
  },

  getVLForOnChange(vls) {
    if (vls !== undefined) {
      return isMultipleOrTags(this.props) ? vls : vls[0];
    }
    return vls;
  },

  getLabelByValue(children, values) {
    return values.map((value)=> {
      const label = this.getLabelBySingleValue(children, value);
      if (label === null) {
        return value;
      }
      return label;
    });
  },

  getDropdownContainer() {
    if (!this.dropdownContainer) {
      this.dropdownContainer = document.createElement('div');
      document.body.appendChild(this.dropdownContainer);
    }
    return this.dropdownContainer;
  },

  getSearchPlaceholderElement(hidden) {
    const props = this.props;
    if (props.searchPlaceholder) {
      return (<span
        style={{display: hidden ? 'none' : 'block'}}
        onClick={this.onPlaceholderClick}
        className={props.prefixCls + '-search__field__placeholder'}>{props.searchPlaceholder}</span>);
    }
    return null;
  },

  getInputElement() {
    const props = this.props;
    return (<span className={props.prefixCls + '-search__field__wrap'}>
      <input ref={this.saveInputRef}
             onChange={this.onInputChange}
             onKeyDown={this.onInputKeyDown}
             value={this.state.inputValue}
             disabled={props.disabled}
             className={props.prefixCls + '-search__field'}
             role="textbox"/>
      {isMultipleOrTags(props) ? null : this.getSearchPlaceholderElement(!!this.state.inputValue)}
    </span>);
  },

  getInputDOMNode() {
    return this.inputInstance;
  },

  getPopupDOMNode() {
    return this.refs.trigger.getPopupDOMNode();
  },

  getPopupComponentRefs() {
    return this.refs.trigger.getPopupEleRefs();
  },

  setOpenState(open) {
    const refs = this.refs;
    this.setState({
      open,
    }, ()=> {
      if (open || isMultipleOrTagsOrCombobox(this.props)) {
        if (this.getInputDOMNode()) {
          this.getInputDOMNode().focus();
        }
      } else if (refs.selection) {
        refs.selection.focus();
      }
    });
  },

  removeSelected(selectedValue, e) {
    const props = this.props;
    if (props.disabled) {
      return;
    }
    if (e) {
      e.stopPropagation();
    }
    const label = this.state.label.concat();
    const index = this.state.value.indexOf(selectedValue);
    const value = this.state.value.filter((singleValue) => {
      return (singleValue !== selectedValue);
    });
    if (index !== -1) {
      label.splice(index, 1);
    }
    this.fireChange(value, label, {triggerValue: selectedValue, clear: true});
  },

  openIfHasChildren() {
    const props = this.props;
    if (React.Children.count(props.children) || isSingleMode(props)) {
      this.setOpenState(true);
    }
  },

  isValueChange(value) {
    let sv = this.state.value;
    if (typeof sv === 'string') {
      sv = [sv];
    }
    if (value.length !== sv.length || !value.every((val, index) => sv[index] === val)) {
      return true;
    }
  },

  fireChange(value, label, extraInfo) {
    const props = this.props;
    if (!('value' in props)) {
      this.setState({
        value, label,
      });
    }
    if (this.isValueChange(value)) {
      const ex = {preValue: [...this.state.value]};
      if (extraInfo) {
        assign(ex, extraInfo);
      }
      props.onChange(this.getVLForOnChange(value), this.getVLForOnChange(label), ex);
    }
  },
  renderTopControlNode() {
    const value = this.state.value;
    const label = this.state.label;
    const props = this.props;
    const { choiceTransitionName, prefixCls, maxTagTextLength } = props;
    // single and not combobox, input is inside dropdown
    if (isSingleMode(props)) {
      const placeholder = (<span key="placeholder"
                                 className={prefixCls + '-selection__placeholder'}>
                           {props.placeholder}
      </span>);
      let innerNode = placeholder;
      if (this.state.label[0]) {
        innerNode = <span key="value">{this.state.label[0]}</span>;
      }
      return (<span className={prefixCls + '-selection__rendered'}>
        {innerNode}
      </span>);
    }

    let selectedValueNodes = [];
    if (isMultipleOrTags(props)) {
      selectedValueNodes = value.map((singleValue, index) => {
        let content = label[index];
        const title = content;
        if (maxTagTextLength && typeof content === 'string' && content.length > maxTagTextLength) {
          content = content.slice(0, maxTagTextLength) + '...';
        }
        return (
          <li className={`${prefixCls}-selection__choice`}
              key={singleValue}
              title={title}>
            <span className={prefixCls + '-selection__choice__content'}>{content}</span>
            <span className={prefixCls + '-selection__choice__remove'}
                  onClick={this.removeSelected.bind(this, singleValue)}/>
          </li>
        );
      });
    }
    selectedValueNodes.push(<li className={`${prefixCls}-search ${prefixCls}-search--inline`} key="__input">
      {this.getInputElement()}
    </li>);
    const className = prefixCls + '-selection__rendered';
    if (isMultipleOrTags(props) && choiceTransitionName) {
      return (<Animate className={className}
                       component="ul"
                       transitionName={choiceTransitionName}>
        {selectedValueNodes}
      </Animate>);
    }
    return (<ul className={className}>{selectedValueNodes}</ul>);
  },
  renderTreeData(props) {
    const validProps = props || this.props;
    if (validProps.treeData) {
      return loopTreeData(validProps.treeData);
    }
  },
  render() {
    const props = this.props;
    const multiple = isMultipleOrTags(props);
    const state = this.state;
    const {className, disabled, allowClear, prefixCls} = props;
    const ctrlNode = this.renderTopControlNode();
    let extraSelectionProps = {};
    if (!isCombobox(props)) {
      extraSelectionProps = {
        onKeyDown: this.onKeyDown,
        tabIndex: 0,
      };
    }
    const rootCls = {
      [className]: !!className,
      [prefixCls]: 1,
      [prefixCls + '-open']: state.open,
      [prefixCls + '-combobox']: isCombobox(props),
      [prefixCls + '-disabled']: disabled,
      [prefixCls + '-enabled']: !disabled,
    };

    const clear = (<span key="clear"
                         className={prefixCls + '-selection__clear'}
                         onClick={this.onClearSelection}/>);
    return (
      <SelectTrigger {...props}
        treeNodes={props.children}
        treeData={this.renderTreeData()}
        multiple={multiple}
        disabled={disabled}
        visible={state.open}
        inputValue={state.inputValue}
        inputElement={this.getInputElement()}
        value={state.value}
        onDropdownVisibleChange={this.onDropdownVisibleChange}
        onSelect={this.onSelect}
        ref="trigger">
        <span
          style={props.style}
          onClick={props.onClick}
          className={classnames(rootCls)}>
          <span ref="selection"
                key="selection"
                className={`${prefixCls}-selection ${prefixCls}-selection--${multiple ? 'multiple' : 'single'}`}
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="true"
                aria-expanded={state.open}
            {...extraSelectionProps}>
        {ctrlNode}
            {allowClear && !isMultipleOrTags(props) ? clear : null}
            {multiple || !props.showArrow ? null :
              (<span key="arrow" className={prefixCls + '-arrow'} tabIndex="-1" style={{outline: 'none'}}>
              <b/>
            </span>)}
            {multiple ? this.getSearchPlaceholderElement(!!this.state.inputValue || this.state.value.length) : null}
          </span>
        </span>
      </SelectTrigger>
    );
  },
});

export default Select;
