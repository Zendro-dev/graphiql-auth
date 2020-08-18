import React, {useState, useEffect, useCallback, useRef} from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import Fab from '@material-ui/core/Fab';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import CloseIcon from '@material-ui/icons/Close';
import CodeMirror from 'react-codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/sql-hint';
import 'codemirror/addon/hint/show-hint.css'; // without this css hints won't show
import 'codemirror/addon/search/match-highlighter';
import 'codemirror/addon/search/matchesonscrollbar';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/xml-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/markdown-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/addon/lint/lint.css';
import jsonlint from "jsonlint-mod";
window.jsonlint = jsonlint;

const useStyles = makeStyles(theme => ({
  title: {
    paddingLeft: theme.spacing(2),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  dragger: {
    height: "auto",
    cursor: "ns-resize",
    position: "relative",
    right: 0,
    left: 0,
    top: 0,
    bottom:0,
    zIndex: 100,
    backgroundColor: "#eeeeee",
    borderBottom: '1px solid #d6d6d6',
    borderTop: '1px solid #e0e0e0',
  },
  formControlLabel: {
    marginBottom: 0,
  },
  labelFontSize: {
    fontSize: "14px",
  },
  radio: {
    '&$checked': {
      color: '#E10098'
    }
  },
  checked: {},
  closeButton: {
    border: "1px",
  }
}));

export default function MetaQueryInput(props) {
  const classes = useStyles();
  const {
    selectedFilter,
    handleResize,
    handleFilterSelected,
    handleRunMetaQuery,
    handleCloseFilter,
  } = props;
  const [filterValue, setFilterValue] = React.useState(selectedFilter);
  //height's
  const [metaQueryInputHeight, setMetaQueryInputHeight] = useState(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.30)); //30vh
  const minMetaQueryInputHeight = useRef(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10)); //10vh;
  const maxMetaQueryInputHeight = useRef(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60)); //60vh;
  //element refs
  const editorRef = useRef(null);

  /**
   * Callbacks
   */
  const handleMouseMove = useCallback(e => {
    //check: no left-button down
    if(!e.buttons) {
      document.removeEventListener("mousemove", handleMouseMove, true);
      return;    
    }
    //set new height
    let c = document.getElementById('MetaQueryInput-box-root');
    const newHeight = c.clientHeight + (c.offsetTop - e.clientY);
    if (newHeight > minMetaQueryInputHeight.current && newHeight < maxMetaQueryInputHeight.current) {
      setMetaQueryInputHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove, true);
  }, [handleMouseMove]);

  /**
   * Effects
   */
  useEffect(() => {
    //add event listeners
    document.addEventListener("mouseup", handleMouseUp, true);

    //cleanup
    return () => {
      //remove event listeners
      document.removeEventListener("mouseup", handleMouseUp, true);
      document.removeEventListener("mousemove", handleMouseMove, true);
    }
  }, [handleMouseUp, handleMouseMove]);

  useEffect(() => {
    if(filterValue && editorRef.current) {
      let editor = editorRef.current.getCodeMirror();
      let currentValue = editor.getValue();
      if(!currentValue || currentValue === "{\n  \n}") {
        editor.setValue("{\n  \n}"); //this is delayed

        setTimeout (() => {
          editor.focus();
          editor.setCursor({line: 1, ch: 2});
        }, 200);
      }
    }
  }, [filterValue]);

  useEffect(() => {
    if(selectedFilter) setFilterValue(selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    //notify parent
    if(handleResize) handleResize();
    
    if(editorRef.current) {
      //update editor height
      let editor = editorRef.current.getCodeMirror();
      editor.setSize("100%", metaQueryInputHeight);
    }
  }, [metaQueryInputHeight, handleResize]);

  /**
   * Handlers
   */
  const handleMouseDown = e => {
    if (typeof e === 'object') {
      //update height's
      minMetaQueryInputHeight.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10); //10vh;
      maxMetaQueryInputHeight.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60); //60vh;

      switch (e.button) {
        case 0: //left button
          e.preventDefault();
          document.addEventListener("mousemove", handleMouseMove, true);
          break;
        default:
          document.removeEventListener("mousemove", handleMouseMove, true);
          break;
      }
    }
  };

  const handleChangeFilter = (event) => {
    if(handleFilterSelected) handleFilterSelected(event.target.value);
  };

  const handleClickOnCloseFilter = () => {
    if(handleCloseFilter) handleCloseFilter();
  }

  const handleClickOnRun = () => {
    if(handleRunMetaQuery && editorRef.current) handleRunMetaQuery(editorRef.current.getCodeMirror().getValue());
  }

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <div className={classes.dragger} onMouseDown={e => handleMouseDown(e)} >
          <Grid container spacing={4} alignItems="center" >
            <Grid item>
              <Typography className={classes.title} variant="h4" >
                Filters
              </Typography>
            </Grid>
            <Grid item>
              <Fab size="small" onClick={handleClickOnRun}>
                <PlayArrowIcon style={{ fontSize: 26 }}/>
              </Fab>
            </Grid>
            <Grid item>
              <FormControl className={classes.formControl} component="fieldset">
                <RadioGroup row value={filterValue} onChange={handleChangeFilter}>
                  <FormControlLabel 
                    className={classes.formControlLabel}
                    classes={{label:classes.labelFontSize}} 
                    value="jq" 
                    control={<Radio classes={{root: classes.radio, checked: classes.checked}}/>} 
                    label="jq" />
                  <FormControlLabel 
                    className={classes.formControlLabel}
                    classes={{label:classes.labelFontSize}}
                    value="JsonPath" 
                    control={<Radio classes={{root: classes.radio, checked: classes.checked}}/>} 
                    label="JsonPath" />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                color="default"
                startIcon={<CloseIcon />}
                onClick={handleClickOnCloseFilter}
              >
                Close
              </Button>
            </Grid>
          </Grid>
        </div>
        <Box id='MetaQueryInput-box-root'
          height={metaQueryInputHeight}
          bgcolor="#efefef"
          position="relative"
          bottom={0}
        >
            <CodeMirror
              ref={editorRef}
              className={classes.codeMirror}
              options={{
                mode: {name: 'javascript', json: true},
                value: "{\n  \n}",
                tabSize: 2,
                lineNumbers: true,
                foldGutter: true,
                gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", 'CodeMirror-lint-markers'],
                extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
                highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
                lint: true
              }} 
            />
        </Box>
      </Grid>
    </Grid>
  );
}