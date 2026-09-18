FROM python:3.13-slim
WORKDIR /app
COPY requirements.lock.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --create-home appuser && mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["python", "-m", "app.start_server"]
