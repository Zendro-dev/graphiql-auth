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
import IconButton from '@material-ui/core/IconButton';
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
import './ccodemirror.css';
import jsonlint from "jsonlint-mod";
window.jsonlint = jsonlint;

const useStyles = makeStyles(theme => ({
  title: {
    paddingLeft: "14px",
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    //graphiql style:
    color: "#141823",
    fontSize: "18px",
    fontFamily: [
      'system',
      '-apple-system',
      'San Francisco',
      '.SFNSDisplay-Regular',
      'Segoe UI',
      'Segoe',
      'Segoe WP',
      'Helvetica Neue',
      'helvetica',
      'Lucida Grande',
      'arial',
      'sans-serif'
    ].join(','),
  },
  em: {
    //graphiql style:
    fontSize: "19px",
    fontFamily: "georgia",
  },
  executeButton: {
    //graphiql style:
    background: "linear-gradient(#fdfdfd, #d2d3d6)",
    borderRadius: "17px",
    border: "1px solid rgba(0,0,0,0.25)",
    boxShadow: "0 1px 0 #fff",
    cursor: "pointer",
    fill: "#444",
    height: "34px",
    margin: 0,
    padding: 0,
    width: "34px",
  },
  executeButtonWrap: {
    //graphiql style:
    margin: "0 0px 0 20px",
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
    //graphiql style:
    background: "linear-gradient(#f7f7f7, #e2e2e2)",
    borderBottom: '1px solid #d0d0d0',
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
  const minMetaQueryInputWidth = useRef(163);
  const minMetaQueryOutputWidth = useRef(1);
  //element refs
  const codemirrorInputRef = useRef(null);
  const codemirrorOutputRef = useRef(null);

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

  const handleMouseMoveB = useCallback(e => {
    //check: no left-button down
    if(!e.buttons) {
      document.removeEventListener("mousemove", handleMouseMoveB, true);
      return;    
    }
    //set new height
    let c = document.getElementById('MetaQueryInput-box-root');
    let vd = document.getElementById('vDragger-div');
    const newHeight = c.clientHeight + (c.offsetTop - vd.clientY);
    if (newHeight > minMetaQueryInputHeight.current && newHeight < maxMetaQueryInputHeight.current) {
      setMetaQueryInputHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mousemove", handleMouseMoveB, true);
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
      document.removeEventListener("mousemove", handleMouseMoveB, true);
    }
  }, [handleMouseUp, handleMouseMove]);

  useEffect(() => {
    if(filterValue && codemirrorInputRef.current && codemirrorOutputRef.current) {
      //init: input editor
      let ieditor = codemirrorInputRef.current.getCodeMirror();
      let currentValue = ieditor.getValue();
      if(!currentValue || currentValue === "") {
        ieditor.setValue(""); //this is delayed

        setTimeout (() => {
          ieditor.focus();
          ieditor.setCursor({line: 0, ch: 0});
        }, 200);
      }

      //init: output editor
      let oeditor = codemirrorOutputRef.current.getCodeMirror();
      oeditor.on("gutterClick", function(line, gutter, clickEvent){
        console.log("onGutterClick");
      });
      oeditor.on("blur", function(){
        console.log("onBlur");
      });
      oeditor.on("mousedown", function(e){
        console.log("onMousedown: ", e.target);
      });
    }
  }, [filterValue]);

  useEffect(() => {
    if(selectedFilter) setFilterValue(selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    //notify parent
    if(handleResize) handleResize();
    
    //update input-editor height
    if(codemirrorInputRef.current) {
      let oeditor = codemirrorInputRef.current.getCodeMirror();
      oeditor.setSize("100%", metaQueryInputHeight);
    }
    //update output-editor height
    if(codemirrorOutputRef.current) {
      let ieditor = codemirrorOutputRef.current.getCodeMirror();
      ieditor.setSize("100%", metaQueryInputHeight);
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

  const handleCodeMirrorOutputGutterMouseDown = e => {
    if (typeof e === 'object') {
      //update height's
      minMetaQueryInputHeight.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10); //10vh;
      maxMetaQueryInputHeight.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60); //60vh;

      switch (e.button) {
        case 0: //left button
          e.preventDefault();
          document.addEventListener("mousemove", handleMouseMoveB, true);
          break;
        default:
          document.removeEventListener("mousemove", handleMouseMoveB, true);
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

  const handleClickOnRun = async () => {
    if(handleRunMetaQuery && codemirrorInputRef.current && codemirrorOutputRef.current) {
      let result = await handleRunMetaQuery(codemirrorInputRef.current.getCodeMirror().getValue());
      let out = result ? JSON.stringify(result, null, 2) : "";
      codemirrorOutputRef.current.getCodeMirror().setValue(out);
    }
  }

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <div id='vDragger-div' className={classes.dragger} onMouseDown={e => handleMouseDown(e)} >
          <Grid container spacing={4} alignItems="center" >
            <Grid item>
              <span className={classes.title} >
                QF
                <em className={classes.em}>i</em>
                lter
              </span>
            </Grid>
            <Grid item>
              <div className={classes.executeButtonWrap}>
                <IconButton size="small" className={classes.executeButton} onClick={handleClickOnRun}>
                  <PlayArrowIcon style={{ fontSize: 26, color: "#141823" }}/>
                </IconButton>
              </div>
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
        <div>
          <Grid container>
            <Grid item xs={6}>
              <Box id='MetaQueryInput-box-root'
                height={metaQueryInputHeight}
                bgcolor="#efefef"
                position="relative"
                bottom={0}
              >
                  <CodeMirror
                    ref={codemirrorInputRef}
                    options={{
                      mode: {name: 'javascript', json: true},
                      value: "",
                      tabSize: 2,
                      lineNumbers: true,
                      foldGutter: true,
                      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], //add: 'CodeMirror-lint-markers' gutter for lint markers.
                      extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
                      highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
                      lint: false
                    }} 
                  />
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box id='MetaQueryOutput-box-root'
                height={metaQueryInputHeight}
                bgcolor="#fff"
                position="relative"
                bottom={0}
              >
                  <CodeMirror
                    ref={codemirrorOutputRef}
                    options={{
                      mode: {name: 'javascript', json: true},
                      value: "",
                      tabSize: 2,
                      lineNumbers: false,
                      foldGutter: true,
                      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], //add: 'CodeMirror-lint-markers' gutter for lint markers.
                      extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
                      highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
                      lint: false
                    }} 
                  />
              </Box>
            </Grid>
          </Grid>
      </div>
      </Grid>
    </Grid>
  );
}