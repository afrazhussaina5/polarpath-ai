FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Set environment for production
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Start uvicorn on the configured PORT
CMD ["python", "backend/run_server.py"]
