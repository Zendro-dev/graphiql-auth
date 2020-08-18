import React, {useState, useRef} from 'react';
import GraphiQL from 'graphiql';
import fetch from 'isomorphic-fetch';
import MetaQueryInput from './MetaQueryInput'
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Slide from '@material-ui/core/Slide';
import Fade from '@material-ui/core/Fade';
import './graphiql.css';
import './cgraphiql.css'

const useStyles = makeStyles(theme => ({
  gridContainer: {
    width: "100%",
    height: `calc(100vh - 34px)`,
  },
  gridItemGraphiql: {
    width: "100%",
    flex: "1",
  },
  gridItemMetafilter: {
    width: "100%",
    flex: "0",
  },
}));

const server_url = process.env.REACT_APP_SERVER_URL || 'http://localhost:3000/graphql';
const metaquery_url = process.env.REACT_APP_SERVER_METAQUERY_URL || 'http://localhost:3000/meta_query';

export default function MyGraphiQL(props){
  const classes = useStyles();
  const [gridItemMetafilterHeight, setGridItemMetafilterHeight] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [hasFilter, setHasFilter] = useState(false);
  const selectedFilterRef = useRef("");
  const runMetaQueryRef = useRef(false);
  const metaQueryValueRef = useRef("");
  const graphiQL = useRef(null);
  const gridItemMetafilterRef = useRef(null);
  const gridItemGraphiqlRef = useRef(null);

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

    /**
     * Case: standard query
     */
    if(!runMetaQueryRef.current) {
      return fetch(server_url, {
        method: 'post',
        headers: headers,
        body: JSON.stringify(graphQLParams),
      }).then(response => response.json(), error => {
        console.log("ERROR:", error);
      });
    } else {
      /**
       * Case: meta-query
       */
      //reset flag
      runMetaQueryRef.current = false;

      //set metaQuery parameters
      let metaQueryParams = {
        queries:   graphQLParams,
        jq:        selectedFilterRef.current==='jq' ? metaQueryValueRef.current: null,
        jsonPath:  selectedFilterRef.current==='JsonPath' ? metaQueryValueRef.current: null,
      };
      
      return fetch(metaquery_url, {
        method: 'post',
        headers: headers,
        body: JSON.stringify(metaQueryParams),
      }).then(response => response.json(), error => {
        console.log("ERROR:", error);
      });
    }
  }

  const handlePrettifyQuery = () => {
    if(graphiQL.current) {
      graphiQL.current.handlePrettifyQuery();
    }
  };

  const handleMergeQuery = () => {
    if(graphiQL.current) {
      graphiQL.current.handleMergeQuery();
    }
  };

  const handleCopyQuery = () => {
    if(graphiQL.current) {
      graphiQL.current.handleCopyQuery();
    }
  };

  const handleToggleHistory = () => {
    if(graphiQL.current) {
      graphiQL.current.handleToggleHistory();
    }
  };

  const handleRunMetaQuery = (value) => {
    if(graphiQL.current) {
      runMetaQueryRef.current = true;
      metaQueryValueRef.current = value ? value : null;
      graphiQL.current.handleEditorRunQuery();
    }
  };

  const handleFilterSelected = (value) => {
    setSelectedFilter(value);
    setHasFilter(Boolean(value));
    selectedFilterRef.current = (value);
  }

  const handleCloseFilter = () => {
    setSelectedFilter("");
    setHasFilter(false);
    selectedFilterRef.current = ("");
  }

  const handleResize = () => {
    if(gridItemMetafilterRef.current) {
      setGridItemMetafilterHeight(gridItemMetafilterRef.current.clientHeight+1);
    }
  }

  return (
    <div>
      <Grid container className={classes.gridContainer} spacing={0} direction="column" >
        <Grid item 
          style={hasFilter ? { maxHeight: `calc(100% - ${gridItemMetafilterHeight}px)` } : {maxHeight: '100%'}} 
          className={classes.gridItemGraphiql}
          ref={gridItemGraphiqlRef}
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
                <GraphiQL.MenuItem label="jq" title="jq Filter" onSelect={() => handleFilterSelected('jq')} />
                <GraphiQL.MenuItem label="JsonPath" title="JsonPath Filter" onSelect={() => handleFilterSelected('JsonPath')} />
                <Fade in={hasFilter} mountOnEnter unmountOnExit >
                  <GraphiQL.MenuItem label="None" title="No filter" onSelect={() => handleFilterSelected('')} />
                </Fade>
              </GraphiQL.Menu>
            </GraphiQL.Toolbar>
          </GraphiQL>
        </Grid>
        <Grid item  className={classes.gridItemMetafilter} ref={gridItemMetafilterRef}>
            <Slide direction="up" in={hasFilter} mountOnEnter unmountOnExit >
              <div>
                <MetaQueryInput 
                  selectedFilter={selectedFilter} 
                  handleResize={handleResize}
                  handleFilterSelected={handleFilterSelected}
                  handleRunMetaQuery={handleRunMetaQuery}
                  handleCloseFilter={handleCloseFilter} />
              </div>
            </Slide>
        </Grid>
      </Grid>
    </div>
  );
}

