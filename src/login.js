import React, { Component } from 'react';
import axios from 'axios';
import decode from 'jwt-decode';

class Login extends Component {

  constructor(props){
    super(props);
    this.state = {
      email: "",
      password: ""
    }

    this.login_url = process.env.REACT_APP_LOGIN_URL || 'http://localhost:3000/login';
  }

  fetchlogin = () => {

    return axios({url: this.login_url,
      method: 'POST',
      data: {email: this.state.email, password: this.state.password }
    });
  }

  setExpirationDate = (token) =>{
    //set expiration Date

    let date = null;
    const  decoded_token = decode(token);
    if (decoded_token.exp) {
      date = new Date(0);
      date.setUTCSeconds(decoded_token.exp);
    }
    localStorage.setItem('expirationDate', date);
  }

  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  handleSubmit = (event) => {
     event.preventDefault();
     console.log("Clicker Loging");
     console.log(this.props.loginHandler )

     this.fetchlogin().then( response => {
      const token = response.data.token;
      localStorage.setItem('token', token);
      this.setExpirationDate(token);
      this.props.loginHandler( true );
     }).catch(err => {
       console.log("ERROR IN LOGIN" ,err);
     })


  }


  render(){
    return(
      <div className="col-md-6 col-md-offset-3">
      <form name="form" onSubmit={this.handleSubmit}>
        <label htmlFor="email">Username</label>
        <input type="text" className="form-control" name="email" value={this.state.email} onChange={this.handleChange} />
        <label htmlFor="password">Password</label>
        <input type="password" className="form-control" name="password" value={this.state.password} onChange={this.handleChange} />
        <div className="form-group" style={{marginTop: "20px"}} >
          <button className="btn btn-primary" >Login</button>
        </div>
      </form>
      </div>
    );
  }
}

export default Login;
