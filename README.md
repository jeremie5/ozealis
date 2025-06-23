# Ozealis – The $75 Experimental CPAP Alternative

> ⚠️ **DISCLAIMER:** Ozealis is **not** a certified medical device. It is intended for **experimental**, **educational**, and **personal non-commercial use** only. Use at your own risk.

---

## 💡 What Is Ozealis?

**Ozealis** is a fully open-source, modular air-pressure platform designed to offer a safer, more accessible alternative to overpriced CPAP machines. Born out of necessity, it is engineered for **reliability**, **affordability**, and **transparency**—without corporate gatekeeping or prescription walls.

> Designed to be built for under **$75**, using common components and 3D-printed parts.

---

## 🔧 Features

- ✅ **PTC fuse protection** on all power paths
- ✅ **Power outage alarm** (via buzzer and capacitor UPS)
- ✅ **Standard DC5525 power input** (14V–35V supported)
- ✅ **Humidity and temperature sensing** before and after conditioning
- ✅ **Modular accessory port (USB-A + I²C)** for:
  - Heated hose module
  - Humidifier module
- ✅ **App-controlled interface** with full data logging
- ✅ **Compatible with $6 standard hoses** (rubber-ended, widely available)
- ✅ **No proprietary parts or DRM**
- ✅ **Fully 3D-printable enclosure** with an aesthetic, compact design

---

## 📷 Photos & Demos

Coming soon — this section will include high-resolution photos, assembly videos, and app screenshots.

---

## 📦 Getting Started

### Build It Yourself

Documentation coming soon. For now, refer to:

- `hardware/`: Schematics and PCB files
- `firmware/`: ESP32 firmware and config
- `case/`: 3D-printable STL and STEP files

---

## 📱 App & Data Logging

- Connect via WiFi to view live pressure graphs
- Export sleep logs in JSON or CSV
- Adjust pressure profiles and alarm thresholds
- OTA firmware updates planned

---

## 🛡️ Safety First

Ozealis is built with redundant protection and alerts:
- If power fluctuates, the user is woken by a buzzer
- If temperature exceeds safe thresholds, the unit cuts power
- If airflow becomes irregular, the app can flag anomalies

This level of feedback is missing from many commercial devices.

---

## 💸 Support This Project

I am currently jobless and building this out of necessity. If this project helps you or inspires you, consider supporting my work:

- [📥 Download my interactive résumé](https://shopiro.ca/cv)
- [🌐 Visit Shopiro](https://shopiro.ca)

Even $5 helps me buy components, pay rent, and keep going.

---

## 📄 License

This project is licensed under the **Creative Commons BY-NC 4.0 License**.  
You are free to use, modify, and redistribute it **non-commercially** with attribution.

> Commercial use (including manufacturing or sale) requires a separate license.  
> Contact me: jeremie@shopiro.ca

For full terms, see [`LICENSE`](LICENSE.md).

---

## 🚫 Not a Medical Device

Ozealis is not approved by Health Canada, the FDA, or any regulatory agency. It is an **experimental research platform** for airflow control. You assume all risk by using or modifying this project.

---

## 🤝 Contribute

Pull requests are welcome! Areas where help is especially appreciated:
- App UI improvements
- Data export formats
- Pressure profile tuning
- Hardware integration testing (humidifier, hose, etc.)

Fork the repo, improve, and submit a PR with your changes.

---

## ✨ Roadmap

- [ ] Add full build instructions & BOM
- [ ] Add full UI for app-based tuning
- [ ] Launch basic web configurator
- [ ] Publish demo video
- [ ] Translate documentation (FR/EN/ES)

---

Made with urgency, necessity, and care by **Jérémie Fréreault** 🇨🇦  
*Built to fight back against medical monopolies.*

