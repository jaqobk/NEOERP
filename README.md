# A40 ERP

Multi-tenant retail POS, inventory management, accounting ledger, purchase order, and HR management ERP built with React, Vite, Express, and SQLite.

## Requirements

- Node.js 18+ and npm

## Local Installation & Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file from the template:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your local configuration values as needed:
   - `ALLOWED_ORIGINS`: Comma-separated list of additional allowed browser origins for CORS (local dev origins such as `http://localhost:3000` are permitted automatically when running locally).
   - `SUPER_ADMIN_NAME` & `SUPER_ADMIN_PIN`: Optional platform console credentials configured cleanly via environment variables.

3. Start the development server:

   ```bash
   npm run dev
   ```

   The SQLite database is automatically initialized from `schema.sql` on startup and served on `http://localhost:3000`.

4. Build for production:

   ```bash
   npm run build
   ```

5. Start the production server:

   ```bash
   npm start
   ```
