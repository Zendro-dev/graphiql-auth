import React, {useState, useRef, useEffect} from 'react';
import GraphiQL from 'graphiql';
import fetch from 'isomorphic-fetch';
import MetaQueryInput from './MetaQueryInput'
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';

import './graphiql.css';
import './cgraphiql.css'

const useStyles = makeStyles(theme => ({
  root: {
    width: "100%",
    height: "100%"
  },
  graphiqlBoxIn: {
    // transition: theme.transitions.create(['height'], {
    //   easing: theme.transitions.easing.easeIn,
    //   duration: theme.transitions.duration.enteringScreen,
    // }),
    overflow: 'hidden',
  },
  graphiqlBoxOut: {
    // transition: theme.transitions.create(['height'], {
    //   easing: theme.transitions.easing.easeOut,
    //   duration: theme.transitions.duration.leavingScreen,
    // }),
    overflow: 'hidden',
  }
}));

const server_url = process.env.REACT_APP_SERVER_URL || 'http://localhost:3000/graphql';
const metaquery_url = process.env.REACT_APP_SERVER_METAQUERY_URL || 'http://localhost:3000/meta_query';

export default function MyGraphiQL(props){
  const classes = useStyles();
  const [editorContainerHeight, setEditorContainerHeight] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [hasFilter, setHasFilter] = useState(false);
  const graphiQL = useRef(null);
  const editorContaierRef = useRef(null);

  const checkLoggin = () =>{
    let expires = new Date(localStorage.getItem('expirationDate')) < new Date();
    return (!!localStorage.getItem('token') &&  !expires);
  }

  const graphQLFetcher = (graphQLParams)=> {
    let headers = { 'Content-Type': 'application/json' };

    if(checkLoggin()){
      headers['Authorization'] = 'Bearer '+ localStorage.getItem('token');
    }else{
      props.loginHandler(false);
      return;
    }

    return fetch(server_url, {
      method: 'post',
      headers: headers,
      body: JSON.stringify(graphQLParams),
    }).then(response => response.json(), error => {
      console.log("ERROR:", error);
    });
  }

  const handlePrettifyQuery = () => {
    if (graphiQL.current) {
      graphiQL.current.handlePrettifyQuery();
    }
  };

  const handleMergeQuery = () => {
    if (graphiQL.current) {
      graphiQL.current.handleMergeQuery();
    }
  };

  const handleCopyQuery = () => {
    if (graphiQL.current) {
      graphiQL.current.handleCopyQuery();
    }
  };

  const handleToggleHistory = () => {
    if (graphiQL.current) {
      graphiQL.current.handleToggleHistory();
    }
  };

  const handleFilterSelected = (value) => {
    setSelectedFilter(value);
    setHasFilter(Boolean(value));
    console.log("@selectedFilter: ", value);
  }

  const handleEditorEnter = () => {

    console.log("editorRef: ", editorContaierRef.current);

    if(editorContaierRef.current) {
      setEditorContainerHeight(editorContaierRef.current.clientHeight);
    }
  }

  const handleEditorExited = () => {
    setEditorContainerHeight(0);
  }

  const handleChangedHeight = (newHeight) => {
    if(editorContaierRef.current) {
      console.log("@--- newHeight: ", newHeight, "  -- realHeight: ", editorContaierRef.current.clientHeight);

      //update height
      setEditorContainerHeight(editorContaierRef.current.clientHeight);
    }

  }

  useEffect(() => {
    console.log("@@: editorContainerHeight: ", editorContainerHeight);
  }, [editorContainerHeight]);
   
  return (
    <div>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <Box
            className={classes.graphiqlBox}
            className={clsx(classes.graphiqlBoxIn, {
              [classes.graphiqlBoxOut]: !hasFilter,
            })}
            height={`calc(100vh - 34px - ${editorContainerHeight}px)`}
            bgcolor="background.paper"
          >
            <GraphiQL
              ref={graphiQL}
              fetcher={graphQLFetcher}
            >

              <GraphiQL.Toolbar>
                <GraphiQL.Button
                  onClick={handlePrettifyQuery}
                  label="Prettify"
                  title="Prettify Query (Shift-Ctrl-P)"
                />

                <GraphiQL.Button
                  onClick={handleMergeQuery}
                  label="Merge"
                  title="Merge Query (Shift-Ctrl-M)"
                />

                <GraphiQL.Button
                  onClick={handleCopyQuery}
                  label="Copy"
                  title="Copy Query (Shift-Ctrl-C)"
                />

                <GraphiQL.Button
                  onClick={handleToggleHistory}
                  title="Show History"
                  label="History"
                />

                <GraphiQL.Menu label="Filters" title="Filters">
                  <GraphiQL.MenuItem label="Jq" title="Jq Filter" onSelect={() => handleFilterSelected('jq')} />
                  <GraphiQL.MenuItem label="JsonPath" title="JsonPath Filter" onSelect={() => handleFilterSelected('jsonPath')} />
                  <GraphiQL.MenuItem label="None" title="No filter" onSelect={() => handleFilterSelected('')} />
                </GraphiQL.Menu>
              </GraphiQL.Toolbar>
            </GraphiQL>
          </Box>
        </Grid>
        <Grid item xs={12}>
          <div ref={editorContaierRef}>
            <Slide direction="up" in={hasFilter} 
              mountOnEnter unmountOnExit
              onEnter={handleEditorEnter}
              onExited={handleEditorExited}
            >
              <div>
                <MetaQueryInput handleChangedHeight={handleChangedHeight}/>
              </div>
            </Slide>
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

