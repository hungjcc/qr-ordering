# Delicacy Restaurant - Complete Setup Guide

## Prerequisites

1. **Python 3.11 to 3.13** (for backend)
2. **Node.js 18 or higher** (for frontend)
3. **Git** (optional, for version control)

---

## Step 1: Backend Setup

### 1.1 Navigate to backend directory
```bash
cd delicacy-restaurant/backend
```

### 1.2 Create virtual environment (recommended)
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate
```

### 1.3 Install dependencies
```bash
pip install -r requirements.txt
```

### 1.4 Create environment file
```bash
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac
```

### 1.5 Configure environment variables

Edit `.env` file:
```env
# Razorpay Payment (Get from https://dashboard.razorpay.com)
# Test keys are pre-configured for testing
RAZORPAY_KEY_ID=rzp_test_SEULnJj6ZBfPb4
RAZORPAY_KEY_SECRET=hbKF4N7QaMyjDcI0FilNtPyW

# Server Configuration
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=sqlite+aiosqlite:///./delicacy_restaurant.db

# QR Configuration
MAX_TABLES=20  # Maximum tables for QR generation
```

### 1.6 Start the backend server
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The backend will run at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

---

## Step 2: Frontend Setup

### 2.1 Open a new terminal and navigate to frontend directory
```bash
cd delicacy-restaurant/frontend
```

### 2.2 Install dependencies
```bash
npm install
```

### 2.3 Create environment file
```bash
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac
```

### 2.4 Configure environment variables (optional)

Edit `.env` file:
```env
# API URL (auto-detected if not set)
VITE_API_URL=http://localhost:8000

# Razorpay Key (auto-configured from backend)
VITE_RAZORPAY_KEY_ID=rzp_test_SEULnJj6ZBfPb4
```

### 2.5 Start the development server
```bash
npm run dev
```

The frontend will run at: **http://localhost:5173**

---

## Step 3: Access the Application

| Page | URL | Description |
|------|-----|-------------|
| Customer Menu | http://localhost:5173/table/1 | Customer ordering interface |
| Kitchen Display | http://localhost:5173/kitchen | Real-time kitchen orders |
| Admin Panel | http://localhost:5173/admin | Management dashboard |
| Order Tracking | http://localhost:5173/order/{order_number} | Track order status |
| QR Generator | http://localhost:5173/admin/qr | Generate table QR codes |

---

## Step 4: Testing the System

### 4.1 Customer View (Menu & Ordering)

1. Open browser and go to: **http://localhost:5173/table/1**
2. You should see the menu with all items
3. Try adding items to cart
4. Place an order with test payment

### 4.2 Kitchen Dashboard

1. Open a new tab and go to: **http://localhost:5173/kitchen**
2. You should see real-time orders when customers place them
3. Test accepting, preparing, and marking orders as ready

### 4.3 Admin Panel

1. Go to: **http://localhost:5173/admin**
2. View dashboard with sales statistics
3. Manage menu items
4. Generate QR codes for tables

### 4.4 QR Codes

1. Go to: **http://localhost:5173/admin/qr**
2. Enter table number (1-20)
3. Click "Download QR Code"
4. Print and laminate them
5. Place on respective tables

---

## Step 5: Payment Testing (Razorpay Test Mode)

### Test Cards

| Card Type | Card Number | Expiry | CVV |
|-----------|-------------|--------|-----|
| Success | 4111 1111 1111 1111 | Any future date | Any 3 digits |
| Failure | 4000 0000 0000 0002 | Any future date | Any 3 digits |

### Payment Flow

1. Customer places order
2. Clicks "Pay Now"
3. Redirected to Razorpay payment page
4. Enter test card details
5. Payment success → Order confirmed
6. Kitchen receives notification

---

## Step 6: WebSocket Testing

The system uses WebSocket for real-time updates:

1. Open Kitchen Dashboard in one tab
2. Place an order in Customer View (different tab/window)
3. Kitchen should receive instant notification
4. No page refresh required

---

## Project Structure

```
delicacy-restaurant/
├── backend/
│   ├── app.py              # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   ├── .env              # Environment variables
│   ├── .env.example      # Environment template
│   └── backend/static/   # QR codes storage
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx      # Entry point
│   │   ├── App.jsx       # Main app with routing
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   │   ├── CustomerPage.jsx    # Customer menu
│   │   │   ├── KitchenPage.jsx     # Kitchen display
│   │   │   ├── AdminPage.jsx       # Admin dashboard
│   │   │   ├── OrderStatusPage.jsx # Order tracking
│   │   │   └── admin/              # Admin sub-pages
│   │   ├── hooks/         # Custom hooks
│   │   │   └── useWebSocket.js     # WebSocket
│   │   ├── lib/          # Utilities
│   │   │   └── api.js    # API client
│   │   └── store/        # State management
│   │       └── store.js  # Zustand stores
│   ├── .env.example      # Environment template
│   └── package.json
│
├── README.md
└── SETUP_GUIDE.md
```

---

## Features Implemented

### ✅ Customer Features
- QR-based menu access (table-specific)
- Browse menu with categories and subcategories
- Search and filter items (Veg/Non-Veg)
- Add to cart with Half/Full selection
- Quantity management
- Real-time cart total
- Order placement with customer details
- Live order status tracking
- Razorpay payment integration

### ✅ Kitchen Features
- Real-time order dashboard
- New order notifications (sound + vibration)
- Order status management
- Table number display
- Order timer with urgency
- Payment status tracking
- Accept/Reject/Ready actions

### ✅ Admin Features
- Dashboard with sales statistics
- Menu management (CRUD)
- Toggle item availability
- QR code generation for tables (up to 20)
- Sales reports
- Discount coupon management
- Analytics and exports

### ✅ Technical Features
- React + Vite frontend
- FastAPI backend with SQLite
- WebSocket for real-time updates
- Razorpay payment integration
- PWA support (installable)
- Dark mode
- Responsive design (mobile-first)
- Toast notifications
- State persistence (cart)
- Service worker for offline support

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process if needed
taskkill /PID <PID> /F
```

- If you see `zsh: command not found: uvicorn`, activate the virtual environment first and install backend dependencies:
```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements.txt
```
- Use Python `3.11` to `3.13`. Python `3.14` can fail with pinned dependencies in this project.

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### WebSocket connection failed
- Make sure backend is running on port 8000
- Check browser console for errors
- Verify CORS settings

### Database errors
```bash
# Delete existing database and restart
del delicacy_restaurant.db
uvicorn app:app --reload
```

### Razorpay payment not working
- Verify API keys in .env
- Ensure you're using test mode keys
- Check Razorpay dashboard

### QR codes not generating
- Check backend/static folder exists
- Ensure MAX_TABLES is set in .env
- Verify folder permissions

---

## Production Deployment

### Backend
```bash
# Use a production ASGI server
pip install gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend
```bash
# Build for production
npm run build

# Serve with nginx or any static file server
```

### Database
```bash
# For production, use PostgreSQL
DATABASE_URL=postgresql://user:password@localhost/delicacy
```

---

## Security Recommendations

For production deployment:

1. **Update Razorpay keys** - Use live keys, not test keys
2. **Configure CORS** - Set specific frontend URL instead of "*"
3. **Add authentication** - Implement JWT for admin endpoints
4. **Use HTTPS** - Enable SSL/TLS
5. **Rate limiting** - Add API rate limiting
6. **Input validation** - Enhanced validation for all inputs
7. **Logging** - Configure proper logging

---

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify backend logs for API errors
3. Ensure all dependencies are installed
4. Check network tab for failed requests

---

## License

This project is developed for educational purposes as a college final year project.
