"""
熊熊冰室 - QR Based Ordering System
Main FastAPI Application
"""
import os
import json
import uuid
import httpx
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.future import select as async_select

from database import get_db, init_db, Base, engine
from models import MenuItem, Order, RestaurantSettings
from websocket_manager import ws_manager

# Create FastAPI app
app = FastAPI(
    title="熊熊冰室 - QR Ordering System",
    description="Real-time restaurant ordering system with QR codes",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory for QR codes
os.makedirs("backend/static/qr_codes", exist_ok=True)
os.makedirs("backend/static/images", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

# ==================== DEFAULT MENU ITEMS ====================
DEFAULT_MENU = [
    {"name": "焗豬扒飯", "description": "經典港式焗飯", "category": "non-veg", "price_half": 52, "price_full": 86, "is_popular": True, "prep_time": 20},
    {"name": "滑蛋蝦仁飯", "description": "滑蛋配鮮蝦仁", "category": "non-veg", "price_half": 48, "price_full": 78, "prep_time": 14},
    {"name": "黃金雞翼", "description": "香脆惹味雞中翼", "category": "non-veg", "price_half": 38, "price_full": 62, "is_popular": True, "prep_time": 12},
    {"name": "黑椒牛柳意粉", "description": "香濃黑椒汁配牛柳", "category": "non-veg", "price_half": 48, "price_full": 78, "is_popular": True, "prep_time": 15},
    {"name": "餐蛋三文治", "description": "午餐肉雞蛋三文治", "category": "non-veg", "price_full": 30, "is_popular": True, "prep_time": 6},
    {"name": "西多士", "description": "港式花生醬西多士", "category": "veg", "price_full": 34, "prep_time": 8},
    {"name": "羅宋湯", "description": "經典港式蕃茄牛肉蔬菜湯", "category": "non-veg", "price_full": 38, "prep_time": 8},
    {"name": "咖哩魚蛋", "description": "街頭風味彈牙魚蛋", "category": "non-veg", "price_half": 28, "price_full": 45, "prep_time": 8},
    {"name": "椒鹽豆腐", "description": "外脆內嫩豆腐粒", "category": "veg", "price_half": 30, "price_full": 48, "prep_time": 10},
    {"name": "揚州炒飯", "description": "叉燒蝦仁蛋炒飯", "category": "non-veg", "price_full": 68, "prep_time": 12},
    {"name": "港式絲襪奶茶", "description": "茶香濃郁、口感順滑", "category": "veg", "price_full": 24, "prep_time": 4},
    {"name": "菠蘿包", "description": "港式經典甜包", "category": "veg", "price_full": 16, "prep_time": 4},
]

# ==================== STARTUP EVENT ====================
@app.on_event("startup")
async def startup():
    """Initialize database and seed default data."""
    await init_db()
    
    async with AsyncSession(engine) as session:
        # Check if menu items exist
        result = await session.execute(select(MenuItem))
        existing_menu = result.scalars().all()
        
        if not existing_menu:
            # Seed default menu items
            for item in DEFAULT_MENU:
                menu_item = MenuItem(
                    name=item["name"],
                    description=item.get("description", ""),
                    category=item["category"],
                    price_half=item.get("price_half"),
                    price_full=item["price_full"],
                    is_popular=item.get("is_popular", False),
                    prep_time_minutes=item.get("prep_time", 15)
                )
                session.add(menu_item)
            
            # Seed restaurant settings
            settings = RestaurantSettings(
                name="熊熊冰室",
                phone1="7030802567",
                phone2="7798757769",
                timing_open="11:30 AM",
                timing_close="11:30 PM",
                address="Shop No. 2,3,4, Angan Apt, Radha Nagar, Tulinj Road, Near Amantaran Bar, Nallasopara East, Palghar - 401209",
                map_latitude=19.426127715321726,
                map_longitude=72.8246998144116,
                tax_percentage=5,
                razorpay_key_id="rzp_test_SEULnJj6ZBfPb4",
                razorpay_key_secret="hbKF4N7QaMyjDcI0FilNtPyW"
            )
            session.add(settings)
            
            await session.commit()
            print("Database initialized with default menu and settings")

# ==================== API ROUTES ====================

# --- Menu API ---

@app.get("/api/menu")
async def get_menu(
    category: str = None,
    search: str = None,
    sort_by: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get menu items with optional filters."""
    query = select(MenuItem).where(MenuItem.is_available == True)
    
    if category and category != "all":
        query = query.where(MenuItem.category == category)
    
    if search:
        query = query.where(MenuItem.name.ilike(f"%{search}%"))
    
    if sort_by == "price_low":
        query = query.order_by(MenuItem.price_full.asc())
    elif sort_by == "price_high":
        query = query.order_by(MenuItem.price_full.desc())
    elif sort_by == "popular":
        query = query.order_by(MenuItem.is_popular.desc())
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    return {"menu": [item.to_dict() for item in items]}

@app.post("/api/menu")
async def add_menu_item(
    item: dict,
    db: AsyncSession = Depends(get_db)
):
    """Add a new menu item (admin only)."""
    menu_item = MenuItem(
        name=item["name"],
        description=item.get("description", ""),
        category=item["category"],
        price_half=item.get("price_half"),
        price_full=item["price_full"],
        image=item.get("image"),
        is_available=item.get("is_available", True),
        is_popular=item.get("is_popular", False),
        prep_time_minutes=item.get("prep_time_minutes", 15)
    )
    db.add(menu_item)
    await db.commit()
    await db.refresh(menu_item)
    return {"success": True, "item": menu_item.to_dict()}

@app.put("/api/menu/{item_id}")
async def update_menu_item(
    item_id: int,
    item: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update a menu item (admin only)."""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalars().first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.items():
        if hasattr(db_item, key):
            setattr(db_item, key, value)
    
    await db.commit()
    return {"success": True, "item": db_item.to_dict()}

@app.delete("/api/menu/{item_id}")
async def delete_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a menu item (admin only)."""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalars().first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.delete(db_item)
    await db.commit()
    return {"success": True}

@app.put("/api/menu/{item_id}/toggle")
async def toggle_menu_item_availability(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Toggle menu item availability."""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    db_item = result.scalars().first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db_item.is_available = not db_item.is_available
    await db.commit()
    
    return {"success": True, "is_available": db_item.is_available}

# --- Order API ---

@app.post("/api/orders")
async def create_order(
    order: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create a new order."""
    # Generate order number
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    # Calculate totals
    subtotal = sum(item["price"] * item["quantity"] for item in order["items"])
    
    # Get tax percentage
    result = await db.execute(select(RestaurantSettings))
    settings = result.scalars().first()
    tax_percentage = settings.tax_percentage if settings else 5
    tax = round(subtotal * (tax_percentage / 100), 2)
    total = round(subtotal + tax, 2)
    
    # Create status history
    status_history = [{
        "status": "pending",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Order placed successfully"
    }]
    
    new_order = Order(
        order_number=order_number,
        table_number=order["table_number"],
        customer_name=order["customer_name"],
        customer_phone=order["customer_phone"],
        special_notes=order.get("special_notes", ""),
        items=order["items"],
        subtotal=subtotal,
        tax=tax,
        total=total,
        payment_status="pending",
        order_status="pending",
        status_history=status_history
    )
    
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)
    
    # Notify kitchen about new order
    await ws_manager.notify_new_order(new_order.to_dict())
    
    return {"success": True, "order": new_order.to_dict()}

@app.get("/api/orders/{order_id}")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get order details."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"order": order.to_dict()}

@app.get("/api/orders/number/{order_number}")
async def get_order_by_number(
    order_number: str,
    db: AsyncSession = Depends(get_db)
):
    """Get order by order number."""
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"order": order.to_dict()}

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    status_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update order status."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.order_status
    new_status = status_data["status"]
    
    order.order_status = new_status
    
    # Add to status history
    status_messages = {
        "pending": "Waiting for kitchen to accept",
        "accepted": "Order accepted by kitchen",
        "preparing": "Your order is being prepared",
        "ready": "Order ready for collection",
        "completed": "Order completed",
        "rejected": "Order rejected"
    }
    
    order.status_history.append({
        "status": new_status,
        "timestamp": datetime.utcnow().isoformat(),
        "message": status_messages.get(new_status, "")
    })
    
    await db.commit()
    
    # Notify customer about status change
    await ws_manager.notify_order_status_change(order.to_dict())
    
    return {"success": True, "order": order.to_dict()}

# --- Kitchen API ---

@app.get("/api/kitchen/orders")
async def get_kitchen_orders(
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get orders for kitchen display."""
    query = select(Order)
    
    if status:
        query = query.where(Order.order_status == status)
    else:
        # Get active orders (not completed or rejected)
        query = query.where(Order.order_status.in_(["pending", "accepted", "preparing", "ready"]))
    
    query = query.order_by(Order.created_at.desc())
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return {"orders": [order.to_dict() for order in orders]}

# --- Admin API ---

@app.get("/api/admin/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db)
):
    """Get admin dashboard data."""
    # Get today's orders
    today = datetime.now().date()
    
    result = await db.execute(select(Order))
    all_orders = result.scalars().all()
    
    today_orders = [o for o in all_orders if o.created_at.date() == today]
    
    # Calculate revenue
    today_revenue = sum(o.total for o in today_orders if o.payment_status == "paid")
    total_revenue = sum(o.total for o in all_orders if o.payment_status == "paid")
    
    # Order counts
    pending_count = len([o for o in all_orders if o.order_status == "pending"])
    preparing_count = len([o for o in all_orders if o.order_status == "preparing"])
    ready_count = len([o for o in all_orders if o.order_status == "ready"])
    completed_count = len([o for o in all_orders if o.order_status == "completed"])
    
    return {
        "today_orders": len(today_orders),
        "today_revenue": today_revenue,
        "total_revenue": total_revenue,
        "pending_orders": pending_count,
        "preparing_orders": preparing_count,
        "ready_orders": ready_count,
        "completed_orders": completed_count
    }

@app.get("/api/admin/sales")
async def get_sales(
    date: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get sales data."""
    result = await db.execute(select(Order).where(Order.payment_status == "paid"))
    orders = result.scalars().all()
    
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        orders = [o for o in orders if o.created_at.date() == target_date]
    
    return {
        "total_orders": len(orders),
        "total_revenue": sum(o.total for o in orders),
        "orders": [o.to_dict() for o in orders]
    }

@app.get("/api/admin/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db)
):
    """Get restaurant settings."""
    result = await db.execute(select(RestaurantSettings))
    settings = result.scalars().first()
    
    if not settings:
        return {}
    
    return {
        "name": settings.name,
        "phone1": settings.phone1,
        "phone2": settings.phone2,
        "timing_open": settings.timing_open,
        "timing_close": settings.timing_close,
        "address": settings.address,
        "map_latitude": settings.map_latitude,
        "map_longitude": settings.map_longitude,
        "tax_percentage": settings.tax_percentage,
        "razorpay_key_id": settings.razorpay_key_id,
        "razorpay_key_secret": settings.razorpay_key_secret
    }

@app.put("/api/admin/settings")
async def update_settings(
    settings: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update restaurant settings."""
    result = await db.execute(select(RestaurantSettings))
    db_settings = result.scalars().first()
    
    if not db_settings:
        db_settings = RestaurantSettings()
        db.add(db_settings)
    
    for key, value in settings.items():
        if hasattr(db_settings, key):
            setattr(db_settings, key, value)
    
    await db.commit()
    return {"success": True}

# --- Payment API ---

@app.post("/api/payment/create")
async def create_payment(
    payment_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create a Razorpay payment order."""
    order_id = payment_data["order_id"]
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get Razorpay credentials
    result = await db.execute(select(RestaurantSettings))
    settings = result.scalars().first()
    
    if not settings or not settings.razorpay_key_id:
        raise HTTPException(status_code=400, detail="Payment not configured")
    
    # Create Razorpay order (using test mode - in real app, use Razorpay SDK)
    razorpay_order_id = f"razorpay_order_{order_id}_{uuid.uuid4().hex[:8]}"
    
    # In test mode, we'll just return a mock response
    return {
        "success": True,
        "payment_id": razorpay_order_id,
        "order_id": order.id,
        "amount": int(order.total * 100),  # Razorpay uses cents
        "currency": "HKD",
        "key_id": settings.razorpay_key_id
    }

@app.post("/api/payment/verify")
async def verify_payment(
    payment_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Verify payment and update order status."""
    order_id = payment_data["order_id"]
    payment_id = payment_data["payment_id"]
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update payment status
    order.payment_status = "paid"
    order.payment_id = payment_id
    order.status_history.append({
        "status": "paid",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Payment successful"
    })
    
    await db.commit()
    
    return {"success": True, "order": order.to_dict()}

# --- WebSocket Endpoint ---

@app.websocket("/ws/{connection_type}/{connection_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    connection_type: str,
    connection_id: str
):
    """WebSocket connection for real-time updates."""
    await ws_manager.connect(websocket, connection_id, connection_type)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get("type") == "subscribe_order":
                    order_id = message.get("order_id")
                    await ws_manager.subscribe_to_order(connection_id, order_id)
                    await ws_manager.send_to_connection(connection_id, {
                        "type": "subscribed",
                        "order_id": order_id
                    })
            
            except json.JSONDecodeError:
                pass
    
    except WebSocketDisconnect:
        ws_manager.disconnect(connection_id)

# --- QR Code Generation ---

@app.get("/api/qr/generate/{table_number}")
async def generate_qr_code(
    table_number: int,
    base_url: str = Query("http://localhost:5173")
):
    """Generate QR code URL for a table."""
    import qrcode
    import io
    import base64
    
    url = f"{base_url}/table/{table_number}"
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "table_number": table_number,
        "url": url,
        "qr_code": f"data:image/png;base64,{qr_base64}"
    }

# --- Frontend Routes (SPA fallback) ---

@app.get("/")
async def root():
    """Serve the main HTML file."""
    from fastapi.responses import FileResponse
    return FileResponse("frontend/dist/index.html")

@app.get("/table/{table_number}")
async def table_page(table_number: int):
    """Serve the table-specific page."""
    from fastapi.responses import FileResponse
    return FileResponse("frontend/dist/index.html")

@app.get("/kitchen")
async def kitchen_page():
    """Serve the kitchen dashboard page."""
    from fastapi.responses import FileResponse
    return FileResponse("frontend/dist/index.html")

@app.get("/admin")
async def admin_page():
    """Serve the admin page."""
    from fastapi.responses import FileResponse
    return FileResponse("frontend/dist/index.html")

@app.get("/qr-codes")
async def qr_codes_page():
    """Serve the QR codes page."""
    from fastapi.responses import FileResponse
    return FileResponse("frontend/dist/index.html")

# ==================== RUN APP ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
