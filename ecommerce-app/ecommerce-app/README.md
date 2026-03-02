# ShopNow — Firebase E-Commerce Application

A complete, production-ready full-stack e-commerce web application built with React, Firebase, and Stripe.

## Tech Stack

- **Frontend**: React 18 + Vite, React Router v6, Tailwind CSS, Context API
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Payments**: Stripe (test mode)
- **Hosting**: Firebase Hosting

---

## Folder Structure

```
ecommerce-app/
├── .env.example              # Environment variables template
├── firebase.json             # Firebase project config
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
├── storage.rules             # Firebase Storage rules
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── firebase/config.js        # Firebase initialization
│       ├── context/
│       │   ├── AuthContext.jsx       # Authentication state
│       │   ├── CartContext.jsx       # Shopping cart state
│       │   ├── ThemeContext.jsx      # Dark mode state
│       │   └── WishlistContext.jsx   # Wishlist state
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── ProductCard.jsx
│       │   ├── AdminLayout.jsx
│       │   ├── LoadingSpinner.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── AdminRoute.jsx
│       │   └── ScrollToTop.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Products.jsx
│       │   ├── ProductDetail.jsx
│       │   ├── Cart.jsx
│       │   ├── Checkout.jsx
│       │   ├── Profile.jsx
│       │   ├── OrderDetail.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── ForgotPassword.jsx
│       │   ├── Wishlist.jsx
│       │   └── NotFound.jsx
│       └── admin/
│           ├── Dashboard.jsx         # Analytics + charts
│           ├── Products.jsx          # Product CRUD
│           ├── Orders.jsx            # Order management
│           ├── Users.jsx             # User management
│           └── Coupons.jsx           # Coupon management
├── functions/
│   ├── package.json
│   └── index.js              # All Cloud Functions
└── scripts/
    └── seed.js               # Database seeder
```

---

## Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (create at https://console.firebase.google.com)
- A Stripe account (https://stripe.com) - test mode is free

---

## Setup Instructions

### 1. Firebase Project Setup

1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable the following services:
   - **Authentication** → Sign-in method → Enable Email/Password
   - **Firestore Database** → Create database (start in production mode)
   - **Storage** → Get started
   - **Functions** → Get started (requires Blaze plan for external API calls)

### 2. Get Firebase Config

1. Go to Project Settings → General → Your apps
2. Click "Web" icon to add a web app
3. Copy the config object

### 3. Environment Variables

```bash
cp .env.example frontend/.env
```

Edit `frontend/.env` with your values:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Cloud Functions
cd ../functions && npm install
```

### 5. Firebase CLI Login & Init

```bash
firebase login
firebase use --add your-project-id
```

### 6. Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

### 7. Configure Cloud Functions (Stripe)

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_YOUR_STRIPE_SECRET_KEY" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

### 8. Deploy Cloud Functions

```bash
cd functions && npm install
firebase deploy --only functions
```

### 9. Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Add endpoint: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
3. Select event: `checkout.session.completed`
4. Copy webhook signing secret
5. Run: `firebase functions:config:set stripe.webhook_secret="whsec_..."`
6. Redeploy: `firebase deploy --only functions`

### 10. Seed Database (Optional)

```bash
# Install dependencies
cd scripts
npm install firebase-admin

# Set up credentials
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccount.json"
export FIREBASE_PROJECT_ID="your-project-id"

# Run seeder
node seed.js
```

This creates:
- Admin account: `admin@shopnow.com` / `Admin123!`
- Test user: `test@shopnow.com` / `Test123!`
- 12 sample products
- 3 sample coupons (WELCOME10, SAVE20, FREESHIP)

---

## Development

```bash
cd frontend
npm run dev
# App runs at http://localhost:5173
```

For Functions development with emulators:
```bash
firebase emulators:start
```

---

## Deployment

### Deploy Everything

```bash
# Build frontend
cd frontend && npm run build

# Deploy hosting + functions + rules
firebase deploy
```

### Deploy Separately

```bash
# Hosting only
cd frontend && npm run build
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Rules only
firebase deploy --only firestore:rules,storage
```

---

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | ✅ Successful payment |
| 4000 0000 0000 0002 | ❌ Card declined |
| 4000 0025 0000 3155 | 🔐 3D Secure authentication |
| 4000 0000 0000 9995 | ❌ Insufficient funds |

- **Expiry**: Any future date (e.g., 12/26)
- **CVV**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)

---

## Features

### User Features
- ✅ Email/password authentication
- ✅ Email verification + password reset
- ✅ Product browsing with search, filter, sort
- ✅ Paginated product listings
- ✅ Product detail with image gallery & reviews
- ✅ Persistent cart (synced to Firestore)
- ✅ Coupon/discount codes
- ✅ Stripe checkout integration
- ✅ Order history & tracking
- ✅ Wishlist
- ✅ Dark mode toggle
- ✅ Fully responsive

### Admin Features
- ✅ Dashboard with analytics & charts
- ✅ Product CRUD with image upload to Firebase Storage
- ✅ Order management & status updates
- ✅ User management (role promotion/demotion)
- ✅ Coupon management system
- ✅ Protected admin routes

### Security
- ✅ Firestore security rules (role-based)
- ✅ Firebase Storage rules
- ✅ Cloud Functions for sensitive operations
- ✅ Input validation
- ✅ Protected routes

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_...) |

---

## Troubleshooting

**Q: Cart not syncing?**
Ensure Firestore rules are deployed and user is logged in.

**Q: Images not uploading?**
Check Storage rules are deployed and user has admin role in Firestore.

**Q: Payment failing?**
Verify Stripe keys are correct and webhook is configured.

**Q: Functions not deploying?**
Ensure your project is on the Blaze (pay-as-you-go) plan. Functions are free tier eligible but require Blaze for external HTTP calls (Stripe).

**Q: CORS errors in production?**
Cloud Functions automatically handle CORS for `onCall` functions.
