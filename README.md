# Ozealis – The \$75 Experimental CPAP Simulator

> ⚠️ **DISCLAIMER:** Ozealis is **not a medical device**. It is intended strictly for **experimental**, **educational**, and **personal non-commercial use**. Use at your own risk.

---

## 💡 What Is Ozealis?

**Ozealis** is a fully open-source, modular **air-pressure simulation platform** designed to provide a safer, transparent, and more accessible alternative to overpriced CPAP machines.

Born out of necessity, it is engineered for **reliability**, **affordability**, and **hackability**—without corporate gatekeeping, prescription walls, or repair restrictions.

> Designed to be built for under **\$75**, using readily available electronics and 3D-printed parts.

---

## 🔧 Features

* ✅ **PTC fuse protection** on all power paths
* ✅ **Reverse polarity protection** via MOSFET (no diode drop)
* ✅ **Power outage alarm** via buzzer and capacitor UPS
* ✅ **DC5525 input (14V–35V)** — compatible with laptop bricks and power stations
* ✅ **Differential pressure sensing** using physical baffle (not RPM guesswork)
* ✅ **Humidity & temperature sensors** pre/post conditioning
* ✅ **Modular accessory port (USB-A + I²C)** for:

  * Heated hose module
  * Humidifier module
* ✅ **App-controlled interface** via WiFi and Bluetooth
* ✅ **16MB onboard log memory**
* ✅ **Compatible with \$6 standard CPAP hoses**
* ✅ **No proprietary parts, no DRM**
* ✅ **Fully 3D-printable enclosure** with FDM-optimized geometry

---

## 📷 Photos & Demos

Coming soon — this section will include:

* High-resolution photos
* Assembly walk-throughs
* App UI screenshots
* Demo video showing pressure response & noise levels

---

## 📦 Getting Started

### Build It Yourself

Documentation coming soon. For now, refer to:

* `hardware/` — schematics, PCB layout, BoM
* `firmware/` — ESP32 firmware + config
* `case/` — STL + STEP files for enclosure (PC + TPU)

> Assembly requires basic soldering and a 3D printer with 0.4–0.6mm nozzle.

---

## 📱 App & Data Logging

* Connect via WiFi to view **real-time pressure graphs**
* Export logs in **JSON or CSV**
* Tune pressure ramp profiles and buzzer thresholds
* OTA firmware updates planned

---

## 🛡️ Safety Systems

Ozealis includes multiple built-in protections:

* 🧯 **Overcurrent** protection on all input/output rails
* 🔔 **Power-loss alarm** wakes the user with a buzzer
* 🌡️ **Thermal cutoff** disables output above safe temperatures
* 💨 **Airflow anomaly detection** via differential pressure monitoring

This level of visibility is absent in many commercial machines.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

> Commercial use (manufacturing, distribution, resale) requires a separate license.
> Contact: **[team@ozealis.org](mailto:team@ozealis.org)**

See [`LICENSE.md`](LICENSE.md) for full terms.

---

## 🚫 Not a Medical Device

Ozealis is **not approved** by Health Canada, the FDA, or any regulatory agency.
It is an **airflow simulation platform** intended for **research and experimental purposes only.**

> No claims are made regarding the treatment or prevention of sleep apnea or any other condition.

---

## 🤝 Contribute

Pull requests welcome! Areas you can help:

* App UI & UX polish
* Log export improvements
* Pressure tuning curves
* Testing with accessories (heated hoses, passive humidifiers)

Fork → improve → PR.

---

## 🗺️ Roadmap

* [ ] Full BoM and build guide
* [ ] App-based tuning UI
* [ ] Web configurator for real-time control
* [ ] YouTube demo + sound comparison
* [ ] Translations (FR, EN, ES)

---

Made with urgency, necessity, and care 🇨🇦
*Because breathing shouldn't require a credit check.*
Ozealis is a trademark of Shopiro Ltd.
