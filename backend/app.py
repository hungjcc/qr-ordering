"""
Delicacy Restaurant - Production-Ready Restaurant Management System Backend
FastAPI application with SQLite, WebSocket, Razorpay integration, Analytics, and more
"""

import os
import json
import base64
import asyncio
import io
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Set
from pathlib import Path
from enum import Enum
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON, Index, func, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv
import qrcode
from PIL import Image
import razorpay
import csv
import io as csv_io

# Load environment variables
load_dotenv()

# Configuration
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_SEULnJj6ZBfPb4")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "hbKF4N7QaMyjDcI0FilNtPyW")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GST_RATE = float(os.getenv("GST_RATE", "5"))

# Initialize Razorpay client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./delicacy_restaurant.db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# ===================== ENUMS =====================

class OrderStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"
    KITCHEN = "kitchen"

# ===================== MODELS =====================

class User(Base):
    """User model for staff management"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default=UserRole.STAFF)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Table(Base):
    """Table management model"""
    __tablename__ = "tables"
    
    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(Integer, unique=True, nullable=False)
    capacity = Column(Integer, default=4)
    status = Column(String(20), default="available")  # available, occupied, reserved, maintenance
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Category(Base):
    """Menu category model"""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MenuItem(Base):
    """Menu item model"""
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price_half = Column(Float, nullable=True)
    price_full = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    subcategory = Column(String(50), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True)
    is_vegetarian = Column(Boolean, default=False)
    has_half_full = Column(Boolean, default=False)
    preparation_time = Column(Integer, default=15)
    calories = Column(Integer, nullable=True)
    spice_level = Column(Integer, default=0)  # 0-5
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    category = relationship("Category")

class Discount(Base):
    """Discount and coupon model"""
    __tablename__ = "discounts"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    discount_type = Column(String(10), nullable=False)  # percentage, fixed
    discount_value = Column(Float, nullable=False)
    min_order_amount = Column(Float, default=0)
    max_discount = Column(Float, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, default=0)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    """Order model"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), unique=True, nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    table_number = Column(Integer, nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(15), nullable=False)
    items_json = Column(JSON, nullable=False)
    subtotal = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0)
    discount_code = Column(String(20), nullable=True)
    tax_amount = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(String(20), default=OrderStatus.PENDING)
    payment_status = Column(String(20), default=PaymentStatus.PENDING)
    payment_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class OrderItem(Base):
    """Individual order items for detailed tracking"""
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    half_full = Column(String(10), nullable=True)
    notes = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AnalyticsEvent(Base):
    """Analytics events for reporting"""
    __tablename__ = "analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)  # order_completed, item_viewed, etc.
    event_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# ===================== SCHEMAS =====================

class UserCreate(BaseModel):
    """Schema for creating user"""
    username: str
    email: str
    password: str
    role: UserRole = UserRole.STAFF

class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class TableCreate(BaseModel):
    """Schema for creating table"""
    table_number: int
    capacity: int = 4
    position_x: int = 0
    position_y: int = 0

class TableResponse(BaseModel):
    """Schema for table response"""
    id: int
    table_number: int
    capacity: int
    status: str
    position_x: int
    position_y: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class CategoryCreate(BaseModel):
    """Schema for creating category"""
    name: str
    description: Optional[str] = None
    display_order: int = 0

class CategoryResponse(BaseModel):
    """Schema for category response"""
    id: int
    name: str
    description: Optional[str]
    display_order: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class MenuItemCreate(BaseModel):
    """Schema for creating menu item"""
    name: str
    description: Optional[str] = None
    price_half: Optional[float] = None
    price_full: Optional[float] = None
    price: Optional[float] = None
    category_id: int
    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    is_vegetarian: bool = False
    has_half_full: bool = False
    preparation_time: int = 15
    calories: Optional[int] = None
    spice_level: int = 0

class MenuItemResponse(BaseModel):
    """Schema for menu item response"""
    id: int
    name: str
    description: Optional[str]
    price_half: Optional[float]
    price_full: Optional[float]
    price: Optional[float]
    category_id: int
    subcategory: Optional[str]
    image_url: Optional[str]
    is_available: bool
    is_vegetarian: bool
    has_half_full: bool
    preparation_time: int
    calories: Optional[int]
    spice_level: int
    
    class Config:
        from_attributes = True

class CartItem(BaseModel):
    """Cart item schema"""
    menu_item_id: int
    name: str
    price: float
    quantity: int = 1
    half_full: Optional[str] = None
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    """Schema for creating order"""
    table_number: int = Field(..., ge=1)
    customer_name: str = Field(..., min_length=1)
    customer_phone: str
    items: List[CartItem]
    discount_code: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('customer_phone')
    def validate_phone(cls, v):
        if len(v) < 10:
            raise ValueError('Phone number must be at least 10 digits')
        return v

class OrderResponse(BaseModel):
    """Schema for order response"""
    id: int
    order_number: str
    table_number: int
    customer_name: str
    customer_phone: str
    items_json: List[Dict]
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    status: str
    payment_status: str
    payment_id: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class OrderListResponse(BaseModel):
    """Schema for order list response"""
    id: int
    order_number: str
    table_number: int
    customer_name: str
    total_amount: float
    status: str
    payment_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DiscountCreate(BaseModel):
    """Schema for creating discount"""
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

