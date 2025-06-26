# Ozealis – The $75 Experimental CPAP Simulator

> ⚠️ **DISCLAIMER:** Ozealis is not a certified medical device. It is intended strictly for **experimental**, **educational**, and **personal non-commercial** use only. Use at your own risk.

---

## 💡 What Is Ozealis?

Ozealis is a fully open-source, modular platform for exploring low-cost, user-driven air-pressure systems. It was created by necessity — for those of us who can’t afford to wait for diagnosis, approval, or overpriced medical devices.

This project is not a product, nor a substitute for professional care. It is a tool for personal experimentation, educational insight, and collaborative innovation.

Because sleep should be safe, and safety should be accessible.

---

## 🔧 Features

- ✅ PTC fuse protection on all power paths  
- ✅ Reverse polarity protection via MOSFET (no diode drop)  
- ✅ Power outage alarm via buzzer and capacitor-based UPS  
- ✅ DC5525 input (14V–35V) — compatible with laptop bricks & power stations  
- ✅ Differential pressure sensing via physical baffle (not RPM guesswork)  
- ✅ Pre/Post humidity & temperature sensing  
- ✅ Modular accessory port (USB-A + I²C) for:
  - Heated hose module  
  - Humidifier module  
- ✅ App-controlled via WiFi + Bluetooth  
- ✅ 16MB onboard log memory  
- ✅ Compatible with $6 standard CPAP hoses  
- ✅ No proprietary parts, no DRM  
- ✅ Fully 3D-printable enclosure with FDM-optimized geometry  

---

## 📷 Photos & Demos

Coming soon. This section will include:

- High-resolution photos  
- Assembly walk-throughs  
- App UI screenshots  
- Demo video showing pressure response & noise levels  

---

## 📦 Getting Started

### 🛠️ Build It Yourself

**Documentation coming soon.** For now, refer to:

- `hardware/` – Schematics, PCB layout, and BoM  
- `firmware/` – ESP32 firmware and config  
- `case/` – STL and STEP files for enclosure (PC + TPU)

Assembly requires:

- Basic soldering skills  
- A 3D printer with 0.4–0.6 mm nozzle  

---

## 📱 App & Data Logging

- Connect via WiFi to view real-time pressure graphs  
- Export logs in JSON or CSV  
- Tune pressure ramp profiles & buzzer thresholds  
- OTA firmware updates planned  

---

## 🛡️ Safety Systems

Ozealis includes multiple built-in protections:

- 🧯 Overcurrent protection on all input/output rails  
- 🔔 Power-loss alarm wakes user with buzzer  
- 🌡️ Thermal cutoff disables output at unsafe temps  
- 💨 Airflow anomaly detection via differential pressure monitoring  

> This level of visibility is **absent in many commercial machines**.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

Commercial use (manufacturing, distribution, resale) requires a separate license.  
**Contact:** `team@ozealis.org`

See `LICENSE.md` for full terms.

---

## 🚫 Not a Medical Device

Ozealis is **not approved** by Health Canada, the FDA, or any regulatory agency.  
It is an airflow simulation platform intended for **research and experimental purposes only**.

> No claims are made regarding the treatment, cure, or prevention of sleep apnea or any other condition.

---

## 🤝 Contribute

Pull requests welcome! Areas to contribute:

- App UI & UX polish  
- Log export improvements  
- Pressure tuning curves  
- Testing with accessories (heated hoses, passive humidifiers)  

Fork → improve → PR 💜

---

## 🗺️ Roadmap

- ✅ Full BoM and build guide  
- ✅ App-based tuning UI  
- ✅ Web configurator for real-time control  
- 🎥 YouTube demo + sound comparison  
- 🌍 Translations (FR, EN, ES)

---

Made with urgency, necessity, and care in Canada 🇨🇦  
Because breathing shouldn't require a credit check.

**Ozealis™ is a trademark of Shopiro Ltd.**
