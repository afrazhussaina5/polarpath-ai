import uvicorn
import sys
import os

if __name__ == "__main__":
    port = 8000
    print(f"Starting PolarPath AI Server on port {port}...")
    print(f"Access UI at: http://localhost:{port}")
    print(f"Access API docs at: http://localhost:{port}/docs")
    uvicorn.run("main:app", host="127.0.0.1", port=port, log_level="info")
