import React, { Component } from 'react';
import './App.css';
import Login from './login';
import MyGraphiQL from './graphiql';

class App extends Component {
  state = {
    isLoggedIn: false
  }

  loggedHandler = ( newState ) => {
    console.log("Called with: ", newState);
    this.setState({isLoggedIn: newState } );

  }

  render() {
    return (
      <div style={{height: "100%"}}>
      { !this.state.isLoggedIn ? <Login loginHandler={this.loggedHandler} /> : null }

      { this.state.isLoggedIn ?

        <div style={{height: "100vh", overflow:'hidden'}}>
          <button className="btn btn-primary" onClick={this.loggedHandler.bind(this, false)} > Logout</button>
          <MyGraphiQL loginHandler={this.loggedHandler}/>
        </div>
        : null }
      </div>
    );
  }
}

export default App;
