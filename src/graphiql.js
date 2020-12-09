import React, {useState, useEffect, useRef} from 'react';
import GraphiQL from 'graphiql';
import fetch from 'isomorphic-fetch';
import GraphiQLMetaFilters from './GraphiQLMetaFilters'
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Slide from '@material-ui/core/Slide';
import './graphiql.css';
import './cgraphiql.css'

const useStyles = makeStyles(theme => ({
  gridContainer: {
    width: "100%",
    height: `calc(100vh - 34px)`,
  },
}));

const server_url = process.env.REACT_APP_SERVER_URL || 'http://localhost:3000/graphql';
const metaquery_url = process.env.REACT_APP_SERVER_METAQUERY_URL || 'http://localhost:3000/meta_query';

export default function MyGraphiQL(props){
  const classes = useStyles();
  const { loginHandler } = props;

  const [graphiQLflexGrow, setGraphiQLflexGrow] = useState(1);
  const [filterElementHeight, setFilterElementHeight] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [hasFilter, setHasFilter] = useState(false);

  const graphiQLflexGrowRef = useRef(1);
  const filterElementHeightRef = useRef(0);
  const selectedFilterRef = useRef("");
  const filterValueRef = useRef("");
  const updateFlexLockRef = useRef(false);
  const hasFilterRef = useRef(false);
  const filterLocked = useRef(false);

  const graphiQL = useRef(null);
  const filterElementRef = useRef(null);
  const graphiqlElementRef = useRef(null);

  const checkLoggin = () => {
    let expires = new Date(localStorage.getItem('expirationDate')) < new Date();
    return (!!localStorage.getItem('token') &&  !expires);
  }

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+ localStorage.getItem('token'),
    };
  }

  const graphQLFetcher = (graphQLParams)=> {
    //check login
    if(!checkLoggin()){
      loginHandler(false);
      return;
    }
    let headers = getHeaders();

    return fetch(server_url, {
      method: 'post',
      headers: headers,
      body: JSON.stringify(graphQLParams),
    }).then(response => response.json(), error => {
      console.log("ERROR:", error);
    });
  };

  const graphQLMetaFetcher = (graphQLParams)=> {
    //check login
    if(!checkLoggin()){
      loginHandler(false);
      return;
    }
    //set metaQuery parameters
    let metaQueryParams = {
      queries:   graphQLParams,
      jq:        selectedFilterRef.current==='jq' ? filterValueRef.current: null,
      jsonPath:  selectedFilterRef.current==='JsonPath' ? filterValueRef.current: null,
    };
    let headers = getHeaders();

    return fetch(metaquery_url, {
      method: 'post',
      headers: headers,
      body: JSON.stringify(metaQueryParams),
    }).then(response => response.json(), error => {
      console.error("Error:", error);
      return {errors: error.message};
    }).catch((error) => {
      console.error("Error:", error);
      return {errors: error.message};
    });
  };

  /**
   * Listeners handlers
   */
  const handleWindowsResize = () => {
    //check
    if(!filterElementRef || !filterElementRef.current) return;
    if(!hasFilterRef || !hasFilterRef.current) return;

    //update height
    filterElementHeightRef.current = filterElementRef.current.clientHeight; 
    setFilterElementHeight(filterElementHeightRef.current);
  };

  /**
   * Effects
   */
  useEffect(() => {
    //add event listener
    window.addEventListener("resize", handleWindowsResize);

    return function cleanup() {
      //remove event listener
      window.removeEventListener("resize", handleWindowsResize);
    }
  }, []);

  useEffect(() => {
    //update ref
    hasFilterRef.current = hasFilter;
    //check
    if(!filterElementRef || !filterElementRef.current) return;
    if(!graphiqlElementRef || !graphiqlElementRef.current) return;

    //set filter height
    if(hasFilter) {
      let defaultH = (Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)-34)*(.5);
      if(!filterElementHeightRef.current) filterElementHeightRef.current = defaultH;
      setFilterElementHeight(filterElementHeightRef.current);
    }
  }, [hasFilter]);
  
  /**
   * Handlers
   */
  const handlePrettifyQuery = () => {
    //check
    if(!graphiQL || !graphiQL.current) return;
    graphiQL.current.handlePrettifyQuery();
  };

  const handleMergeQuery = () => {
    //check
    if(!graphiQL || !graphiQL.current) return;
    graphiQL.current.handleMergeQuery();
  };

  const handleCopyQuery = () => {
    //check
    if(!graphiQL || !graphiQL.current) return;
    graphiQL.current.handleCopyQuery();
  };

  const handleToggleHistory = () => {
    //check
    if(!graphiQL || !graphiQL.current) return;
    graphiQL.current.handleToggleHistory();
  };

  const handleRunMetaQuery = async (filter) => {
    //check
    if(!graphiQL || !graphiQL.current) return;

    //set meta-filter
    filterValueRef.current = filter ? filter : null;
    //graphql params
    let graphQLParams = {
      query: graphiQL.current.state.query,
      operationName: graphiQL.current.state.operationName,
      variables: graphiQL.current.state.variables ? JSON.parse(graphiQL.current.state.variables) : null,
    }
    return graphQLMetaFetcher(graphQLParams).catch((err) => {console.log("Error:", err); return {error: err.message}});
  };

  const handleToggleFilter = () => {
    //check: lock
    if(filterLocked.current) return;
    else filterLocked.current = true;

    if(selectedFilterRef.current) {
      //close
      selectedFilterRef.current = "";
      setSelectedFilter("");
      setHasFilter(false);
    } else {
      //open (default: jq)
      selectedFilterRef.current = "jq";
      setSelectedFilter("jq");
      setHasFilter(true);
    }
  }

  const handleFilterSelected = (value) => {
    setSelectedFilter(value);
    setHasFilter(Boolean(value));
    selectedFilterRef.current = value;
  }

  const handleCloseFilter = () => {
    setSelectedFilter("");
    setHasFilter(false);
    selectedFilterRef.current = "";
  }

  const onNewResult = () => {
    //check
    if(!filterElementHeightRef || !filterElementHeightRef.current) return;
    if(!graphiQLflexGrowRef || !graphiQLflexGrowRef.current) return;
    setFilterElementHeight(filterElementHeightRef.current);
    setGraphiQLflexGrow(graphiQLflexGrowRef.current);
  }

  const onInitVerticalResize = (mouseDownEvent) => {
    //checks
    if(!mouseDownEvent || typeof mouseDownEvent !== 'object') return;
    if(!graphiqlElementRef || !graphiqlElementRef.current) return;

    /**
     * Get GraphiQL variable-editor height.
     * This is needed because when variable-editor is open,
     * it has a fixed height that not allows the filter-editor
     * to shrink it.
     */
    let veditor = document.getElementsByClassName('variable-editor secondary-editor');
    let veditorHeight = 30; //veditor-title height
    if(veditor && typeof veditor==='object' && veditor.length === 1 
    && veditor[0].clientHeight>30) { //variable-editor is open
      veditorHeight = veditor[0].clientHeight;
    }

    //set initial values
    let initialY = mouseDownEvent.clientY;
    let initialHeight = graphiqlElementRef.current.clientHeight;
    //event handler
    let handleMouseMove = function(mouseMoveEvent) {
      //check: no left-button down
      if(!mouseMoveEvent.buttons) {
        document.removeEventListener("mousemove", handleMouseMove, true);
        return;    
      }
      //set max height to current viewport height - topBar.
      let maxHeight = (Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - 34);
      //new values
      let newHeight = initialHeight - (initialY - mouseMoveEvent.clientY); 
      let newFilterHeight = maxHeight - newHeight;
      let newFlexGrow = newHeight / newFilterHeight;
      //check limits
      if(newHeight >= (34+veditorHeight) && newHeight <= (maxHeight-34)) {
        //update flex-grow
        graphiQLflexGrowRef.current = newFlexGrow;
        //update filter height
        filterElementHeightRef.current = newFilterHeight;
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
    //add/remove event listeners
    if(mouseDownEvent.button === 0) { //left button
      mouseDownEvent.preventDefault();
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  }

  /**
   * Utils
   */
  const delayedUpdateFlex = async (ms) => {
    await new Promise(resolve => {
      //set timeout
      window.setTimeout(function() {
        updateFlexLockRef.current = false;
        setFilterElementHeight(filterElementHeightRef.current);
        setGraphiQLflexGrow(graphiQLflexGrowRef.current);
        resolve("ok");
      }, ms);
    });
  };

  return (
    <div>
      <Grid container className={classes.gridContainer} wrap='nowrap' spacing={0} direction="column" >
        <div ref={graphiqlElementRef}
          style={{
            height: hasFilter ? "100%" : `calc(100vh - 34px)`,
            width: "100%",
            flex: hasFilter ? graphiQLflexGrow : 1,
            WebkitFlex: hasFilter ? graphiQLflexGrow : 1,
            transition: "flex .01s, height .05s",
            WebkitTransition: "flex .01s, height .05s",
            MozTransition: "flex .01s, height .05s",
            OTransition: "flex .01s, height .05s",
          }}
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
              <GraphiQL.Button
                onClick={handleToggleFilter}
                title={hasFilter ? "Close Filter" : "Show Filter"}
                label="Filter"
              />
            </GraphiQL.Toolbar>
          </GraphiQL>
        </div>
        
        <div ref={filterElementRef}
          style={{
            minHeight: 0,
            width: "100%",
            flex: hasFilter ? 1 : 0,
            WebkitFlex: hasFilter ? 1 : 0,
            transition: "flex .01s",
            WebkitTransition: "flex .01s",
            MozTransition: "flex .01s",
            OTransition: "flex .01s",
          }}
        >
          <Slide direction="up" in={hasFilter} mountOnEnter unmountOnExit 
            onEntered={() => {
              let filterH = filterElementRef.current.clientHeight;
              //sync height
              filterElementHeightRef.current = filterH;
              setFilterElementHeight(filterElementHeightRef.current);
              //unlock
              filterLocked.current = false;
            }}
            onExited={() => {
              //unlock
              filterLocked.current = false;
            }}
          >
            <div>
              <GraphiQLMetaFilters 
                selectedFilter={selectedFilter}
                filterHeight={filterElementHeight}
                onInitVerticalResize={onInitVerticalResize}
                onNewResult={onNewResult}
                handleFilterSelected={handleFilterSelected}
                handleRunMetaQuery={handleRunMetaQuery}
                handleCloseFilter={handleCloseFilter} />
            </div>
          </Slide>
        </div>
      </Grid>
    </div>
  );
}

