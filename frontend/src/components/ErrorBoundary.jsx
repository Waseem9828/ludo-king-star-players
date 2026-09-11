import React from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", color: "white" }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: "#f87171", margin: "1rem 0" }}>{this.state.error?.message}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              background: "#0a51e1", 
              color: "white", 
              border: "none", 
              padding: "10px 20px", 
              borderRadius: "8px", 
              cursor: "pointer",
              marginRight: "10px"
            }}
          >
            Reload Page
          </button>
          <Link 
            to="/" 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ 
              background: "#334155", 
              color: "white", 
              textDecoration: "none",
              padding: "10px 20px", 
              borderRadius: "8px" 
            }}
          >
            Go Home
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
