/**
 * Firebase Seed Script
 * Run: node scripts/seed.js
 *
 * Prerequisites:
 * 1. Install: npm install firebase-admin
 * 2. Download your Firebase Admin SDK JSON from Firebase Console
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
 * OR replace serviceAccountPath below
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// Option A: Using environment variable GOOGLE_APPLICATION_CREDENTIALS
admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id' });

// Option B: Using service account file directly (uncomment & update path)
// const serviceAccount = require('./serviceAccount.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

const SAMPLE_PRODUCTS = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium over-ear headphones with 30-hour battery life, active noise cancellation, and crystal-clear sound quality. Perfect for work and travel.',
    price: 79.99,
    category: 'Electronics',
    stock: 45,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'],
    rating: 4.5,
    reviewCount: 128,
  },
  {
    name: 'Mechanical Keyboard - TKL',
    description: 'Compact tenkeyless mechanical keyboard with Cherry MX switches, RGB backlighting, and PBT keycaps. Ideal for programmers and typists.',
    price: 129.99,
    category: 'Electronics',
    stock: 30,
    images: ['https://images.unsplash.com/photo-1595044778826-a8b45bc8ac40?w=600'],
    rating: 4.7,
    reviewCount: 89,
  },
  {
    name: 'Classic Leather Wallet',
    description: 'Slim genuine leather bifold wallet with RFID blocking technology. Holds up to 8 cards and cash. Handcrafted for durability.',
    price: 39.99,
    category: 'Clothing',
    stock: 100,
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=600'],
    rating: 4.3,
    reviewCount: 256,
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Eco-friendly non-slip yoga mat with alignment lines. Extra thick 6mm cushioning for joint protection. Perfect for yoga, pilates, and meditation.',
    price: 49.99,
    category: 'Sports',
    stock: 75,
    images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600'],
    rating: 4.6,
    reviewCount: 412,
  },
  {
    name: 'Stainless Steel Water Bottle',
    description: 'Vacuum insulated water bottle that keeps drinks cold for 24 hours and hot for 12 hours. BPA-free, leakproof lid. 32 oz capacity.',
    price: 24.99,
    category: 'Sports',
    stock: 200,
    images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600'],
    rating: 4.8,
    reviewCount: 632,
  },
  {
    name: 'Minimalist Desk Lamp',
    description: 'Modern LED desk lamp with 5 color modes and 5 brightness levels. USB charging port, touch control, and memory function.',
    price: 34.99,
    category: 'Home & Garden',
    stock: 60,
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600'],
    rating: 4.4,
    reviewCount: 178,
  },
  {
    name: 'JavaScript: The Good Parts',
    description: 'A book that uncovers the excellent features in JavaScript programming language. Essential reading for modern web developers.',
    price: 19.99,
    category: 'Books',
    stock: 50,
    images: ['https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600'],
    rating: 4.9,
    reviewCount: 544,
  },
  {
    name: 'Ceramic Pour-Over Coffee Set',
    description: 'Handcrafted ceramic coffee dripper set with carafe, filter holder, and measuring spoon. Brews the perfect pour-over coffee every time.',
    price: 54.99,
    category: 'Home & Garden',
    stock: 35,
    images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600'],
    rating: 4.7,
    reviewCount: 92,
  },
  {
    name: 'Natural Face Moisturizer SPF 50',
    description: 'Lightweight daily moisturizer with broad-spectrum SPF 50 protection. Enriched with hyaluronic acid, vitamin C, and green tea extract.',
    price: 28.99,
    category: 'Beauty',
    stock: 90,
    images: ['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600'],
    rating: 4.5,
    reviewCount: 301,
  },
  {
    name: 'Wireless Charging Pad',
    description: '15W fast wireless charging pad compatible with all Qi-enabled devices. Slim profile with LED indicator and non-slip surface.',
    price: 22.99,
    category: 'Electronics',
    stock: 120,
    images: ['https://images.unsplash.com/photo-1618434902736-48c52bdddd88?w=600'],
    rating: 4.2,
    reviewCount: 213,
  },
  {
    name: 'Resistance Bands Set',
    description: 'Set of 5 resistance bands with different tension levels (10-50 lbs). Includes door anchor, ankle straps, and carrying bag.',
    price: 29.99,
    category: 'Sports',
    stock: 150,
    images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600'],
    rating: 4.6,
    reviewCount: 478,
  },
  {
    name: 'Smart Backpack 30L',
    description: 'Anti-theft backpack with USB charging port, hidden pockets, and laptop compartment (fits up to 17"). Water-resistant material.',
    price: 69.99,
    category: 'Clothing',
    stock: 42,
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600'],
    rating: 4.4,
    reviewCount: 156,
  },
];

const SAMPLE_COUPONS = [
  {
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    minOrder: 0,
    maxUses: 1000,
    usedCount: 42,
    active: true,
  },
  {
    code: 'SAVE20',
    type: 'fixed',
    value: 20,
    minOrder: 75,
    maxUses: 500,
    usedCount: 18,
    active: true,
  },
  {
    code: 'FREESHIP',
    type: 'fixed',
    value: 4.99,
    minOrder: 25,
    maxUses: null,
    usedCount: 0,
    active: true,
  },
];

async function seed() {
  console.log('🌱 Starting seed...\n');

  // 1. Create admin user
  console.log('Creating admin user...');
  try {
    let adminUser;
    try {
      adminUser = await auth.getUserByEmail('admin@shopnow.com');
      console.log('  Admin user already exists');
    } catch {
      adminUser = await auth.createUser({
        email: 'admin@shopnow.com',
        password: 'Admin123!',
        displayName: 'Admin User',
        emailVerified: true,
      });
      console.log('  Admin user created: admin@shopnow.com / Admin123!');
    }

    await db.collection('users').doc(adminUser.uid).set({
      uid: adminUser.uid,
      name: 'Admin User',
      email: 'admin@shopnow.com',
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('  Admin Firestore profile set ✓\n');
  } catch (err) {
    console.error('  Failed to create admin:', err.message);
  }

  // 2. Create test user
  console.log('Creating test user...');
  try {
    let testUser;
    try {
      testUser = await auth.getUserByEmail('test@shopnow.com');
      console.log('  Test user already exists');
    } catch {
      testUser = await auth.createUser({
        email: 'test@shopnow.com',
        password: 'Test123!',
        displayName: 'Test User',
        emailVerified: true,
      });
      console.log('  Test user created: test@shopnow.com / Test123!');
    }

    await db.collection('users').doc(testUser.uid).set({
      uid: testUser.uid,
      name: 'Test User',
      email: 'test@shopnow.com',
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('  Test user Firestore profile set ✓\n');
  } catch (err) {
    console.error('  Failed to create test user:', err.message);
  }

  // 3. Seed products
  console.log('Seeding products...');
  const productsRef = db.collection('products');
  let productCount = 0;
  for (const product of SAMPLE_PRODUCTS) {
    await productsRef.add({
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    productCount++;
  }
  console.log(`  ${productCount} products created ✓\n`);

  // 4. Seed coupons
  console.log('Seeding coupons...');
  for (const coupon of SAMPLE_COUPONS) {
    await db.collection('coupons').add({
      ...coupon,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ${SAMPLE_COUPONS.length} coupons created ✓\n`);

  console.log('✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Admin:    admin@shopnow.com');
  console.log('🔑 Password: Admin123!');
  console.log('');
  console.log('📧 User:     test@shopnow.com');
  console.log('🔑 Password: Test123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