class DiscountResponse(BaseModel):
    """Schema for discount response"""
    id: int
    code: str
    name: str
    description: Optional[str]
    discount_type: str
    discount_value: float
    min_order_amount: float
    max_discount: Optional[float]
    usage_limit: Optional[int]
    usage_count: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PaymentVerification(BaseModel):
    """Schema for payment verification"""
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

class OrderStatusUpdate(BaseModel):
    """Schema for updating order status"""
    status: str

class AnalyticsQuery(BaseModel):
    """Schema for analytics query"""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    period: Optional[str] = None  # daily, weekly, monthly

class ExportFormat(BaseModel):
    """Schema for export format"""
    format: str = "csv"  # csv, pdf

# ===================== WEBSOCKET CONNECTION MANAGER =====================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "kitchen": set(),
            "admin": set(),
            "customer": {}
        }
    
    async def connect(self, websocket: WebSocket, client_type: str, identifier: str = None):
        """Accept new WebSocket connection"""
        await websocket.accept()
        if client_type == "kitchen":
            self.active_connections["kitchen"].add(websocket)
        elif client_type == "admin":
            self.active_connections["admin"].add(websocket)
        elif client_type == "customer" and identifier:
            self.active_connections["customer"][identifier] = websocket
    
    def disconnect(self, websocket: WebSocket, client_type: str, identifier: str = None):
        """Remove WebSocket connection"""
        if client_type == "kitchen":
            self.active_connections["kitchen"].discard(websocket)
        elif client_type == "admin":
            self.active_connections["admin"].discard(websocket)
        elif client_type == "customer" and identifier:
            self.active_connections["customer"].pop(identifier, None)
    
    async def broadcast_to_kitchen(self, message: dict):
        """Send message to all kitchen displays"""
        for connection in list(self.active_connections["kitchen"]):
            try:
                await connection.send_json(message)
            except:
                pass
    
    async def broadcast_to_admin(self, message: dict):
        """Send message to all admin panels"""
        for connection in list(self.active_connections["admin"]):
            try:
                await connection.send_json(message)
            except:
                pass
    
    async def broadcast_all(self, message: dict):
        """Send message to all connected clients"""
        await self.broadcast_to_kitchen(message)
        await self.broadcast_to_admin(message)
    
    async def send_to_customer(self, order_id: str, message: dict):
        """Send message to specific customer"""
        if order_id in self.active_connections["customer"]:
            try:
                await self.active_connections["customer"][order_id].send_json(message)
            except:
                pass

manager = ConnectionManager()

# ===================== DATABASE OPERATIONS =====================

async def create_tables():
    """Create all database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncSession:
    """Dependency for database session"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

# ===================== MENU DATA =====================

