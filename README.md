# RHBL Order Dashboard

Next.js 14 + MongoDB + Tailwind CSS dashboard — deployable on Vercel.

## Tech stack
- **Next.js 14** (App Router, TypeScript)
- **MongoDB** via native driver (connection pooling)
- **Tailwind CSS** for styling
- **Vercel** for hosting

---

## Local setup

### 1. Clone & install
```bash
git clone https://github.com/YOUR_USERNAME/rhbl-dashboard.git
cd rhbl-dashboard
npm install
```

### 2. Environment variables
Create `.env.local` in the root (⚠️ never commit this file):
```env
MONGODB_URI=your_mongodb_connection_string_here
MONGODB_DB=your_database_name_here
```

### 3. MongoDB collection setup
Collection name: `ORDER_DATA`

### 4. Run locally
```bash
npm run dev
# open http://localhost:3000
```

---

## Deploy to Vercel

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial RHBL dashboard"
git remote add origin https://github.com/YOUR_USERNAME/rhbl-dashboard.git
git push -u origin main
```

### Step 2 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)

### Step 3 — Add environment variables in Vercel
1. Go to your project → **Settings → Environment Variables**
2. Add:
   - `MONGODB_URI` = your full MongoDB connection string
   - `MONGODB_DB` = your database name
3. Set for **Production**, **Preview**, **Development**
4. **Redeploy**

---

## MongoDB Atlas network access
Atlas → **Network Access** → **Add IP Address** → `0.0.0.0/0`

---

## Importing data from CSV/Excel

Use [MongoDB Compass](https://www.mongodb.com/products/compass):
1. Connect with your URI
2. Create database and collection `ORDER_DATA`
3. **Add Data → Import File** → select your CSV

Or use `mongoimport` CLI:
```bash
mongoimport --uri "YOUR_MONGODB_URI/YOUR_DB_NAME" \
  --collection ORDER_DATA \
  --type csv \
  --headerline \
  --file your_orders.csv
```

---

## Project structure
```
src/
├── app/
│   ├── api/orders/route.ts   ← MongoDB API
│   ├── page.tsx              ← Dashboard UI
│   ├── layout.tsx
│   └── globals.css
└── lib/
    ├── mongodb.ts            ← DB connection
    └── types.ts              ← TypeScript types
```
