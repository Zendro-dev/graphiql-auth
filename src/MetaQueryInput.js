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
  },
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
  //height's & width's
  const [metaQueryInputHeight, setMetaQueryInputHeight] = useState(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.30)); //30vh
  const [metaQueryInputWidth, setMetaQueryInputWidth] = useState(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(2.79208/3.79208));
  const [metaQueryInputFlexGrow, setMetaQueryInputFlexGrow] = useState(2.79208);
  const [metaQueryOutputWidth, setMetaQueryOutputWidth] = useState(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(1/3.79208));

  const metaQueryInputHeightRef = useRef(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.30)); //30vh
  const metaQueryInputWidthRef = useRef(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(2.79208/3.79208));
  const metaQueryInputFlexGrowRef = useRef(2.79208);
  const metaQueryOutputWidthRef = useRef(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(1/3.79208));
  
  const minMetaQueryInputHeightRef = useRef(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10)); //10vh;
  const maxMetaQueryInputHeightRef = useRef(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60)); //60vh;
  const minMetaQueryInputWidthRef = useRef(108.1);
  const inputWidthRatioRef = useRef(2.79208/3.79208);
  const outputWidthRatioRef = useRef(1/3.79208);
  const updateValuesLockRef = useRef(false);
  const updateValuesLockBRef = useRef(false);
  
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
    let newHeight = c.clientHeight + (c.offsetTop - e.clientY);
    if (newHeight > minMetaQueryInputHeightRef.current && newHeight < maxMetaQueryInputHeightRef.current) {
      metaQueryInputHeightRef.current = newHeight;
      setMetaQueryInputHeight(newHeight);
    }
  }, []);

  const handleMouseMoveB = useCallback(async (e) => {
    //check: no left-button down
    if(!e.buttons) {
      document.removeEventListener("mousemove", handleMouseMoveB, true);
      return;    
    }

    //set max width to current viewport width.
    let maxWidth = (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0));
    
    //new values
    let newWidth = e.clientX; 
    let newOutputWidth = maxWidth - newWidth;
    let newFlexGrow = newWidth / newOutputWidth;

    if(newWidth > minMetaQueryInputWidthRef.current && newWidth < (maxWidth-10)) {
      //update flex-grow
      metaQueryInputFlexGrowRef.current = newFlexGrow;
      //update width's
      metaQueryInputWidthRef.current = newWidth;
      metaQueryOutputWidthRef.current = newOutputWidth;
      //update width's ratios
      inputWidthRatioRef.current = newFlexGrow/(1+newFlexGrow);
      outputWidthRatioRef.current = 1/(1+newFlexGrow);
      //delayed state update
      if(updateValuesLockRef.current === false) {
        updateValuesLockRef.current = true;
        delayedUpdateValues(100);
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mousemove", handleMouseMoveB, true);
  }, [handleMouseMove, handleMouseMoveB]);

  const handleMouseDownOnHorizontalDragger = useCallback((e) => {
    if (typeof e === 'object') {
      //update height's
      minMetaQueryInputHeightRef.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10); //10vh;
      maxMetaQueryInputHeightRef.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60); //60vh;

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
  }, [handleMouseMove]);

  const handleMouseDownOnOutputCodeMirrorGutter = useCallback((e) => {
    if (e && typeof e === 'object') {
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
  }, [handleMouseMoveB]);

  const handleWindowsResize = () => {
    /**
     * Update width's
     */
    //set max width to current viewport width.
    let maxWidth = (Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0));
    //new widths
    let newWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(inputWidthRatioRef.current);
    let newOutputWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)*(outputWidthRatioRef.current);
    if(newWidth > minMetaQueryInputWidthRef.current && newWidth < (maxWidth-10)) {
      metaQueryInputWidthRef.current = newWidth;
      metaQueryOutputWidthRef.current = newOutputWidth;
      //delayed state update
      if(updateValuesLockBRef.current === false) {
        updateValuesLockBRef.current = true;
        delayedUpdateValuesB(100);
      }
    }
    /**
     * Update height's
     */
    minMetaQueryInputHeightRef.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.10); //10vh;
    maxMetaQueryInputHeightRef.current = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)*(.60); //60vh;
    //set new height
    if (metaQueryInputHeightRef.current > (maxMetaQueryInputHeightRef.current - 70)) {
      metaQueryInputHeightRef.current = maxMetaQueryInputHeightRef.current - 70;
      setMetaQueryInputHeight(maxMetaQueryInputHeightRef.current - 70);
    } else if(metaQueryInputHeightRef.current < (minMetaQueryInputHeightRef.current)) {
      metaQueryInputHeightRef.current = minMetaQueryInputHeightRef.current;
      setMetaQueryInputHeight(minMetaQueryInputHeightRef.current);
    }
  };

  /**
   * Effects
   */
  useEffect(() => {
    //add event listeners
    window.addEventListener("resize", handleWindowsResize);

    //cleanup
    return () => {
      //remove event listeners
      window.addEventListener("resize", handleWindowsResize);
    }
  }, []);

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
  }, [handleMouseUp, handleMouseMove, handleMouseMoveB]);

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
      oeditor.on("mousedown", function(cm, e){
        if(e&&e.target&&e.target.className&&e.target.className.indexOf('CodeMirror-gutter') === 0) {
          handleMouseDownOnOutputCodeMirrorGutter(e);
        }
      });
    }
  }, [filterValue, handleMouseDownOnOutputCodeMirrorGutter]);

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

  /**
   * Utils
   */
  const delayedUpdateValues = async (ms) => {
    await new Promise(resolve => {
      //set timeout
      window.setTimeout(function() {
        updateValuesLockRef.current = false;
        setMetaQueryInputFlexGrow(metaQueryInputFlexGrowRef.current);
        setMetaQueryInputWidth(metaQueryInputWidthRef.current);
        setMetaQueryOutputWidth(metaQueryOutputWidthRef.current);
        resolve("ok");
      }, ms);
    });
  };

  const delayedUpdateValuesB = async (ms) => {
    await new Promise(resolve => {
      //set timeout
      window.setTimeout(function() {
        updateValuesLockBRef.current = false;
        setMetaQueryInputWidth(metaQueryInputWidthRef.current);
        setMetaQueryOutputWidth(metaQueryOutputWidthRef.current);
        resolve("ok");
      }, ms);
    });
  };

  return (
    <Grid container wrap='nowrap' spacing={0}>
      <Grid item xs={12}>
        <div id='hDragger-div' className={classes.dragger} onMouseDown={e => handleMouseDownOnHorizontalDragger(e)} >
          <Grid container wrap='nowrap' spacing={4} alignItems="center" >
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
          <Grid container wrap='nowrap'>
            
              <Box id='MetaQueryInput-box-root'
                height={metaQueryInputHeight}
                width={metaQueryInputWidth}
                flexGrow={metaQueryInputFlexGrow}
                flexShrink={1}
                flexBasis="0%"
                bgcolor="#efefef"
                position="relative"
                bottom={0}
              >
                {/**
                 * Input editor  
                 */}
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
            
            
              <Box id='MetaQueryOutput-box-root'
                height={metaQueryInputHeight}
                width={metaQueryOutputWidth}
                flex={"1 1"}
                bgcolor="#fff"
                position="relative"
                bottom={0}
              >
                {/**
                 * Output editor  
                 */}
                <CodeMirror
                  ref={codemirrorOutputRef}
                  options={{
                    mode: {name: 'javascript', json: true},
                    readOnly: true,
                    value: "",
                    tabSize: 2,
                    lineNumbers: false,
                    lineWrapping: true,
                    foldGutter: true,
                    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"], //add: 'CodeMirror-lint-markers' gutter for lint markers.
                    extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
                    highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
                    lint: false
                  }} 
                />
              </Box>
            
          </Grid>
      </div>
      </Grid>
    </Grid>
  );
}