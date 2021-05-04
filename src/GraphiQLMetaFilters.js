import React, {useState, useEffect, useCallback, useRef} from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import { Close as CloseIcon, InfoOutlined as InfoIcon} from '@material-ui/icons';
import CodeMirror from 'codemirror';
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
    margin: "0 0px 0 0px",
    paddingLeft: "52px",
    paddingRight: "28px",
  },
  dragger: {
    height: "34px",
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
  formControl: {
    width: 155,
    display: 'block',
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
  },
  barItem: {
    margin: 0,
    padding: 0,
  }
}));

export default function GraphiQLMetaFilters(props) {
  const classes = useStyles();
  const {
    selectedFilter,
    filterHeight,
    onInitVerticalResize,
    onNewResult,
    handleFilterSelected,
    handleRunMetaQuery,
    handleCloseFilter,
  } = props;
  const [filterValue, setFilterValue] = React.useState(selectedFilter);
  const [metaQueryInputFlexGrow, setMetaQueryInputFlexGrow] = useState(2.79208);

  const metaQueryInputFlexGrowRef = useRef(2.79208);  
  const minMetaQueryInputWidthRef = useRef(108.1);
  const updateFlexLockRef = useRef(false);
  
  //codemirror
  const codemirrorInputRef = useRef(null);
  const codemirrorOutputRef = useRef(null);
  const codemirrorOutputDivRef = useRef(null);
  const codemirrorInputDivRef = useRef(null);

  /**
   * Callbacks
   *  initHorizontalResize
   *  onRun
   */
  const initHorizontalResize = useCallback((mouseDownEvent) => {
    //check
    if(!mouseDownEvent || typeof mouseDownEvent !== 'object') return;   

    let offsetX = mouseDownEvent.offsetX;
    //event handler
    let handleMouseMove = function(mouseMoveEvent) {
      //check: no left-button down
      if(!mouseMoveEvent.buttons) {
        document.removeEventListener("mousemove", handleMouseMove, true);
        return;    
      }
      //set max width to current viewport width.
      let maxWidth = (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0));
      //new values
      let newWidth = mouseMoveEvent.clientX - offsetX; 
      let newOutputWidth = maxWidth - newWidth;
      let newFlexGrow = newWidth / newOutputWidth;

      //check limits
      if(newWidth > minMetaQueryInputWidthRef.current && newWidth < (maxWidth-15)) {
        //update flex-grow
        metaQueryInputFlexGrowRef.current = newFlexGrow;
        //delayed state update (debounce)
        if(updateFlexLockRef.current === false) {
          updateFlexLockRef.current = true;
          delayedUpdateFlex(70);
        }
      }
    }
    //event handler
    let handleMouseUp = function () {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    if(mouseDownEvent.button === 0) { //left button
      mouseDownEvent.preventDefault();
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  /**
   * onRun   Executes meta query.
   * 
   */
  const onRun = useCallback(async () => {
    //check
    if(!handleRunMetaQuery) return;
    if(!codemirrorInputRef || !codemirrorInputRef.current) return;
    if(!codemirrorOutputRef || !codemirrorOutputRef.current) return;

    let result = await handleRunMetaQuery(codemirrorInputRef.current.getValue().trim());
    let newValue = result ? JSON.stringify(result, null, 2) : "";

    //event handler
    let onChange = function(){ 
      onNewResult();
      codemirrorOutputRef.current.off("change", onChange)
    }
    //add event listener
    codemirrorOutputRef.current.on("change", onChange)
    //set new value
    codemirrorOutputRef.current.setValue(newValue);
  }, [handleRunMetaQuery, onNewResult]);

  /**
   * Effects
   */
  useEffect(() => {
    //check
    if(!codemirrorInputDivRef || !codemirrorInputDivRef.current) return;
    if(!codemirrorOutputDivRef || !codemirrorOutputDivRef.current) return;

    //initialize codeMirror (input editor)
    codemirrorInputRef.current = CodeMirror(codemirrorInputDivRef.current, {
      mode: {name: 'javascript', json: true},
      value: "",
      tabSize: 2,
      lineNumbers: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], //add: 'CodeMirror-lint-markers' gutter for lint markers.
      highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
      lint: false,
    });
    codemirrorInputRef.current.setSize("100%", "100%");

    //initialize codeMirror (output editor)
    codemirrorOutputRef.current = CodeMirror(codemirrorOutputDivRef.current, {
      mode: {name: 'javascript', json: true},
      readOnly: true,
      value: "",
      tabSize: 2,
      lineNumbers: false,
      lineWrapping: true,
      foldGutter: true,
      gutters: ["CodeMirror-foldgutter"], //add: 'CodeMirror-lint-markers' gutter for lint markers.
      extraKeys: {
        "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); },
      },
      highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
      lint: false,
    });
    codemirrorOutputRef.current.setSize("100%", "100%");
  }, []);

  useEffect(() => {
    //check
    if(!codemirrorInputRef || !codemirrorInputRef.current) return;
    if(!codemirrorOutputRef || !codemirrorOutputRef.current) return;

    if(filterValue) {
      //init: input editor
      let ieditor = codemirrorInputRef.current;
      let currentValue = ieditor.getValue();
      if(!currentValue || currentValue === "") {
        ieditor.setValue(""); //this is delayed

        setTimeout (() => {
          ieditor.focus();
          ieditor.setCursor({line: 0, ch: 0});
        }, 200);
      }
      ieditor.setOption("extraKeys", {
        "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); },
        "Ctrl-Enter": function(cm){onRun()},
      });

      //init: output editor
      let oeditor = codemirrorOutputRef.current;
      oeditor.on("mousedown", function(cm, e){
        if(e&&e.target&&e.target.className&&e.target.className.indexOf('CodeMirror-gutter') === 0) {
          initHorizontalResize(e);
        }
      });
    }
  }, [filterValue, initHorizontalResize, onRun]);

  useEffect(() => {
    if(selectedFilter) setFilterValue(selectedFilter);
  }, [selectedFilter]);

  /**
   * Handlers
   */
  const handleChangeFilter = (event) => {
    if(handleFilterSelected) handleFilterSelected(event.target.value);
  };

  const handleClickOnCloseFilter = () => {
    if(handleCloseFilter) handleCloseFilter();
  }

  /**
   * Utils
   */
  const delayedUpdateFlex = async (ms) => {
    await new Promise(resolve => {
      //set timeout
      window.setTimeout(function() {
        updateFlexLockRef.current = false;
        setMetaQueryInputFlexGrow(metaQueryInputFlexGrowRef.current);
        resolve("ok");
      }, ms);
    });
  };

  return (
    <Grid container wrap='nowrap' spacing={0}>
      <Grid item xs={12}>
        <div id='hDragger-div' className={classes.dragger} onMouseDown={onInitVerticalResize} >
          <Grid container style={{padding: 0, margin: 0}} wrap='nowrap' spacing={4} >
            <Grid item style={{padding: 0, margin: 0}}>
              <span className={classes.title} >
                QF
                <em className={classes.em}>i</em>
                lter
              </span>
            </Grid>
            <Grid item style={{padding: 0, margin: 0}}>
              <div className={classes.executeButtonWrap}>
                <IconButton size="small" className={classes.executeButton} onClick={onRun}>
                  <PlayArrowIcon style={{ fontSize: 26, color: "#141823" }}/>
                </IconButton>
              </div>
            </Grid>
            <Grid item style={{padding: 0, margin: 0}}>
              <FormControl className={classes.formControl} component="fieldset">
                <RadioGroup row value={filterValue} onChange={handleChangeFilter}>
                  <FormControlLabel
                    classes={{label:classes.labelFontSize}} 
                    value="jq" 
                    control={<Radio classes={{root: classes.radio, checked: classes.checked}}/>} 
                    label="jq" />
                  <FormControlLabel 
                    classes={{label:classes.labelFontSize}}
                    value="JsonPath" 
                    control={<Radio classes={{root: classes.radio, checked: classes.checked}}/>} 
                    label="JsonPath" />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item style={{padding: 0, margin: 0}}>
              <Button
                variant="outlined"
                color="default"
                startIcon={<CloseIcon />}
                onClick={handleClickOnCloseFilter}
              >
                Close
              </Button>
            </Grid>
            <Grid item style={{padding: 0, marginTop: 8, marginLeft: 10}}>
              <InfoIcon color='primary'/>
            </Grid>
            <Grid item style={{padding: 0, marginTop: 6, marginLeft: 3, whiteSpace:'nowrap'}} >
              Filters the contents of "data".
            </Grid>
          </Grid>
        </div>
        <div>
          <Grid container wrap='nowrap'>
            {/**
               * Input editor  
               */}
            <div id='MetaQueryInput-box-root'
              ref={codemirrorInputDivRef}
              style={{
                height: filterHeight - 34,
                minWidth: 108.1,
                flex: metaQueryInputFlexGrow,
                WebkitFlex: metaQueryInputFlexGrow,
                bgcolor: "#efefef",
                position: "relative",
                bottom: 0,
                transition: "flex .01s",
                WebkitTransition: "flex .01s",
                MozTransition: "flex .01s",
                OTransition: "flex .01s",
              }}
            />
            
              {/**
                * Output editor  
                */}
              <div id='MetaQueryOutput-box-root'
                ref={codemirrorOutputDivRef}
                style={{
                  height: filterHeight - 34,
                  minWidth: 1,
                  flex: "1 1",
                  WebkitFlex: "1 1",
                  bgcolor: "#efefef",
                  position: "relative",
                  bottom: 0,
                  transition: "flex .01s",
                  WebkitTransition: "flex .01s",
                  MozTransition: "flex .01s",
                  OTransition: "flex .01s",
                }}
              />
          </Grid>
      </div>
      </Grid>
    </Grid>
  );
}