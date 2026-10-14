# PointCloud Pro — Reproducible Docker Container
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for Open3D headless/OpenGL rendering and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code, tests, and sample datasets
COPY . .

# Expose Streamlit port
EXPOSE 8501

# Healthcheck to verify service availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8501/_stcore/health || exit 1

# Default command runs the Streamlit PointCloud Pro Studio
CMD ["streamlit", "run", "pointcloud_pro/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
