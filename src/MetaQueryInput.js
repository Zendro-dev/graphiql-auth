import React, {useState, useEffect, useCallback, useRef} from 'react';
import ReactJson from 'react-json-view'
import clsx from 'clsx';
import { makeStyles, ThemeProvider } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Input from '@material-ui/core/Input';
import Box from '@material-ui/core/Box';
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

export const defaultMetaQueryInputHeight = 300;
const minMetaQueryInputHeight = 100;
const maxMetaQueryInputHeight = 500;

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 100,
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    paddingLeft: theme.spacing(2),
  },
  pos: {
    marginBottom: 12,
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
}));

export default function MetaQueryInput(props) {
  const classes = useStyles();
  const {
    handleChangedHeight,
  } = props;
  const [metaQueryInputHeight, setMetaQueryInputHeight] = useState(defaultMetaQueryInputHeight);
  const editorRef = useRef(null);

  const handleMouseDown = e => {
    document.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("mousemove", handleMouseMove, true);

    console.log("@@mouseDown");
  };

  const handleMouseUp = () => {
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousemove", handleMouseMove, true);
    console.log("@@mouseUp");
  };

  const handleMouseMove = useCallback(e => {
    let c = document.getElementById('MetaQueryInput-box-root');

    //console.log("@@mouseMove, clientY: ", e.clientY, "  offsetTop: ", c.offsetTop);
    //console.log("@@ch: ", c.clientHeight);

    const newHeight = c.clientHeight + (c.offsetTop - e.clientY);
    //console.log("@@new-h: ", newHeight);

    if (newHeight > minMetaQueryInputHeight && newHeight < maxMetaQueryInputHeight) {
      setMetaQueryInputHeight(newHeight);
    }
  }, []);

  useEffect(() => {
  }, []);

  useEffect(() => {
    console.log("@@: metaQueryInputHeight: ", metaQueryInputHeight);
    
    //update parent
    handleChangedHeight(metaQueryInputHeight);

    
    if(editorRef.current) {
      //update editor height
      let editor = editorRef.current.getCodeMirror();
      editor.setSize("100%", metaQueryInputHeight);
    }
  }, [metaQueryInputHeight]);

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <div onMouseDown={e => handleMouseDown(e)} className={classes.dragger}>
          <Typography className={classes.title} variant="overline">
            Meta Query
          </Typography>
        </div>
        <Box id='MetaQueryInput-box-root'
          height={metaQueryInputHeight}
          bgcolor="#efefef"
          position="relative"
          bottom={0}
        >
            {/* <CodeMirror
              ref={editorRef}
              className={classes.codeMirror}
              options={{
                mode: {name: 'javascript', json: true},
                lineNumbers: true,
                foldGutter: true,
                gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", 'CodeMirror-lint-markers'],
                extraKeys: {"Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }},
                highlightSelectionMatches: {showToken: true, annotateScrollbar: true},
                lint: true
              }} 
            /> */}
        </Box>
      </Grid>
    </Grid>
  );
}