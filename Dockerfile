# Use the official Playwright image with the latest browsers preinstalled
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Set working directory
WORKDIR /app

# Copy package.json first and install deps
COPY package.json ./
RUN npm ci || npm install

# Copy the rest of the code
COPY . .

# Expose the correct port
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
