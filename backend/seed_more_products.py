from app import create_app, db, Product


CATEGORY_LISTINGS = {
    "Graphics Cards": [
        ("ASRock Challenger RX 7600", "ASRock", 78000, "8GB GDDR6", "PCI Express 4.0"),
        ("Palit RTX 4060 Dual", "Palit", 99000, "8GB GDDR6", "Dual-fan"),
        ("MSI RTX 4070 Super Ventus", "MSI", 215000, "12GB GDDR6X", "Triple-fan"),
        ("Gigabyte RX 7800 XT Gaming", "Gigabyte", 179000, "16GB GDDR6", "Triple-fan"),
        ("Sapphire Pulse RX 7900 GRE", "Sapphire", 225000, "16GB GDDR6", "Triple-fan"),
    ],
    "Used Graphics Cards": [
        ("Used RTX 3060 12GB", "NVIDIA", 72000, "12GB GDDR6", "Tested and cleaned"),
        ("Used GTX 1660 Super", "NVIDIA", 43000, "6GB GDDR6", "7-day check warranty"),
        ("Used RX 6600 8GB", "AMD", 48000, "8GB GDDR6", "Tested and cleaned"),
        ("Used RTX 3070 8GB", "NVIDIA", 95000, "8GB GDDR6", "Light cosmetic use"),
        ("Used RX 6750 XT 12GB", "AMD", 82000, "12GB GDDR6", "7-day check warranty"),
    ],
    "Processors": [
        ("Ryzen 5 7600X", "AMD", 72000, "6 cores / 12 threads", "AM5"),
        ("Ryzen 7 7800X3D", "AMD", 112000, "8 cores / 16 threads", "96MB 3D V-Cache"),
        ("Core i5-14400F", "Intel", 79000, "10 cores / 16 threads", "LGA1700"),
        ("Core i7-14700K", "Intel", 145000, "20 cores / 28 threads", "LGA1700"),
        ("Ryzen 9 7900X", "AMD", 155000, "12 cores / 24 threads", "AM5"),
    ],
    "Motherboards": [
        ("B650M Pro WiFi", "MSI", 59000, "AMD B650", "Micro ATX"),
        ("X670E Gaming WiFi", "Gigabyte", 115000, "AMD X670E", "ATX"),
        ("B760 DS3H AX DDR5", "Gigabyte", 52000, "Intel B760", "ATX"),
        ("Z790 Aorus Elite AX", "Gigabyte", 98000, "Intel Z790", "ATX"),
        ("B550 Tomahawk", "MSI", 44000, "AMD B550", "ATX"),
    ],
    "Memory": [
        ("Vengeance DDR5 32GB Kit", "Corsair", 38000, "2 x 16GB DDR5", "6000MT/s"),
        ("Trident Z5 RGB 32GB", "G.Skill", 42000, "2 x 16GB DDR5", "6400MT/s"),
        ("Fury Beast DDR5 32GB", "Kingston", 34000, "2 x 16GB DDR5", "5600MT/s"),
        ("Viper Venom 16GB Kit", "Patriot", 18000, "2 x 8GB DDR4", "3600MT/s"),
        ("Ripjaws S5 64GB Kit", "G.Skill", 78000, "2 x 32GB DDR5", "6000MT/s"),
    ],
    "Storage": [
        ("WD Black SN770 1TB", "Western Digital", 29000, "1TB NVMe", "PCIe 4.0"),
        ("Samsung 990 Pro 2TB", "Samsung", 72000, "2TB NVMe", "Up to 7450MB/s"),
        ("Crucial P3 Plus 1TB", "Crucial", 23000, "1TB NVMe", "PCIe 4.0"),
        ("Kingston NV2 500GB", "Kingston", 12500, "500GB NVMe", "PCIe 4.0"),
        ("SanDisk Extreme Portable 2TB", "SanDisk", 52000, "2TB USB SSD", "USB-C"),
    ],
    "Power Supplies": [
        ("RM750e 750W", "Corsair", 38000, "750W", "80 PLUS Gold"),
        ("HX1200i 1200W", "Corsair", 90000, "1200W", "80 PLUS Platinum"),
        ("Super Flower Leadex VII 850W", "Super Flower", 50000, "850W", "80 PLUS Gold"),
        ("Be Quiet Pure Power 12 650W", "Be Quiet", 32000, "650W", "80 PLUS Gold"),
        ("Cooler Master MWE 750W", "Cooler Master", 27000, "750W", "80 PLUS Bronze"),
    ],
    "Cases & Cooling": [
        ("H9 Flow Dual Chamber", "NZXT", 52000, "Mid-tower ATX", "Tempered glass"),
        ("Lancool 207 Mesh", "Lian Li", 39000, "Mid-tower ATX", "Mesh front"),
        ("Kraken 360 RGB", "NZXT", 78000, "360mm liquid cooler", "RGB"),
        ("Hyper 212 Black Edition", "Cooler Master", 12500, "120mm air cooler", "PWM fan"),
        ("TF120 ARGB 3-Pack", "Thermalright", 17000, "3 x 120mm fans", "ARGB"),
    ],
    "Laptops": [
        ("ROG Zephyrus G14", "ASUS", 420000, "Ryzen 9", "32GB · 1TB SSD"),
        ("Legion Slim 5", "Lenovo", 299000, "Ryzen 7", "16GB · 1TB SSD"),
        ("Victus 16 Gaming", "HP", 245000, "Core i7", "16GB · 512GB SSD"),
        ("Swift Go 14", "Acer", 210000, "Core Ultra 5", "16GB · 1TB SSD"),
        ("MacBook Air 15 M3", "Apple", 365000, "Apple M3", "16GB · 512GB SSD"),
    ],
    "Used Laptops": [
        ("Used ThinkPad T14 Gen 3", "Lenovo", 175000, "Core i7 12th Gen", "16GB · 512GB SSD"),
        ("Used Dell Latitude 7430", "Dell", 165000, "Core i7 12th Gen", "16GB · 512GB SSD"),
        ("Used MacBook Pro 14 M1 Pro", "Apple", 290000, "Apple M1 Pro", "16GB · 1TB SSD"),
        ("Used HP EliteBook 840 G8", "HP", 125000, "Core i5 11th Gen", "16GB · 256GB SSD"),
        ("Used Lenovo Legion 5", "Lenovo", 155000, "Ryzen 7", "16GB · 512GB SSD"),
    ],
    "Monitors": [
        ("Odyssey G7 32 Curved", "Samsung", 210000, "32-inch 1440p", "240Hz"),
        ("ProArt PA279CV 27", "ASUS", 145000, "27-inch 4K IPS", "USB-C"),
        ("LG UltraGear 27GP850", "LG", 125000, "27-inch 1440p IPS", "165Hz"),
        ("Dell Alienware AW2724DM", "Dell", 155000, "27-inch 1440p IPS", "180Hz"),
        ("ViewSonic VX2418C", "ViewSonic", 48000, "24-inch 1080p VA", "165Hz"),
    ],
    "Audio": [
        ("WH-1000XM5", "Sony", 92000, "Over-ear wireless", "Noise cancellation"),
        ("Cloud Alpha Wireless", "HyperX", 54000, "Gaming headset", "300-hour battery"),
        ("AirPods Pro 2", "Apple", 78000, "Wireless earbuds", "Adaptive audio"),
        ("Speaker 3rd Gen", "Marshall", 85000, "Portable Bluetooth", "Stereo sound"),
        ("G Pro X 2 Lightspeed", "Logitech", 62000, "Gaming headset", "Wireless"),
    ],
    "Accessories": [
        ("MX Master 3S Wireless Mouse", "Logitech", 28000, "USB-C / Bluetooth", "8K DPI"),
        ("Ninja Pro 68 HE Keyboard", "Fantech", 22000, "Magnetic switches", "USB-C"),
        ("MP860 XL Mouse Pad", "Corsair", 9500, "900 x 400mm", "Textured cloth"),
        ("Stream Deck Mini", "Elgato", 39000, "6 programmable keys", "USB-C"),
        ("PowerStation 3-in-1 Charger", "Anker", 14500, "Wireless charging", "Qi compatible"),
    ],
}


def slugify(value):
    return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-").replace("--", "-")


def main():
    app = create_app()
    with app.app_context():
        added = 0
        for category, listings in CATEGORY_LISTINGS.items():
            current = Product.query.filter_by(category=category).count()
            for index, (name, brand, price, detail, extra) in enumerate(listings, start=1):
                if current >= 5:
                    break
                slug = slugify(f"{brand}-{name}")
                if Product.query.filter_by(slug=slug).first():
                    continue
                product = Product(
                    slug=slug,
                    name=name,
                    category=category,
                    brand=brand,
                    detail=f"{detail} · {extra}",
                    description=f"{name} from {brand} is selected for dependable everyday performance and is available with checkout through TechnoBaazar.",
                    specifications=[detail, extra],
                    price_value=price,
                    badge="New listing" if index <= 2 else "In stock",
                    image="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=760&q=85",
                    image_alt=f"{name} product listing",
                    stock_quantity=10,
                    track_stock=True,
                    active=True,
                )
                db.session.add(product)
                current += 1
                added += 1
        db.session.commit()
        print(f"Added {added} product listings")


if __name__ == "__main__":
    main()
