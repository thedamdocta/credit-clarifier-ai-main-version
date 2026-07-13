FROM node:20-bookworm

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv poppler-utils tesseract-ocr && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

RUN npx playwright install chromium --with-deps

COPY python_worker/requirements.txt ./python_worker/
RUN pip3 install -r python_worker/requirements.txt --break-system-packages

COPY server ./server
COPY shared ./shared
COPY python_worker ./python_worker

ENV API_HOST=0.0.0.0
ENV NODE_ENV=production

CMD sh -c "API_PORT=${PORT:-8787} node server/index.mjs"