def get_default_menu():
    """Return default menu items for seeding"""
    return [
        # Soups
        {"name": "Chicken Manchow Soup", "description": "Hot and spicy soup with crispy noodles", "price": 120, "category": "soups", "subcategory": "non-veg", "is_vegetarian": False, "has_half_full": False, "preparation_time": 8},
        {"name": "Chicken Hot & Sour Soup", "description": "Tangy and spicy soup", "price": 120, "category": "soups", "subcategory": "non-veg", "is_vegetarian": False, "has_half_full": False, "preparation_time": 8},
        {"name": "Veg Manchow Soup", "description": "Hot and spicy vegetable soup with noodles", "price": 90, "category": "soups", "subcategory": "veg", "is_vegetarian": True, "has_half_full": False, "preparation_time": 8},
        {"name": "Sweet Corn Soup", "description": "Creamy sweet corn soup", "price": 100, "category": "soups", "subcategory": "veg", "is_vegetarian": True, "has_half_full": False, "preparation_time": 8},
        # Starters
        {"name": "Chicken Lollipop", "description": "Spicy chicken wings on bone", "price_half": 90, "price_full": 170, "category": "starters", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 15},
        {"name": "Chicken 65", "description": "Spicy deep fried chicken", "price_half": 100, "price_full": 190, "category": "starters", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 15},
        {"name": "Veg Crispy", "description": "Crispy fried vegetables", "price_half": 80, "price_full": 150, "category": "starters", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 12},
        {"name": "Paneer 65", "description": "Spicy paneer fry", "price_half": 110, "price_full": 210, "category": "starters", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 15},
        # Main Course
        {"name": "Butter Chicken", "description": "Creamy tomato gravy with tender chicken", "price_half": 200, "price_full": 380, "category": "main_course", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 20},
        {"name": "Chicken Tikka Masala", "description": "Spicy tomato gravy with chicken pieces", "price_half": 210, "price_full": 400, "category": "main_course", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 20},
        {"name": "Paneer Butter Masala", "description": "Creamy paneer in tomato gravy", "price_half": 200, "price_full": 380, "category": "main_course", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 18},
        {"name": "Dal Makhani", "description": "Black lentil creamy gravy", "price": 200, "category": "main_course", "subcategory": "veg", "is_vegetarian": True, "has_half_full": False, "preparation_time": 15},
        # Biryani
        {"name": "Chicken Dum Biryani", "description": "Aromatic basmati rice with tender chicken", "price_half": 180, "price_full": 320, "category": "biryani", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 30},
        {"name": "Mutton Dum Biryani", "description": "Aromatic basmati rice with tender mutton", "price_half": 220, "price_full": 420, "category": "biryani", "subcategory": "mutton", "is_vegetarian": False, "has_half_full": True, "preparation_time": 35},
        {"name": "Veg Biryani", "description": "Aromatic rice with vegetables", "price_half": 140, "price_full": 260, "category": "biryani", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 22},
        # Rice & Noodles
        {"name": "Chicken Fried Rice", "description": "Fried rice with chicken", "price_half": 120, "price_full": 200, "category": "rice_noodles", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 15},
        {"name": "Veg Fried Rice", "description": "Mixed vegetable fried rice", "price_half": 90, "price_full": 150, "category": "rice_noodles", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 12},
        {"name": "Chicken Hakka Noodles", "description": "Stir fried noodles with chicken", "price_half": 120, "price_full": 200, "category": "rice_noodles", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": True, "preparation_time": 15},
        {"name": "Veg Hakka Noodles", "description": "Stir fried vegetables with noodles", "price_half": 90, "price_full": 150, "category": "rice_noodles", "subcategory": "veg", "is_vegetarian": True, "has_half_full": True, "preparation_time": 12},
        # Rolls
        {"name": "Paneer Roll", "description": "Soft roti with paneer filling", "price": 80, "category": "rolls", "subcategory": "paneer", "is_vegetarian": True, "has_half_full": False, "preparation_time": 8},
        {"name": "Chicken Roll", "description": "Soft roti with chicken filling", "price": 90, "category": "rolls", "subcategory": "chicken", "is_vegetarian": False, "has_half_full": False, "preparation_time": 8},
        {"name": "Egg Roll", "description": "Roti with egg filling", "price": 60, "category": "rolls", "subcategory": "egg", "is_vegetarian": False, "has_half_full": False, "preparation_time": 6},
        # Breads
        {"name": "Plain Roti", "description": "Soft Indian bread", "price": 15, "category": "breads", "subcategory": "roti", "is_vegetarian": True, "has_half_full": False, "preparation_time": 5},
        {"name": "Butter Naan", "description": "Butter naan", "price": 50, "category": "breads", "subcategory": "naan", "is_vegetarian": True, "has_half_full": False, "preparation_time": 6},
        {"name": "Aloo Paratha", "description": "Stuffed potato paratha", "price": 70, "category": "breads", "subcategory": "paratha", "is_vegetarian": True, "has_half_full": False, "preparation_time": 10},
        # Beverages
        {"name": "Tea (Regular)", "description": "Indian masala tea", "price": 25, "category": "beverages", "subcategory": "tea", "is_vegetarian": True, "has_half_full": False, "preparation_time": 5},
        {"name": "Coffee (Regular)", "description": "South Indian coffee", "price": 35, "category": "beverages", "subcategory": "coffee", "is_vegetarian": True, "has_half_full": False, "preparation_time": 5},
        {"name": "Cold Drink (250ml)", "description": "Soft drink", "price": 30, "category": "beverages", "subcategory": "cold_drink", "is_vegetarian": True, "has_half_full": False, "preparation_time": 2},
        {"name": "Mineral Water (500ml)", "description": "Packaged drinking water", "price": 20, "category": "beverages", "subcategory": "water", "is_vegetarian": True, "has_half_full": False, "preparation_time": 2},
    ]

# ===================== API ROUTES =====================

app = FastAPI(
    title="Delicacy Restaurant API",
    description="Production-ready QR-based restaurant management system",
    version="2.0.0"
)

# CORS middleware - Allow all origins for development
# For production, set specific origins in FRONTEND_URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static folder for QR codes
os.makedirs("backend/static", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

# ===================== HEALTH CHECK =====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ===================== CATEGORY APIs =====================

@app.get("/api/categories", response_model=List[CategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get all active categories"""
    result = await db.execute(
        select(Category).where(Category.is_active == True).order_by(Category.display_order)
    )
    return result.scalars().all()

@app.post("/api/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """Create new category"""
    db_category = Category(**category.dict())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

@app.put("/api/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: int, category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """Update category"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for key, value in category.dict().items():
        setattr(db_category, key, value)
    
    await db.commit()
    await db.refresh(db_category)
    return db_category

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """Delete category (soft delete by setting is_active=False)"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_category.is_active = False
    await db.commit()
    return {"message": "Category deleted"}

# ===================== MENU APIs =====================

@app.get("/api/menu", response_model=List[MenuItemResponse])
async def get_menu(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    is_vegetarian: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all menu items with optional filters"""
    query = select(MenuItem).where(MenuItem.is_available == True)
    
    if category and category != 'undefined':
        # Try to filter by category_id first (if numeric)
        try:
            category_id = int(category)
            query = query.where(MenuItem.category_id == category_id)
        except ValueError:
            # If not numeric, filter by category name (join with categories table)
            cat_result = await db.execute(select(Category).where(Category.name == category))
            cat = cat_result.scalar_one_or_none()
            if cat:
                query = query.where(MenuItem.category_id == cat.id)
            else:
                # If category not found, return empty list
                return []
    
    if subcategory and subcategory != 'undefined':
        query = query.where(MenuItem.subcategory == subcategory)
    if is_vegetarian is not None:
        query = query.where(MenuItem.is_vegetarian == is_vegetarian)
    if search:
        query = query.where(MenuItem.name.contains(search))
    
    result = await db.execute(query)
    items = result.scalars().all()
    return items

@app.get("/api/menu/{item_id}", response_model=MenuItemResponse)
async def get_menu_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Get single menu item"""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item

@app.post("/api/menu", response_model=MenuItemResponse)
async def create_menu_item(item: MenuItemCreate, db: AsyncSession = Depends(get_db)):
    """Create new menu item"""
    db_item = MenuItem(**item.dict())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

@app.put("/api/menu/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: int, item: MenuItemCreate, db: AsyncSession = Depends(get_db)):
    """Update menu item"""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalar_one_or_none()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    for key, value in item.dict().items():
        setattr(db_item, key, value)
    db_item.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_item)
    return db_item

@app.delete("/api/menu/{item_id}")
async def delete_menu_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Delete menu item"""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalar_one_or_none()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await db.delete(db_item)
    await db.commit()
    return {"message": "Menu item deleted"}

@app.put("/api/menu/{item_id}/toggle-availability")
async def toggle_availability(item_id: int, db: AsyncSession = Depends(get_db)):
    """Toggle menu item availability"""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalar_one_or_none()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    db_item.is_available = not db_item.is_available
    await db.commit()
    return {"message": "Availability updated", "is_available": db_item.is_available}

# ===================== SINGLE MENU SEED ENDPOINT =====================

@app.post("/api/menu/seed")
async def seed_menu(db: AsyncSession = Depends(get_db)):
    """
    Seed default menu items. Use 'force=true' query parameter to replace existing items.
    This is the single source of truth for menu seeding.
    """
    from sqlalchemy import func, text
    
    # Check existing items
    result = await db.execute(select(func.count()).select_from(MenuItem))
    existing_count = result.scalar_one()
    
    force = False  # Default: don't force, only seed if empty
    
    if existing_count == 0:
        # Seed menu if empty
        menu_items_data = get_default_menu()
        
        for item_data in menu_items_data:
            # Find category
            cat_name = item_data.pop("category", "default")
            cat_result = await db.execute(select(Category).where(Category.name == cat_name))
            category = cat_result.scalar_one_or_none()
            
            if not category:
                category = Category(name=cat_name)
                db.add(category)
                await db.commit()
                await db.refresh(category)
            
            item_data["category_id"] = category.id
            db_item = MenuItem(**item_data)
            db.add(db_item)
        
        await db.commit()
        return {"message": f"Menu seeded successfully with {len(menu_items_data)} items", "items_count": len(menu_items_data)}
    else:
        return {
            "message": f"Menu already has {existing_count} items. Use ?force=true to reset.",
            "items_count": existing_count,
            "hint": "Call /api/menu/seed?force=true to reset menu"
        }

@app.post("/api/menu/reset")
async def reset_menu(db: AsyncSession = Depends(get_db)):
    """Force reset menu - deletes all items and categories and reseeds"""
    from sqlalchemy import text
    
    # Delete existing menu items
    await db.execute(text("DELETE FROM menu_items"))
    await db.commit()
    
    # Delete existing categories
    await db.execute(text("DELETE FROM categories"))
    await db.commit()
    
    # Seed fresh menu
    menu_items_data = get_default_menu()
    
    for item_data in menu_items_data:
        cat_name = item_data.pop("category", "default")
        
        # Create category
        cat_result = await db.execute(select(Category).where(Category.name == cat_name))
        category = cat_result.scalar_one_or_none()
        
        if not category:
            category = Category(name=cat_name)
            db.add(category)
            await db.commit()
            await db.refresh(category)
        
        item_data["category_id"] = category.id
        db_item = MenuItem(**item_data)
        db.add(db_item)
    
    await db.commit()
    return {"message": f"Menu reset successfully with {len(menu_items_data)} items", "items_count": len(menu_items_data)}

# ===================== TABLE APIs =====================

@app.get("/api/tables", response_model=List[TableResponse])
async def get_tables(db: AsyncSession = Depends(get_db)):
    """Get all tables"""
    result = await db.execute(select(Table))
    return result.scalars().all()

@app.post("/api/tables", response_model=TableResponse)
async def create_table(table: TableCreate, db: AsyncSession = Depends(get_db)):
    """Create new table"""
    # Check if table number already exists
    result = await db.execute(select(Table).where(Table.table_number == table.table_number))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Table number already exists")
    
    db_table = Table(**table.dict())
    db.add(db_table)
    await db.commit()
    await db.refresh(db_table)
    return db_table

@app.put("/api/tables/{table_id}", response_model=TableResponse)
async def update_table(table_id: int, table: TableCreate, db: AsyncSession = Depends(get_db)):
    """Update table"""
    result = await db.execute(select(Table).where(Table.id == table_id))
    db_table = result.scalar_one_or_none()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    for key, value in table.dict().items():
        setattr(db_table, key, value)
    
    await db.commit()
    await db.refresh(db_table)
    return db_table

@app.put("/api/tables/{table_id}/status")
async def update_table_status(table_id: int, status: str, db: AsyncSession = Depends(get_db)):
    """Update table status"""
    valid_statuses = ["available", "occupied", "reserved", "maintenance"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.execute(select(Table).where(Table.id == table_id))
    db_table = result.scalar_one_or_none()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    db_table.status = status
    await db.commit()
    return {"message": "Table status updated", "status": status}

@app.delete("/api/tables/{table_id}")
async def delete_table(table_id: int, db: AsyncSession = Depends(get_db)):
    """Delete table"""
    result = await db.execute(select(Table).where(Table.id == table_id))
    db_table = result.scalar_one_or_none()
    if not db_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await db.delete(db_table)
    await db.commit()
    return {"message": "Table deleted"}

# ===================== DISCOUNT APIs =====================

@app.get("/api/discounts", response_model=List[DiscountResponse])
async def get_discounts(db: AsyncSession = Depends(get_db)):
    """Get all active discounts"""
    result = await db.execute(select(Discount).where(Discount.is_active == True))
    return result.scalars().all()

@app.post("/api/discounts", response_model=DiscountResponse)
async def create_discount(discount: DiscountCreate, db: AsyncSession = Depends(get_db)):
    """Create new discount"""
    # Check if code already exists
    result = await db.execute(select(Discount).where(Discount.code == discount.code))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    db_discount = Discount(**discount.dict())
    db.add(db_discount)
    await db.commit()
    await db.refresh(db_discount)
    return db_discount

@app.post("/api/discounts/validate")
async def validate_discount(code: str, order_amount: float, db: AsyncSession = Depends(get_db)):
    """Validate discount code"""
    result = await db.execute(select(Discount).where(Discount.code == code))
    discount = result.scalar_one_or_none()
    
    if not discount or not discount.is_active:
        raise HTTPException(status_code=404, detail="Invalid or expired discount code")
    
    if discount.valid_until and discount.valid_until < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Discount code has expired")
    
    if discount.usage_limit and discount.usage_count >= discount.usage_limit:
        raise HTTPException(status_code=400, detail="Discount code usage limit reached")
    
    if order_amount < discount.min_order_amount:
        raise HTTPException(status_code=400, detail=f"Minimum order amount ${discount.min_order_amount} required")
    
    # Calculate discount
    if discount.discount_type == "percentage":
        discount_amount = min(
            order_amount * (discount.discount_value / 100),
            discount.max_discount or float('inf')
        )
    else:
        discount_amount = discount.discount_value
    
    return {
        "valid": True,
        "code": discount.code,
        "name": discount.name,
        "discount_amount": round(discount_amount, 2)
    }

@app.delete("/api/discounts/{discount_id}")
async def delete_discount(discount_id: int, db: AsyncSession = Depends(get_db)):
    """Delete discount"""
    result = await db.execute(select(Discount).where(Discount.id == discount_id))
    db_discount = result.scalar_one_or_none()
    if not db_discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    db_discount.is_active = False
    await db.commit()
    return {"message": "Discount deleted"}

# ===================== ORDER APIs =====================

@app.post("/api/orders", response_model=Dict)
async def create_order(order: OrderCreate, db: AsyncSession = Depends(get_db)):
    """Create new order"""
    # Calculate subtotal
    subtotal = 0
    items_data = []
    for item in order.items:
        subtotal += item.price * item.quantity
        items_data.append({
            "menu_item_id": item.menu_item_id,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "half_full": item.half_full,
            "notes": item.notes
        })
    
    # Validate and apply discount
    discount_amount = 0
    discount_code = None
    if order.discount_code:
        result = await db.execute(select(Discount).where(Discount.code == order.discount_code))
        discount = result.scalar_one_or_none()
        
        if discount and discount.is_active:
            if subtotal >= discount.min_order_amount:
                if discount.discount_type == "percentage":
                    discount_amount = min(
                        subtotal * (discount.discount_value / 100),
                        discount.max_discount or float('inf')
                    )
                else:
                    discount_amount = discount.discount_value
                discount_code = order.discount_code
                discount.usage_count += 1
    
    # Calculate tax and total
    taxable_amount = subtotal - discount_amount
    tax_amount = round(taxable_amount * (GST_RATE / 100), 2)
    total_amount = round(taxable_amount + tax_amount, 2)
    
    # Generate order number
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    order_number = f"ORD{timestamp}{order.table_number}"
    
    # Create order
    db_order = Order(
        order_number=order_number,
        table_number=order.table_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        items_json=items_data,
        subtotal=subtotal,
        discount_amount=discount_amount,
        discount_code=discount_code,
        tax_amount=tax_amount,
        total_amount=total_amount,
        notes=order.notes
    )
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)
    
    # Notify kitchen and admin
    await manager.broadcast_all({
        "type": "new_order",
        "order": {
            "id": db_order.id,
            "order_number": db_order.order_number,
            "table_number": db_order.table_number,
            "customer_name": db_order.customer_name,
            "items": items_data,
            "total_amount": total_amount,
            "status": db_order.status,
            "notes": order.notes,
            "created_at": db_order.created_at.isoformat()
        }
    })
    
    return {
        "order_id": db_order.id,
        "order_number": db_order.order_number,
        "total_amount": total_amount,
        "message": "Order created successfully"
    }

@app.get("/api/orders", response_model=List[OrderListResponse])
async def get_orders(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    table_number: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get orders with filters"""
    query = select(Order)
    
    if status:
        query = query.where(Order.status == status)
    if payment_status:
        query = query.where(Order.payment_status == payment_status)
    if table_number:
        query = query.where(Order.table_number == table_number)
    if search:
        query = query.where(Order.order_number.contains(search))
    
    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@app.get("/api/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Get order by ID"""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.get("/api/orders/number/{order_number}", response_model=OrderResponse)
async def get_order_by_number(order_number: str, db: AsyncSession = Depends(get_db)):
    """Get order by order number"""
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int, 
    status_update: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update order status"""
    valid_statuses = [s.value for s in OrderStatus]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_update.status
    if status_update.status == OrderStatus.COMPLETED.value:
        order.completed_at = datetime.utcnow()
    
    await db.commit()
    
    # Notify all connected clients
    await manager.broadcast_all({
        "type": "order_updated",
        "order_id": order_id,
        "status": status_update.status,
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "table_number": order.table_number,
            "status": order.status,
            "payment_status": order.payment_status
        }
    })
    
    return {"message": "Order status updated", "status": status_update.status}

# ===================== KITCHEN APIs =====================

@app.get("/api/kitchen/orders")
async def get_kitchen_orders(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all orders for kitchen display"""
    query = select(Order).distinct().order_by(Order.created_at.desc())
    if status:
        query = query.where(Order.status == status)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    kitchen_orders = []
    for order in orders:
        kitchen_orders.append({
            "id": order.id,
            "order_number": order.order_number,
            "table_number": order.table_number,
            "customer_name": order.customer_name,
            "items": order.items_json,
            "total_amount": order.total_amount,
            "status": order.status,
            "payment_status": order.payment_status,
            "notes": order.notes,
            "created_at": order.created_at.isoformat(),
            "time_elapsed": int((datetime.utcnow() - order.created_at).total_seconds() / 60)
        })
    
    return kitchen_orders

@app.get("/api/kitchen/stats")
async def get_kitchen_stats(db: AsyncSession = Depends(get_db)):
    """Get kitchen statistics"""
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    result = await db.execute(
        select(Order).where(Order.created_at >= today_start)
    )
    today_orders = result.scalars().all()
    
    pending = sum(1 for o in today_orders if o.status in ["pending", "accepted"])
    preparing = sum(1 for o in today_orders if o.status == "preparing")
    ready = sum(1 for o in today_orders if o.status == "ready")
    completed = sum(1 for o in today_orders if o.status == "completed")
    total_revenue = sum(o.total_amount for o in today_orders if o.payment_status == "paid")
    
    return {
        "pending_orders": pending,
        "preparing_orders": preparing,
        "ready_orders": ready,
        "completed_today": completed,
        "total_revenue_today": total_revenue
    }

# ===================== PAYMENT APIs =====================

@app.post("/api/payment/create-order")
async def create_payment_order(order_data: Dict, db: AsyncSession = Depends(get_db)):
    """Create Razorpay order for payment"""
    order_id = order_data.get("order_id")
    amount = order_data.get("amount")
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": int(amount * 100),
            "currency": "HKD",
            "receipt": order.order_number,
            "notes": {
                "table_number": order.table_number,
                "customer_name": order.customer_name
            }
        })
        
        return {
            "order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment creation failed: {str(e)}")

@app.post("/api/payment/verify")
async def verify_payment(
    payment: PaymentVerification,
    db: AsyncSession = Depends(get_db)
):
    """Verify Razorpay payment signature"""
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_payment_id": payment.razorpay_payment_id,
            "razorpay_order_id": payment.razorpay_order_id,
            "razorpay_signature": payment.razorpay_signature
        })
        
        # Find order by Razorpay order ID stored in receipt field
        # receipt contains the order_number
        razorpay_order = razorpay_client.order.fetch(payment.razorpay_order_id)
        receipt = razorpay_order.get("receipt", "")
        
        # Try to find order by order_number containing the receipt
        result = await db.execute(
            select(Order).where(Order.order_number == receipt)
        )
        order = result.scalar_one_or_none()
        
        # If not found by exact match, try partial match
        if not order:
            result = await db.execute(
                select(Order).where(Order.order_number.contains(receipt[-8:]))
            )
            order = result.scalar_one_or_none()
        
        if order:
            order.payment_status = "paid"
            order.payment_id = payment.razorpay_payment_id
            # Don't auto-accept order - let kitchen staff verify and accept
            await db.commit()
            
            await manager.broadcast_all({
                "type": "payment_completed",
                "order_id": order.id,
                "payment_id": payment.razorpay_payment_id,
                "order": {
                    "id": order.id,
                    "order_number": order.order_number,
                    "status": order.status,
                    "payment_status": order.payment_status
                }
            })
        
        return {"message": "Payment verified successfully", "status": "success"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===================== ADMIN APIs =====================

@app.get("/api/admin/stats")
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    """Get real-time admin statistics"""
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    # Today's orders
    result = await db.execute(
        select(Order).where(Order.created_at >= today_start)
    )
    today_orders = result.scalars().all()
    
    today_revenue = sum(o.total_amount for o in today_orders if o.payment_status == "paid")
    today_orders_count = sum(1 for o in today_orders if o.payment_status == "paid")
    pending_orders = sum(1 for o in today_orders if o.status == "pending")
    preparing_orders = sum(1 for o in today_orders if o.status == "preparing")
    
    # This month
    month_start = today.replace(day=1)
    month_result = await db.execute(
        select(Order).where(Order.created_at >= month_start)
    )
    month_orders = month_result.scalars().all()
    month_revenue = sum(o.total_amount for o in month_orders if o.payment_status == "paid")
    
    # All time stats
    all_orders = await db.execute(select(Order))
    all_orders_list = all_orders.scalars().all()
    all_time_revenue = sum(o.total_amount for o in all_orders_list if o.payment_status == "paid")
    all_time_orders = sum(1 for o in all_orders_list if o.payment_status == "paid")
    
    # Menu items count
    menu_count = await db.execute(select(func.count()).select_from(MenuItem))
    menu_items_count = menu_count.scalar_one()
    
    return {
        "today_revenue": today_revenue,
        "today_orders": today_orders_count,
        "pending_orders": pending_orders,
        "preparing_orders": preparing_orders,
        "month_revenue": month_revenue,
        "all_time_revenue": all_time_revenue,
        "all_time_orders": all_time_orders,
        "menu_items_count": menu_items_count
    }

@app.get("/api/admin/sales")
async def get_sales_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get sales report"""
    query = select(Order).where(Order.payment_status == "paid")
    
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.where(Order.created_at >= start)
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d")
        query = query.where(Order.created_at <= end)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    total_revenue = sum(order.total_amount for order in orders)
    total_orders = len(orders)
    
    # Daily breakdown
    daily_sales = {}
    for order in orders:
        date_key = order.created_at.strftime("%Y-%m-%d")
        if date_key not in daily_sales:
            daily_sales[date_key] = {"orders": 0, "revenue": 0}
        daily_sales[date_key]["orders"] += 1
        daily_sales[date_key]["revenue"] += order.total_amount
    
    # Item breakdown
    item_counts = {}
    for order in orders:
        for item in order.items_json:
            name = item["name"]
            if name in item_counts:
                item_counts[name]["quantity"] += item["quantity"]
                item_counts[name]["revenue"] += item["price"] * item["quantity"]
            else:
                item_counts[name] = {
                    "quantity": item["quantity"],
                    "revenue": item["price"] * item["quantity"]
                }
    
    # Category breakdown
    category_sales = {}
    # This requires joining with menu items, simplified version:
    category_items = await db.execute(select(MenuItem))
    category_map = {item.id: item.category_id for item in category_items.scalars().all()}
    
    for order in orders:
        for item in order.items_json:
            cat_id = category_map.get(item["menu_item_id"], "unknown")
            if cat_id not in category_sales:
                category_sales[cat_id] = {"orders": 0, "revenue": 0}
            category_sales[cat_id]["revenue"] += item["price"] * item["quantity"]
    
    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "daily_sales": daily_sales,
        "items_sold": dict(sorted(item_counts.items(), key=lambda x: x[1]["revenue"], reverse=True)),
        "category_sales": category_sales
    }

@app.get("/api/admin/analytics")
async def get_analytics(
    period: str = Query(default="daily", regex="^(daily|weekly|monthly)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get analytics data for charts"""
    if period == "daily":
        days = 7
        date_format = "%Y-%m-%d"
    elif period == "weekly":
        days = 28
        date_format = "%Y-%m-%d"
    else:
        days = 90
        date_format = "%Y-%m"
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(Order).where(
            Order.created_at >= start_date,
            Order.payment_status == "paid"
        )
    )
    orders = result.scalars().all()
    
    # Group by period
    period_data = {}
    for order in orders:
        if period == "monthly":
            key = order.created_at.strftime("%Y-%m")
        else:
            key = order.created_at.strftime(date_format)
        
        if key not in period_data:
            period_data[key] = {"orders": 0, "revenue": 0}
        period_data[key]["orders"] += 1
        period_data[key]["revenue"] += order.total_amount
    
    # Top items
    item_counts = {}
    for order in orders:
        for item in order.items_json:
            name = item["name"]
            if name in item_counts:
                item_counts[name] += item["quantity"]
            else:
                item_counts[name] = item["quantity"]
    
    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "period": period,
        "period_data": period_data,
        "top_items": top_items,
        "total_revenue": sum(o.total_amount for o in orders),
        "total_orders": len(orders)
    }

