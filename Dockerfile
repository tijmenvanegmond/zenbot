FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY dist dist
EXPOSE 8080
CMD ["node", "dist/app.js"]