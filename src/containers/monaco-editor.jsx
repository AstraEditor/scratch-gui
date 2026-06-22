import { connect } from 'react-redux';
import MonacoEditorComponent from '../components/monaco-editor/monaco-editor.jsx';

const mapStateToProps = state => ({
    theme: state.scratchGui.theme.theme,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MonacoEditorComponent);