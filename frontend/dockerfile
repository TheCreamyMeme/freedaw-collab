# ==========================================
# STAGE 1: Scaffold, Configure, and Build
# ==========================================
# Use Node.js Alpine for a lightweight build environment
FROM node:20-alpine AS builder

# Set the initial working directory
WORKDIR /app

# 1. Scaffold a fresh Vite React app non-interactively
RUN npm create vite@latest webdaw -- --template react

# Move into the newly scaffolded Vite directory
WORKDIR /app/webdaw

# 2. Install base React dependencies
RUN npm install

# 3. Install specific libraries (ADDED socket.io-client here)
# (Pinning Tailwind to v3 to guarantee config compatibility and avoid npx crashes)
RUN npm install lucide-react tailwindcss@3 postcss autoprefixer tailwindcss-animate socket.io-client

# 4. Inject PostCSS Configuration dynamically
RUN printf 'export default {\n\
  plugins: {\n\
    tailwindcss: {},\n\
    autoprefixer: {},\n\
  },\n\
}\n' > postcss.config.js

# 5. Inject the Tailwind Configuration dynamically
RUN printf '/** @type {import("tailwindcss").Config} */\n\
export default {\n\
  content: [\n\
    "./index.html",\n\
    "./src/**/*.{js,ts,jsx,tsx}",\n\
  ],\n\
  theme: {\n\
    extend: {},\n\
  },\n\
  plugins: [\n\
    require("tailwindcss-animate")\n\
  ],\n\
}\n' > tailwind.config.js

# 6. Inject the Base CSS
RUN printf '@tailwind base;\n\
@tailwind components;\n\
@tailwind utilities;\n\
\n\
body {\n\
  margin: 0;\n\
  background-color: #0a0a0a;\n\
  color: #d4d4d4;\n\
}\n' > src/index.css

# 7. Copy your local React file into the container
COPY DAW_WEBAPP.jsx src/App.jsx

# 8. Build the Production App
RUN npm run build


# ==========================================
# STAGE 2: Serve the app with Node 'serve'
# ==========================================
FROM node:20-alpine

# Set the working directory for the production server
WORKDIR /app

# Install 'serve', a lightweight static web server perfect for SPAs
RUN npm install -g serve

# Copy ONLY the compiled static files from Stage 1 into this clean container
COPY --from=builder /app/webdaw/dist ./dist

# Expose port 3000
EXPOSE 3000

# Start the server (-s redirects all routing back to index.html)
CMD ["serve", "-s", "dist", "-l", "3000"]