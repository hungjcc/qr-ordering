"""Database models for the restaurant ordering system."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from database import Base

class MenuItem(Base):
    """Menu item model."""
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)  # veg, non-veg, beverages
    price_half = Column(Float, nullable=True)  # Optional for items with half/full
    price_full = Column(Float, nullable=False)
    image = Column(String(500))
    is_available = Column(Boolean, default=True)
    is_popular = Column(Boolean, default=False)
    prep_time_minutes = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "price_half": self.price_half,
            "price_full": self.price_full,
            "image": self.image,
            "is_available": self.is_available,
            "is_popular": self.is_popular,
            "prep_time_minutes": self.prep_time_minutes
        }

class Order(Base):
    """Order model."""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), unique=True, nullable=False)
    table_number = Column(Integer, nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    special_notes = Column(Text)
    items = Column(JSON, nullable=False)  # List of {menu_item_id, name, quantity, size, price}
    subtotal = Column(Float, nullable=False)
    tax = Column(Float, default=0)
    total = Column(Float, nullable=False)
    payment_status = Column(String(20), default="pending")  # pending, paid, failed
    payment_id = Column(String(100))
    order_status = Column(String(30), default="pending")  # pending, accepted, preparing, ready, completed, rejected
    status_history = Column(JSON, default=[])  # List of {status, timestamp}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "order_number": self.order_number,
            "table_number": self.table_number,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "special_notes": self.special_notes,
            "items": self.items,
            "subtotal": self.subtotal,
            "tax": self.tax,
            "total": self.total,
            "payment_status": self.payment_status,
            "payment_id": self.payment_id,
            "order_status": self.order_status,
            "status_history": self.status_history,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

class RestaurantSettings(Base):
    """Restaurant settings model."""
    __tablename__ = "restaurant_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="熊熊冰室")
    phone1 = Column(String(20))
    phone2 = Column(String(20))
    timing_open = Column(String(20), default="11:30 AM")
    timing_close = Column(String(20), default="11:30 PM")
    address = Column(Text)
    map_latitude = Column(Float, default=19.426127715321726)
    map_longitude = Column(Float, default=72.8246998144116)
    tax_percentage = Column(Float, default=5)
    razorpay_key_id = Column(String(100))
    razorpay_key_secret = Column(String(100))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
