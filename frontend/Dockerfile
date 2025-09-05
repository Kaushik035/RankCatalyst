FROM node:20-alpine

WORKDIR /app
# with context set to ./frontend, reference files directly
COPY package.json /app/package.json
RUN npm install --silent
COPY . /app
EXPOSE 5173
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0 --port 5173"]
