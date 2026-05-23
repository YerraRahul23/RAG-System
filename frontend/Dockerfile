FROM node:20-alpine

WORKDIR /app

# Copy package dependencies and install
COPY package.json .
RUN npm install

# Copy source code files
COPY . .

# Expose Vite dev port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]
