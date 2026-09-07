import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = "0.0.0.0"  # Production binding
    print(f"Starting PolarPath AI Server on {host}:{port}...")
    print(f"Access UI at: http://localhost:{port}")
    print(f"Access API docs at: http://localhost:{port}/docs")
    uvicorn.run("main:app", host=host, port=port, log_level="info")