@app.get("/api/admin/export")
async def export_data(
    format: str = Query(default="csv", regex="^(csv)$"),
    db: AsyncSession = Depends(get_db)
):
    """Export sales data"""
    result = await db.execute(select(Order).where(Order.payment_status == "paid"))
    orders = result.scalars().all()
    
    # Create CSV
    output = csv_io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Order ID", "Order Number", "Table", "Customer", "Phone", 
                     "Items", "Subtotal", "Discount", "Tax", "Total", 
                     "Status", "Payment Status", "Created At", "Completed At"])
    
    # Data
    for order in orders:
        items_str = ", ".join([f"{item['name']} x{item['quantity']}" for item in order.items_json])
        writer.writerow([
            order.id,
            order.order_number,
            order.table_number,
            order.customer_name,
            order.customer_phone,
            items_str,
            order.subtotal,
            order.discount_amount,
            order.tax_amount,
            order.total_amount,
            order.status,
            order.payment_status,
            order.created_at,
            order.completed_at or ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sales_report_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

# ===================== QR CODE GENERATION =====================

@app.get("/api/admin/generate-qr/{table_number}")
async def generate_qr_code(table_number: int):
    """Generate QR code for table"""
    # Validate table number
    if table_number < 1:
        raise HTTPException(status_code=400, detail="Table number must be at least 1")
    
    # Get max tables from environment or use default
    max_tables = int(os.getenv("MAX_TABLES", "20"))
    if table_number > max_tables:
        raise HTTPException(status_code=400, detail=f"Table number exceeds maximum of {max_tables}")
    
    url = f"{FRONTEND_URL}/table/{table_number}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to file
    filename = f"backend/static/qr_table_{table_number}.png"
    img.save(filename)
    
    return FileResponse(filename, media_type="image/png")

@app.get("/api/admin/generate-all-qr")
async def generate_all_qr_codes(max_tables: int = Query(default=20, le=50)):
    """Generate QR codes for all tables"""
    max_tables = min(max_tables, int(os.getenv("MAX_TABLES", "20")))
    
    for table in range(1, max_tables + 1):
        url = f"{FRONTEND_URL}/table/{table}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        filename = f"backend/static/qr_table_{table}.png"
        img.save(filename)
    
    return {"message": f"QR codes generated for tables 1-{max_tables}", "count": max_tables}

# ===================== ORDER STATUS PAGE API =====================

@app.get("/api/order/track/{order_number}")
async def track_order(order_number: str, db: AsyncSession = Depends(get_db)):
    """Track order status"""
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    time_elapsed = int((datetime.utcnow() - order.created_at).total_seconds() / 60)
    
    return {
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "table_number": order.table_number,
            "items": order.items_json,
            "total_amount": order.total_amount,
            "status": order.status,
            "payment_status": order.payment_status,
            "created_at": order.created_at.isoformat(),
            "time_elapsed": time_elapsed
        },
        "status_history": [
            {"status": "pending", "label": "Order Placed", "completed": True},
            {"status": "accepted", "label": "Confirmed", "completed": order.status in ["accepted", "preparing", "ready", "completed"]},
            {"status": "preparing", "label": "Preparing", "completed": order.status in ["preparing", "ready", "completed"]},
            {"status": "ready", "label": "Ready", "completed": order.status in ["ready", "completed"]},
            {"status": "completed", "label": "Delivered", "completed": order.status == "completed"}
        ]
    }

@app.get("/api/order/bill/{order_number}")
async def generate_bill(order_number: str, db: AsyncSession = Depends(get_db)):
    """Generate bill details for order"""
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    bill_data = {
        "restaurant_name": "Delicacy Restaurant",
        "order_number": order.order_number,
        "table_number": order.table_number,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "date": order.created_at.strftime("%d/%m/%Y %H:%M"),
        "items": order.items_json,
        "subtotal": order.subtotal,
        "discount": order.discount_amount,
        "gst_rate": GST_RATE,
        "gst": order.tax_amount,
        "total": order.total_amount,
        "payment_status": order.payment_status,
        "payment_id": order.payment_id
    }
    
    return bill_data

# ===================== WEBSOCKET ENDPOINT =====================

@app.websocket("/ws/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str, identifier: str = None):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket, client_type, identifier)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_type, identifier)

# ===================== STATIC FILES SERVING =====================

frontend_path = Path("frontend/dist")
if frontend_path.exists():
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")

# ===================== STARTUP EVENT =====================

@app.on_event("startup")
async def startup_event():
    """Initialize database and seed default menu on startup"""
    await create_tables()
    
    async with async_session_maker() as session:
        from sqlalchemy import func
        result = await session.execute(select(func.count()).select_from(MenuItem))
        menu_count = result.scalar_one()
        
        if menu_count == 0:
            # First time setup - seed menu
            menu_items = get_default_menu()
            
            # Get or create default category
            cat_result = await session.execute(select(Category).where(Category.name == "default"))
            default_cat = cat_result.scalar_one_or_none()
            
            if not default_cat:
                default_cat = Category(name="default", display_order=0)
                session.add(default_cat)
                await session.commit()
                await session.refresh(default_cat)
            
            for item_data in menu_items:
                item_data_copy = item_data.copy()
                cat_name = item_data_copy.pop("category", "default")
                
                # Create category if needed
                cat_check = await session.execute(select(Category).where(Category.name == cat_name))
                cat = cat_check.scalar_one_or_none()
                
                if not cat:
                    cat = Category(name=cat_name)
                    session.add(cat)
                    await session.commit()
                    await session.refresh(cat)
                
                item_data_copy["category_id"] = cat.id
                session.add(MenuItem(**item_data_copy))
            
            await session.commit()
            print(f"Auto-seeded {len(menu_items)} menu items on first startup!")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
