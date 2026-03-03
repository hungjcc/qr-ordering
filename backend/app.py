"""
熊熊冰室 - Production-Ready Restaurant Management System Backend
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
HK_UTC_OFFSET_HOURS = int(os.getenv("HK_UTC_OFFSET_HOURS", "8"))
COMBO_LUNCH_DISCOUNT_PCT = float(os.getenv("COMBO_LUNCH_DISCOUNT_PCT", "10"))
COMBO_DINNER_SURCHARGE_PCT = float(os.getenv("COMBO_DINNER_SURCHARGE_PCT", "10"))
COMBO_ICED_DRINK_SURCHARGE = float(os.getenv("COMBO_ICED_DRINK_SURCHARGE", "3"))

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

class PricingSettings(Base):
    """Time-based combo pricing settings"""
    __tablename__ = "pricing_settings"

    id = Column(Integer, primary_key=True, index=True)
    lunch_start = Column(String(5), default="11:00")
    lunch_end = Column(String(5), default="15:00")
    lunch_discount_pct = Column(Float, default=10)
    dinner_start = Column(String(5), default="18:00")
    dinner_end = Column(String(5), default="22:00")
    dinner_surcharge_pct = Column(Float, default=10)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    is_combo: bool = False
    pricing_note: Optional[str] = None
    meal_period: Optional[str] = None
    
    class Config:
        from_attributes = True

class CartItem(BaseModel):
    """Cart item schema"""
    menu_item_id: int
    name: str
    price: float
    quantity: int = 1
    half_full: Optional[str] = None
    linked_drink_item_id: Optional[int] = None
    drink_temp: Optional[str] = None
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
        raw = (v or "").strip()
        digits = ''.join(ch for ch in raw if ch.isdigit())

        if digits.startswith('852') and len(digits) == 11:
            local = digits[3:]
        elif len(digits) == 8:
            local = digits
        else:
            raise ValueError('Invalid HK phone number. Use 8-digit mobile, optional +852 prefix.')

        if local[0] not in {'5', '6', '9'}:
            raise ValueError('Invalid HK mobile number. Must start with 5, 6, or 9.')

        return local

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

class PricingSettingsResponse(BaseModel):
    id: int
    lunch_start: str
    lunch_end: str
    lunch_discount_pct: float
    dinner_start: str
    dinner_end: str
    dinner_surcharge_pct: float
    updated_at: datetime

    class Config:
        from_attributes = True

class PricingSettingsUpdate(BaseModel):
    lunch_start: str
    lunch_end: str
    lunch_discount_pct: float
    dinner_start: str
    dinner_end: str
    dinner_surcharge_pct: float

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


def get_hk_now() -> datetime:
    return datetime.utcnow() + timedelta(hours=HK_UTC_OFFSET_HOURS)


def default_pricing_settings() -> Dict:
    return {
        "lunch_start": "11:00",
        "lunch_end": "15:00",
        "lunch_discount_pct": COMBO_LUNCH_DISCOUNT_PCT,
        "dinner_start": "18:00",
        "dinner_end": "22:00",
        "dinner_surcharge_pct": COMBO_DINNER_SURCHARGE_PCT,
    }


def time_to_minutes(hhmm: str, fallback: str) -> int:
    try:
        value = hhmm or fallback
        hour_str, minute_str = value.split(":")
        hour = int(hour_str)
        minute = int(minute_str)
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return hour * 60 + minute
    except Exception:
        pass
    fb_hour, fb_minute = map(int, fallback.split(":"))
    return fb_hour * 60 + fb_minute


def is_in_window(now_minutes: int, start_minutes: int, end_minutes: int) -> bool:
    if start_minutes <= end_minutes:
        return start_minutes <= now_minutes < end_minutes
    return now_minutes >= start_minutes or now_minutes < end_minutes


def get_meal_period(current_time: datetime, settings: Dict) -> str:
    now_minutes = current_time.hour * 60 + current_time.minute
    lunch_start = time_to_minutes(settings.get("lunch_start", "11:00"), "11:00")
    lunch_end = time_to_minutes(settings.get("lunch_end", "15:00"), "15:00")
    dinner_start = time_to_minutes(settings.get("dinner_start", "18:00"), "18:00")
    dinner_end = time_to_minutes(settings.get("dinner_end", "22:00"), "22:00")

    if is_in_window(now_minutes, lunch_start, lunch_end):
        return "lunch"
    if is_in_window(now_minutes, dinner_start, dinner_end):
        return "dinner"
    return "regular"


def apply_combo_time_pricing(base_price: float, settings: Dict, current_time: Optional[datetime] = None):
    now = current_time or get_hk_now()
    period = get_meal_period(now, settings)
    lunch_discount = float(settings.get("lunch_discount_pct", COMBO_LUNCH_DISCOUNT_PCT))
    dinner_surcharge = float(settings.get("dinner_surcharge_pct", COMBO_DINNER_SURCHARGE_PCT))

    if period == "lunch":
        return round(base_price * (1 - lunch_discount / 100), 2), period
    if period == "dinner":
        return round(base_price * (1 + dinner_surcharge / 100), 2), period
    return round(base_price, 2), period


def get_pricing_note(period: str, settings: Dict) -> Optional[str]:
    lunch_discount = float(settings.get("lunch_discount_pct", COMBO_LUNCH_DISCOUNT_PCT))
    dinner_surcharge = float(settings.get("dinner_surcharge_pct", COMBO_DINNER_SURCHARGE_PCT))
    if period == "lunch":
        return f"午市優惠 -{int(lunch_discount)}%"
    if period == "dinner":
        return f"晚市加幅 +{int(dinner_surcharge)}%"
    return None


async def get_or_create_pricing_settings(db: AsyncSession) -> PricingSettings:
    result = await db.execute(select(PricingSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    defaults = default_pricing_settings()
    settings = PricingSettings(**defaults)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


def pricing_settings_to_dict(settings: PricingSettings) -> Dict:
    return {
        "lunch_start": settings.lunch_start,
        "lunch_end": settings.lunch_end,
        "lunch_discount_pct": settings.lunch_discount_pct,
        "dinner_start": settings.dinner_start,
        "dinner_end": settings.dinner_end,
        "dinner_surcharge_pct": settings.dinner_surcharge_pct,
    }

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
        {"name": "羅宋湯", "description": "經典港式蕃茄牛肉蔬菜湯", "price": 38, "category": "soups", "subcategory": "湯品", "is_vegetarian": False, "has_half_full": False, "preparation_time": 8},
        {"name": "忌廉蘑菇湯", "description": "香濃忌廉配蘑菇", "price": 36, "category": "soups", "subcategory": "湯品", "is_vegetarian": True, "has_half_full": False, "preparation_time": 8},
        {"name": "粟米魚柳羹", "description": "粟米濃湯配嫩滑魚柳", "price": 42, "category": "soups", "subcategory": "湯品", "is_vegetarian": False, "has_half_full": False, "preparation_time": 10},
        {"name": "皮蛋瘦肉粥", "description": "綿滑白粥配皮蛋及瘦肉", "price": 40, "category": "soups", "subcategory": "粥品", "is_vegetarian": False, "has_half_full": False, "preparation_time": 10},
        # Starters
        {"name": "咖哩魚蛋", "description": "街頭風味彈牙魚蛋", "price_half": 28, "price_full": 45, "category": "starters", "subcategory": "小食", "is_vegetarian": False, "has_half_full": True, "preparation_time": 8},
        {"name": "炸雲吞", "description": "酥脆炸雲吞配甜酸醬", "price_half": 32, "price_full": 52, "category": "starters", "subcategory": "小食", "is_vegetarian": False, "has_half_full": True, "preparation_time": 10},
        {"name": "黃金雞翼", "description": "香脆惹味雞中翼", "price_half": 38, "price_full": 62, "category": "starters", "subcategory": "小食", "is_vegetarian": False, "has_half_full": True, "preparation_time": 12},
        {"name": "椒鹽豆腐", "description": "外脆內嫩豆腐粒", "price_half": 30, "price_full": 48, "category": "starters", "subcategory": "小食", "is_vegetarian": True, "has_half_full": True, "preparation_time": 10},
        # Main Course
        {"name": "黑椒牛柳意粉", "description": "香濃黑椒汁配牛柳", "price_half": 48, "price_full": 78, "category": "main_course", "subcategory": "主食", "is_vegetarian": False, "has_half_full": True, "preparation_time": 15},
        {"name": "葡汁焗雞飯", "description": "葡國咖哩汁焗雞扒飯", "price_half": 50, "price_full": 82, "category": "main_course", "subcategory": "主食", "is_vegetarian": False, "has_half_full": True, "preparation_time": 18},
        {"name": "西多士", "description": "港式花生醬西多士", "price": 34, "category": "main_course", "subcategory": "主食", "is_vegetarian": True, "has_half_full": False, "preparation_time": 8},
        {"name": "沙嗲牛肉公仔麵", "description": "惹味沙嗲牛肉配即食麵", "price": 46, "category": "main_course", "subcategory": "主食", "is_vegetarian": False, "has_half_full": False, "preparation_time": 12},
        # Rice Dishes
        {"name": "焗豬扒飯", "description": "經典港式焗飯", "price_half": 52, "price_full": 86, "category": "biryani", "subcategory": "飯類", "is_vegetarian": False, "has_half_full": True, "preparation_time": 20},
        {"name": "叉燒煎蛋飯", "description": "蜜味叉燒配太陽蛋", "price_half": 42, "price_full": 70, "category": "biryani", "subcategory": "飯類", "is_vegetarian": False, "has_half_full": True, "preparation_time": 12},
        {"name": "滑蛋蝦仁飯", "description": "滑蛋配鮮蝦仁", "price_half": 48, "price_full": 78, "category": "biryani", "subcategory": "飯類", "is_vegetarian": False, "has_half_full": True, "preparation_time": 14},
        # Rice & Noodles
        {"name": "揚州炒飯", "description": "叉燒蝦仁蛋炒飯", "price_half": 42, "price_full": 68, "category": "rice_noodles", "subcategory": "炒飯", "is_vegetarian": False, "has_half_full": True, "preparation_time": 12},
        {"name": "乾炒牛河", "description": "鑊氣十足乾炒河粉", "price_half": 46, "price_full": 74, "category": "rice_noodles", "subcategory": "炒粉麵", "is_vegetarian": False, "has_half_full": True, "preparation_time": 12},
        {"name": "星洲炒米", "description": "咖哩風味米粉", "price_half": 40, "price_full": 66, "category": "rice_noodles", "subcategory": "炒粉麵", "is_vegetarian": False, "has_half_full": True, "preparation_time": 12},
        {"name": "餐蛋公仔麵", "description": "火腿餐肉煎蛋配公仔麵", "price_half": 38, "price_full": 60, "category": "rice_noodles", "subcategory": "粉麵", "is_vegetarian": False, "has_half_full": True, "preparation_time": 10},
        # Sandwiches
        {"name": "餐蛋三文治", "description": "午餐肉雞蛋三文治", "price": 30, "category": "rolls", "subcategory": "三文治", "is_vegetarian": False, "has_half_full": False, "preparation_time": 6},
        {"name": "公司三文治", "description": "多層火腿雞蛋番茄三文治", "price": 34, "category": "rolls", "subcategory": "三文治", "is_vegetarian": False, "has_half_full": False, "preparation_time": 8},
        {"name": "腸仔蛋卷", "description": "嫩滑蛋皮包腸仔", "price": 32, "category": "rolls", "subcategory": "卷類", "is_vegetarian": False, "has_half_full": False, "preparation_time": 7},
        # Bakery & Toast
        {"name": "菠蘿包", "description": "港式經典甜包", "price": 16, "category": "breads", "subcategory": "包點", "is_vegetarian": True, "has_half_full": False, "preparation_time": 4},
        {"name": "奶油豬仔包", "description": "香脆豬仔包配厚牛油", "price": 22, "category": "breads", "subcategory": "包點", "is_vegetarian": True, "has_half_full": False, "preparation_time": 5},
        {"name": "法蘭西多士", "description": "金黃香脆港式多士", "price": 28, "category": "breads", "subcategory": "多士", "is_vegetarian": True, "has_half_full": False, "preparation_time": 6},
        # Combo Sets
        {"name": "經典早餐套餐", "description": "餐蛋麵 + 多士 + 熱飲", "price": 45, "category": "combos", "subcategory": "早餐套餐", "is_vegetarian": False, "has_half_full": False, "preparation_time": 12},
        {"name": "公司三文治常餐", "description": "公司三文治 + 薯條 + 凍飲", "price": 52, "category": "combos", "subcategory": "常餐", "is_vegetarian": False, "has_half_full": False, "preparation_time": 12},
        {"name": "午市焗豬扒飯套餐", "description": "焗豬扒飯 + 每日例湯 + 凍檸茶", "price": 68, "category": "combos", "subcategory": "午市套餐", "is_vegetarian": False, "has_half_full": False, "preparation_time": 18},
        {"name": "焗飯二人套餐", "description": "任選焗飯兩款 + 小食拼盤 + 兩杯飲品", "price": 128, "category": "combos", "subcategory": "焗飯套餐", "is_vegetarian": False, "has_half_full": False, "preparation_time": 20},
        {"name": "粉麵午餐套餐", "description": "乾炒牛河/星洲炒米 + 熱飲", "price": 58, "category": "combos", "subcategory": "粉麵套餐", "is_vegetarian": False, "has_half_full": False, "preparation_time": 14},
        {"name": "熊熊小食拼盤", "description": "咖哩魚蛋 + 炸雲吞 + 黃金雞翼", "price": 78, "category": "combos", "subcategory": "小食拼盤", "is_vegetarian": False, "has_half_full": False, "preparation_time": 15},
        # Beverages
        {"name": "港式絲襪奶茶", "description": "茶香濃郁、口感順滑", "price": 24, "category": "beverages", "subcategory": "熱飲", "is_vegetarian": True, "has_half_full": False, "preparation_time": 4},
        {"name": "凍檸茶", "description": "清爽檸檬紅茶", "price": 26, "category": "beverages", "subcategory": "凍飲", "is_vegetarian": True, "has_half_full": False, "preparation_time": 3},
        {"name": "鴛鴦", "description": "咖啡奶茶經典混合", "price": 25, "category": "beverages", "subcategory": "熱飲", "is_vegetarian": True, "has_half_full": False, "preparation_time": 4},
        {"name": "檸檬梳打", "description": "微氣泡檸檬特飲", "price": 28, "category": "beverages", "subcategory": "凍飲", "is_vegetarian": True, "has_half_full": False, "preparation_time": 2},
    ]

# ===================== API ROUTES =====================

app = FastAPI(
    title="熊熊冰室 API",
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
    
    settings_row = await get_or_create_pricing_settings(db)
    pricing_settings = pricing_settings_to_dict(settings_row)

    result = await db.execute(query)
    items = result.scalars().all()

    category_ids = {item.category_id for item in items}
    category_name_by_id = {}
    if category_ids:
        cat_result = await db.execute(select(Category).where(Category.id.in_(category_ids)))
        categories = cat_result.scalars().all()
        category_name_by_id = {cat.id: cat.name for cat in categories}

    response_items = []
    now = get_hk_now()
    for item in items:
        effective_price = item.price
        meal_period = None
        pricing_note = None

        if category_name_by_id.get(item.category_id) == "combos" and item.price is not None:
            effective_price, meal_period = apply_combo_time_pricing(item.price, pricing_settings, now)
            pricing_note = get_pricing_note(meal_period, pricing_settings)

        response_items.append({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "price_half": item.price_half,
            "price_full": item.price_full,
            "price": effective_price,
            "category_id": item.category_id,
            "subcategory": item.subcategory,
            "image_url": item.image_url,
            "is_available": item.is_available,
            "is_vegetarian": item.is_vegetarian,
            "has_half_full": item.has_half_full,
            "preparation_time": item.preparation_time,
            "calories": item.calories,
            "spice_level": item.spice_level,
            "is_combo": category_name_by_id.get(item.category_id) == "combos",
            "pricing_note": pricing_note,
            "meal_period": meal_period,
        })

    return response_items

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


def validate_hhmm(value: str) -> bool:
    try:
        hour_str, minute_str = value.split(":")
        hour = int(hour_str)
        minute = int(minute_str)
        return 0 <= hour <= 23 and 0 <= minute <= 59
    except Exception:
        return False


@app.get("/api/admin/pricing-settings", response_model=PricingSettingsResponse)
async def get_pricing_settings(db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_pricing_settings(db)
    return settings


@app.put("/api/admin/pricing-settings", response_model=PricingSettingsResponse)
async def update_pricing_settings(payload: PricingSettingsUpdate, db: AsyncSession = Depends(get_db)):
    for field_name in ["lunch_start", "lunch_end", "dinner_start", "dinner_end"]:
        value = getattr(payload, field_name)
        if not validate_hhmm(value):
            raise HTTPException(status_code=400, detail=f"Invalid time format for {field_name}, expected HH:MM")

    if not (0 <= payload.lunch_discount_pct <= 100):
        raise HTTPException(status_code=400, detail="lunch_discount_pct must be between 0 and 100")
    if not (0 <= payload.dinner_surcharge_pct <= 100):
        raise HTTPException(status_code=400, detail="dinner_surcharge_pct must be between 0 and 100")

    settings = await get_or_create_pricing_settings(db)
    settings.lunch_start = payload.lunch_start
    settings.lunch_end = payload.lunch_end
    settings.lunch_discount_pct = payload.lunch_discount_pct
    settings.dinner_start = payload.dinner_start
    settings.dinner_end = payload.dinner_end
    settings.dinner_surcharge_pct = payload.dinner_surcharge_pct

    await db.commit()
    await db.refresh(settings)
    return settings

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
    settings_row = await get_or_create_pricing_settings(db)
    pricing_settings = pricing_settings_to_dict(settings_row)

    menu_item_ids = set(item.menu_item_id for item in order.items)
    for item in order.items:
        if item.linked_drink_item_id:
            menu_item_ids.add(item.linked_drink_item_id)

    menu_lookup = {}
    if menu_item_ids:
        menu_result = await db.execute(
            select(MenuItem, Category.name)
            .join(Category, MenuItem.category_id == Category.id)
            .where(MenuItem.id.in_(menu_item_ids))
        )
        menu_lookup = {
            menu_item.id: (menu_item, category_name)
            for menu_item, category_name in menu_result.all()
        }

    # Calculate subtotal using server-side pricing
    subtotal = 0
    items_data = []
    now = get_hk_now()
    for item in order.items:
        menu_entry = menu_lookup.get(item.menu_item_id)
        if not menu_entry:
            raise HTTPException(status_code=400, detail=f"Invalid menu item ID: {item.menu_item_id}")

        menu_item, category_name = menu_entry

        if menu_item.has_half_full:
            if item.half_full == "half" and menu_item.price_half is not None:
                base_price = menu_item.price_half
            elif menu_item.price_full is not None:
                base_price = menu_item.price_full
            elif menu_item.price is not None:
                base_price = menu_item.price
            else:
                raise HTTPException(status_code=400, detail=f"No valid price for item: {menu_item.name}")
        else:
            if menu_item.price is not None:
                base_price = menu_item.price
            elif menu_item.price_full is not None:
                base_price = menu_item.price_full
            else:
                raise HTTPException(status_code=400, detail=f"No valid price for item: {menu_item.name}")

        unit_price = round(base_price, 2)
        pricing_note = None
        linked_drink_name = None
        linked_drink_item_id = None
        drink_temp = None
        if category_name == "combos":
            unit_price, meal_period = apply_combo_time_pricing(base_price, pricing_settings, now)
            pricing_note = get_pricing_note(meal_period, pricing_settings)

            if item.linked_drink_item_id is not None:
                linked_entry = menu_lookup.get(item.linked_drink_item_id)
                if not linked_entry:
                    raise HTTPException(status_code=400, detail="Invalid linked drink item ID")

                linked_menu_item, linked_category_name = linked_entry
                if linked_category_name != "beverages":
                    raise HTTPException(status_code=400, detail="Linked drink must be a beverage item")

                linked_drink_item_id = linked_menu_item.id
                linked_drink_name = linked_menu_item.name
                drink_temp = (item.drink_temp or "hot").lower()

                if drink_temp not in {"hot", "iced"}:
                    raise HTTPException(status_code=400, detail="drink_temp must be 'hot' or 'iced'")

                drink_surcharge = COMBO_ICED_DRINK_SURCHARGE if drink_temp == "iced" else 0
                unit_price = round(unit_price + drink_surcharge, 2)
                temp_label = "凍" if drink_temp == "iced" else "熱"
                pricing_note = f"{pricing_note + '，' if pricing_note else ''}已配：{temp_label}{linked_drink_name}（只加{int(drink_surcharge)}，不收飲品原價）"
            else:
                pricing_note = f"{pricing_note + '，' if pricing_note else ''}未配飲品"

        subtotal += unit_price * item.quantity
        items_data.append({
            "menu_item_id": item.menu_item_id,
            "name": menu_item.name,
            "price": unit_price,
            "quantity": item.quantity,
            "half_full": item.half_full,
            "linked_drink_item_id": linked_drink_item_id,
            "linked_drink_name": linked_drink_name,
            "drink_temp": drink_temp,
            "notes": item.notes,
            "pricing_note": pricing_note
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
    order_number = f"ORD{timestamp}{order.table_number}{uuid4().hex[:4].upper()}"
    
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
        "restaurant_name": "熊熊冰室",
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
